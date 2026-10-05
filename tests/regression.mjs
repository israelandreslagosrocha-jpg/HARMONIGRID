// Regression diagnostics and performance measurements; Vue setup without a DOM.
// Run: node tests/stability.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { parse, compileScript } from '@vue/compiler-sfc';
import { nextTick, effectScope } from 'vue';
import { getScaleNotes, getDiatonicChords, SCALES } from '../src/core/scales.js';
import { getRootPositionMidi } from '../src/core/audio.js';
import { transposeNote, NOTE_TO_INDEX } from '../src/core/notes.js';
import { getChordDegree, applySuggestion, getSuggestionsForSystem } from '../src/core/suggestions.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = fs.readFileSync(process.env.HG_SOURCE || path.join(root, 'src/App.vue'), 'utf8');
const { descriptor } = parse(source);
let compiled = compileScript(descriptor, { id: 'audit' }).content;
// Engine regression includes advanced compositions; public launch has a separate test.
compiled = compiled.replace('const isFreeLaunch = true','const isFreeLaunch = false');
compiled = compiled.replace(/import (\w+) from '\.\/components\/[^']+\.vue'/g, (_, name) => `const ${name} = {}`);
 compiled = compiled.replace(/import logoUrl from '.\/assets\/logo.jpg'/, "const logoUrl = ''");
compiled = compiled.replace(/from '(\.\/core\/[^']+)'/g, (_, p) => `from '${pathToFileURL(path.resolve(root, 'src', p)).href}'`);
compiled = compiled.replace(/from 'vue'/g, `from '${pathToFileURL(path.join(root, 'node_modules/vue/dist/vue.runtime.esm-bundler.js')).href}'`);
const temp = path.join(os.tmpdir(), `harmonigrid-regression-${process.pid}.mjs`);
fs.writeFileSync(temp, compiled);
const { default: component } = await import(pathToFileURL(temp));
const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(String(args[0]));
const scope = effectScope();
const s = scope.run(() => component.setup({}, { expose() {} }));

