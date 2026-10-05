// Vue state + layout model only. No DOM, paint, physical device or backend load.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {nextTick} from 'vue';
import {createEditor,richSong} from './component-harness.mjs';
const instance=await createEditor(process.env.HG_SOURCE);const s=instance.editor;
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const results={environment:{node:process.version,mode:'Vue state and computed layout; no DOM; lyrics panel hidden'},trials:7,rows:[]};
s.setPlan('PRO');
for(const n of [20,100,300,999]){
 s.measures.value=richSong(n);s.undoStack.value=[];s.tiedSlots.value=new Set();s.lyricsTiedSlots.value=new Set();await nextTick();void s.systems.value;
 let t=performance.now();s.saveHistory();const firstSnapshotMs=performance.now()-t;
 const saves=[],edits=[],layouts=[];
 for(let i=0;i<7;i++){
  s.measures.value[0].beats[0].type=i%2?'maj':'maj7';await nextTick();void s.systems.value;
  t=performance.now();s.saveHistory();saves.push(performance.now()-t);
  t=performance.now();s.measures.value[0].beats[0].root=i%2?'C':'D';await nextTick();edits.push(performance.now()-t);
  t=performance.now();void s.systems.value;layouts.push(performance.now()-t);
 }
 const measures=new Set();for(const snapshot of s.undoStack.value)for(const m of snapshot.measures)measures.add(m);
 const uniqueSnapshotDataBytes=[...measures].reduce((total,m)=>total+Buffer.byteLength(JSON.stringify(m)),0);
 const fullCopyDataBytes=s.undoStack.value.reduce((total,snapshot)=>total+Buffer.byteLength(JSON.stringify(snapshot.measures)),0);
 const lyrics=[],rhythm=[];
 for(let i=0;i<7;i++){
  t=performance.now();s.measures.value[1].lyrics.rawText=i%2?'Mi can-ción nue-va':'La can-ción de hoy';await nextTick();void s.systems.value;lyrics.push(performance.now()-t);
  t=performance.now();s.measures.value[1].beats[0].harmonicRhythm=i%2?'eighth':'quarter';await nextTick();void s.systems.value;rhythm.push(performance.now()-t);
 }
 s.lyricsTiedSlots.value=new Set(['lyrics_1_1']);await nextTick();void s.systems.value;
 t=performance.now();s.measures.value[1].lyrics.rawText='Can-ción con li-ga-do';await nextTick();void s.systems.value;const tiedLyricsEditMs=performance.now()-t;
 results.rows.push({measures:n,firstSnapshotMs,medianRepeatedSnapshotMs:median(saves),medianChordEditFlushMs:median(edits),medianLayoutModelMs:median(layouts),medianChordEditIncludingLayoutMs:median(edits.map((e,i)=>e+layouts[i])),medianLyricsEditIncludingLayoutMs:median(lyrics),medianRhythmEditIncludingLayoutMs:median(rhythm),tiedLyricsEditMs,uniqueSnapshotMeasures:measures.size,uniqueSnapshotDataBytes,fullCopyDataBytes});
}
instance.stop();const out=process.env.HG_RESULTS||'docs/stabilization/editing-phase2.json';fs.writeFileSync(out,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
