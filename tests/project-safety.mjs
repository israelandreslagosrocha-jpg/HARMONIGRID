import assert from 'node:assert/strict';
import {nextTick} from 'vue';
import {jsPDF} from 'jspdf';
import fs from 'node:fs';
import {buildExpandedSequence,MAX_EXPANDED_MEASURES} from '../src/core/repeatSequence.js';
import {createEditor,richSong,clone} from './component-harness.mjs';
const h=await createEditor();const e=h.editor;let checks=0;
try{
 e.setPlan('PRO');e.measures.value=richSong(24);e.scaleType.value='dorian';e.globalGroove.value='Bossa';e.globalShowObligado.value=true;e.globalShowSubdivisions.value=true;
 e.measures.value[3].keyChange={key:'D',scaleType:'minor'};
 e.repeats.value=[{type:'casilla',startMeasure:1,endMeasure:4,casilla1Start:4,casilla2Start:5,casilla2End:5,times:3}];
 await nextTick();e.tiedSlots.value=new Set(['1_0']);e.lyricsTiedSlots.value=new Set(['lyrics_1_0']);
 const data=()=>clone({measures:e.measures.value,repeats:e.repeats.value,key:e.key.value,scale:e.scaleType.value,groove:e.globalGroove.value,obligado:e.globalShowObligado.value,subdivisions:e.globalShowSubdivisions.value,ties:[...e.tiedSlots.value],lyricsTies:[...e.lyricsTiedSlots.value]});
 const before=data();const history=e.undoStack.value.length;
 e.setPlan('FREE');await nextTick();assert.deepEqual(data(),before);checks++;
 e.setPlan('PRO');await nextTick();assert.deepEqual(data(),before);checks++;
 assert.equal(e.undoStack.value.length,history);checks++;
 const seq=buildExpandedSequence(e.measures.value,e.repeats.value);
 assert.deepEqual(seq.slice(0,13).map(m=>m.originalMeasureIndex),[0,1,2,3,0,1,2,3,0,1,2,4,5]);checks++;
 const simple={type:'simple',startMeasure:1,endMeasure:4,times:2};
 assert.deepEqual(buildExpandedSequence(e.measures.value,[simple]).slice(0,9).map(m=>m.originalMeasureIndex),[0,1,2,3,0,1,2,3,4]);checks++;
 for(const times of [Infinity,-Infinity,NaN,0,1,2.5,1e12]){assert.throws(()=>buildExpandedSequence(e.measures.value,[{...simple,times}]),RangeError);checks++;}
 for(const extra of [{type:'unknown'},{startMeasure:0},{endMeasure:-1},{startMeasure:25},{type:'casilla',casilla1Start:1,casilla2Start:3,casilla2End:4}]){assert.throws(()=>buildExpandedSequence(e.measures.value,[{...simple,...extra}]),RangeError);checks++;}
 assert.equal(buildExpandedSequence(e.measures.value.slice(0,1),[{...simple,endMeasure:1,times:MAX_EXPANDED_MEASURES}]).length,MAX_EXPANDED_MEASURES);checks++;
 assert.throws(()=>buildExpandedSequence(e.measures.value,[{...simple,endMeasure:24,times:500}]),RangeError);checks++;
 e.selectedRangeStart.value=0;e.selectedRangeEnd.value=3;
 for(const times of [Infinity,2.5,1e12]){
  const snapshot=data(),undoLength=e.undoStack.value.length;e.confirmTimes(times);await nextTick();assert.deepEqual(data(),snapshot);assert.equal(e.undoStack.value.length,undoLength);checks+=2;
 }
 e.confirmTimes(2);await nextTick();assert.equal(e.repeats.value.find(r=>r.startMeasure===1).times,2);checks++;
 e.undo();await nextTick();assert.deepEqual(clone(e.repeats.value),before.repeats);checks++;
 // Expanded export must use the sequence even while editor view is compact.
 assert.equal(e.viewMode.value,'compact');assert.equal(buildExpandedSequence(e.measuresWithKey.value,e.repeats.value).length,31);checks+=2;
 const originalSave=jsPDF.API.save;
 let exported;
 try {
  jsPDF.API.save=function(){exported=this.output();return this};
  e.selectedPdfExportOption.value='chords-only-expanded';e.confirmExportPdf();
  // This fixture has one Am per measure, including every expanded repeat.
  assert.equal((exported.match(/\(Am\)/g)||[]).length,31);checks++;
  fs.writeFileSync('/private/tmp/hg-expanded-export.pdf',exported,'binary');
 } finally {if(originalSave)jsPDF.API.save=originalSave;else delete jsPDF.API.save}
 const projectBeforeInvalidSetup=data();e.configMeasuresCount.value=NaN;e.startProject();await nextTick();assert.deepEqual(data(),projectBeforeInvalidSetup);checks++;
 e.measures.value=richSong(999);e.repeats.value=[];await nextTick();
 const atLimit=clone(e.measures.value),atLimitHistory=e.undoStack.value.length;
 e.addMeasure();await nextTick();assert.deepEqual(clone(e.measures.value),atLimit);assert.equal(e.undoStack.value.length,atLimitHistory);checks+=2;
 e.copiedMeasures.value=richSong(2);e.selectedRangeStart.value=998;e.selectedRangeEnd.value=998;e.pasteCopiedMeasures();await nextTick();assert.deepEqual(clone(e.measures.value),atLimit);assert.equal(e.undoStack.value.length,atLimitHistory);checks+=2;
 e.repeats.value=[{id:'last',type:'simple',startMeasure:999,endMeasure:999,times:2}];e.convertRepeatToCasilla();await nextTick();assert.equal(e.repeats.value[0].type,'simple');assert.equal(e.measures.value.length,999);assert.equal(e.undoStack.value.length,atLimitHistory);checks+=3;
 // Compare valid repeats against the previously implemented musical ordering.
 if(process.env.HG_COMPARE_SOURCE){
  const baseline=await createEditor(process.env.HG_COMPARE_SOURCE);
  try{for(const count of [1,5,24])for(const times of [2,3,8]){
   const song=richSong(count);
   for(const repeats of [[],[{type:'simple',startMeasure:1,endMeasure:count,times}],...(count>1?[[{type:'casilla',startMeasure:1,endMeasure:count-1,casilla1Start:count-1,casilla2Start:count,casilla2End:count,times}]]:[])]){
    assert.deepEqual(buildExpandedSequence(song,repeats),baseline.editor.buildExpandedSequence(song,repeats));checks++;
   }
  }}finally{baseline.stop()}
 }
 console.log(`${checks} project-preservation and repeat-safety checks passed`);
}finally{h.stop()}