const clone = value => JSON.parse(JSON.stringify(value));
const legacySignature = value => {
  let index = value;
  if (value && typeof value === 'object') index = value.originalMeasureIndex !== undefined ? value.originalMeasureIndex : s.measures.value.findIndex(m => m.id === value.id);
  for (let i = index; index !== null && index !== undefined && i >= 0; i--) {
    const metric = s.measures.value[i]?.timeSignature;
    if (metric) return {beats: metric.beats, unit: metric.unit};
  }
  return {beats:s.timeSignature.value, unit:s.timeSignatureUnit.value};
};
const legacyGrouping = value => {
  let index = value;
  let measure = null;
  if (value && typeof value === 'object') {
    measure = value;
    index = value.originalMeasureIndex !== undefined ? value.originalMeasureIndex : s.measures.value.findIndex(m => m.id === value.id);
  } else if (value !== null && value !== undefined && value >= 0) measure = s.measures.value[index];
  if (!measure) return s.getDefaultGrouping(s.timeSignature.value,s.timeSignatureUnit.value);
  const metric = legacySignature(measure);
  if (metric.unit === 8) {
    const analysis = s.analyzeMeasureSubdivision(measure);
    if (analysis.type === 'match') return analysis.pattern;
  }
  for(let i=index;i>=0;i--) if(s.measures.value[i]?.grouping) return s.measures.value[i].grouping;
  return s.getDefaultGrouping(metric.beats,metric.unit);
};
s.setPlan('PRO'); s.configMeasuresCount.value=24; s.startProject(); await nextTick();
let checks=0;
const checkMetrics = () => {
  const inputs=[null,undefined,-1,0,999,{id:'unknown',beats:[]}];
  s.measures.value.forEach((m,i)=>inputs.push(i,m,{...m,originalMeasureIndex:i}));
  for(const input of inputs) {
    assert.deepEqual(s.getMeasureTimeSignature(input),legacySignature(input));
    assert.deepEqual(s.getMeasureGrouping(input),legacyGrouping(input)); checks+=2;
  }
};
checkMetrics();
s.measures.value[3].timeSignature={beats:7,unit:8};
s.measures.value[3].grouping=[3,2,2];
s.measures.value[11].timeSignature={beats:3,unit:4};
s.measures.value[11].grouping=[1,1,1]; await nextTick(); checkMetrics();
s.measures.value[6].timeSignature={beats:6,unit:8}; await nextTick(); checkMetrics();
delete s.measures.value[3].timeSignature; delete s.measures.value[3].grouping; await nextTick(); checkMetrics();
s.measures.value.splice(2,1); await nextTick(); checkMetrics();
s.measures.value[4].id=s.measures.value[1].id; await nextTick(); checkMetrics();
s.timeSignature.value=5; s.timeSignatureUnit.value=8; await nextTick(); checkMetrics();
const checkSuggestions = () => {
  const expected=[]; const seen=new Set();
  const context=s.measuresWithKey.value;
  for(let i=0;i<=s.measures.value.length-4;i++) {
    for(const item of getSuggestionsForSystem(s.measures.value.slice(i,i+4),i,context[i].activeKey,context[i].activeScale)) {
      const id=`${item.title}_${item.description}`;
      if(!seen.has(id)) {seen.add(id);expected.push({...item,type:'rule'});}
    }
  }
  // The pool intentionally retains exactly title/description/payload/type.
  const normalized=expected.map(({title,description,payload,type})=>({title,description,payload,type}));
  assert.deepEqual(clone(s.allSuggestionsPool.value),clone(normalized)); checks++;
};
for(let i=0;i<s.measures.value.length;i++) s.measures.value[i].beats.forEach((b,j)=>Object.assign(b,{root:j===0?['C','G','A','F'][i%4]:'',type:i%4===2?'min':'maj'}));
await nextTick(); checkSuggestions();
for(const mutation of [
  ()=>s.measures.value[5].beats[0].type='7',
  ()=>s.measures.value[5].beats[0].tensions=['b9'],
  ()=>s.measures.value[5].beats[0].tensions.push('#11'),
  ()=>s.measures.value[5].beats[0].bass='E',
  ()=>s.measures.value[5].beats[1].root='D',
  ()=>s.measures.value[5].keyChange={key:'D',scaleType:'dorian'},
  ()=>s.key.value='F',
  ()=>s.scaleType.value='minor',
  ()=>s.measures.value.reverse(),
  ()=>s.measures.value.splice(3,1),
  ()=>s.measures.value=clone(s.measures.value),
  ()=>s.setPlan('FREE')
]) {mutation();await nextTick();checkSuggestions();checkMetrics();}
// Validation must still remove impossible ties and retain valid adjacent chords.
s.setPlan('PRO');s.timeSignature.value=4;s.timeSignatureUnit.value=4;
s.measures.value=[{id:'tie-fixture',beats:[{id:'b0',root:'C',type:'maj'},{id:'b1',root:'G',type:'maj'},{id:'b2',root:'',type:''},{id:'b3',root:'F',type:'maj'}]}];
await nextTick();s.tiedSlots.value=new Set(['0_1','0_2','0_3']);s.validateTies();
assert.deepEqual([...s.tiedSlots.value],['0_1']);checks++;
s.lyricsTiedSlots.value=new Set(['lyrics_0_1']);s.validateLyricsTies();assert.equal(s.lyricsTiedSlots.value.size,0);checks++;
const before=clone(s.measures.value);s.saveHistory();s.measures.value[0].beats[0].root='D';await nextTick();s.undo();await nextTick();assert.deepEqual(clone(s.measures.value),before);checks++;
scope.stop();if(s.toastTimeout.value)clearTimeout(s.toastTimeout.value);console.warn=originalWarn;
console.log(`${checks} equivalence and regression checks passed`);
