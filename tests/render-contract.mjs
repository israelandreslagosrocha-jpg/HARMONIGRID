import assert from 'node:assert/strict';
import {nextTick} from 'vue';
import {createEditor,richSong,clone} from './component-harness.mjs';
const baseline=process.env.HG_COMPARE_SOURCE;
const handles=[await createEditor(),...(baseline?[await createEditor(baseline)]:[])];
let checks=0;
try{
 for(const {editor:e} of handles){e.currentPlan.value='PRO';e.measures.value=richSong(24);e.showLyricsGlobal.value=true;}
 await nextTick();
 const compare=()=>{
  for(const {editor:e} of handles){
   if(!e.tiedSlots.value.size)for(const m of e.displayedMeasures.value){assert.deepEqual(e.getMeasureTiesPaths(m),[]);checks++;}
   if(!e.lyricsTiedSlots.value.size)for(const m of e.displayedMeasures.value){assert.deepEqual(e.getMeasureLyricsTiesPaths(m),[]);checks++;}
  }
  if(handles.length===2){const [a,b]=handles.map(h=>h.editor);assert.deepEqual(clone(a.systems.value),clone(b.systems.value));checks++;
   for(let i=0;i<a.displayedMeasures.value.length;i++)for(const name of ['getMeasureTiesPaths','getMeasureLyricsTiesPaths','getMergedBeats','getLyricsMergedBeats']){assert.deepEqual(clone(a[name](a.displayedMeasures.value[i])),clone(b[name](b.displayedMeasures.value[i])));checks++;}
  }
 };
 compare();
 if(handles.length===2){const [a,b]=handles.map(h=>h.editor);for(const id of ['0_0_0','0_0_1','1_0','missing']){assert.equal(a.isSlotTiedToNext(id),b.isSlotTiedToNext(id));checks++;}for(const id of ['lyrics_0_0','lyrics_1_0','missing']){assert.equal(a.isLyricsNextSlotTied(id),b.isLyricsNextSlotTied(id));checks++;}}
 for(const {editor:e} of handles){e.measures.value[0].lyrics.mode='rhythm';e.measures.value[0].beats[3].root='C';e.measures.value[1].showSubdivisions=false;e.measures.value[1].beats[0].harmonicRhythm='quarter';}
 await nextTick();
 for(const {editor:e} of handles){e.tiedSlots.value=new Set(['1_0']);e.lyricsTiedSlots.value=new Set(['lyrics_1_0']);}
 await nextTick();compare();
 for(const {editor:e} of handles){
  assert(e.getMeasureTiesPaths(e.displayedMeasures.value[0]).some(p=>p.type==='outgoing'));checks++;
  assert(e.getMeasureTiesPaths(e.displayedMeasures.value[1]).some(p=>p.type==='incoming'));checks++;
  assert(e.getMeasureLyricsTiesPaths(e.displayedMeasures.value[0]).some(p=>p.type==='outgoing'));checks++;
  assert(e.getMeasureLyricsTiesPaths(e.displayedMeasures.value[1]).some(p=>p.type==='incoming'));checks++;
 }
 for(const {editor:e} of handles){e.repeats.value=[{type:'simple',startMeasure:1,endMeasure:4,times:3}];e.viewMode.value='expanded';e.notationMode.value='roman';e.windowWidth.value=390;}
 await nextTick();compare();
 for(const {editor:e} of handles){e.tiedSlots.value=new Set();e.lyricsTiedSlots.value=new Set();e.viewMode.value='compact';}
 await nextTick();compare();
 console.log(`${checks} rendering/ties contract checks passed`);
}finally{for(const h of handles)h.stop()}
