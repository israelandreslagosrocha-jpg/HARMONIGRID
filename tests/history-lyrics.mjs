import assert from 'node:assert/strict';
import {nextTick} from 'vue';
import {createEditor,richSong,clone} from './component-harness.mjs';
const current=await createEditor();const s=current.editor;let checks=0;
s.setPlan('PRO');s.measures.value=richSong(12);await nextTick();
const first=clone(s.measures.value);s.saveHistory();s.measures.value[0].beats[0].root='D';await nextTick();s.saveHistory();
const second=clone(s.measures.value);
assert.equal(s.undoStack.value[0].measures[0].beats[0].root,'C');checks++;
assert.equal(s.undoStack.value[0].measures[5],s.undoStack.value[1].measures[5]);checks++;
assert.notEqual(s.undoStack.value[0].measures[0],s.undoStack.value[1].measures[0]);checks++;
s.measures.value[0].beats[0].root='E';await nextTick();s.undo();await nextTick();assert.deepEqual(clone(s.measures.value),second);checks++;
s.measures.value[1].lyrics.rawText='Otro texto';await nextTick();s.undo();await nextTick();assert.deepEqual(clone(s.measures.value),first);checks++;
// History limits and synchronous edits (before the next Vue flush).
s.measures.value=richSong(3);await nextTick();s.undoStack.value=[];
for(let i=0;i<55;i++){s.measures.value[0].beats[0].root=`root-${i}`;s.saveHistory();}
assert.equal(s.undoStack.value.length,50);checks++;
for(let i=54;i>=5;i--){s.undo();assert.equal(s.measures.value[0].beats[0].root,`root-${i}`);checks++;}
await nextTick();
// Empty rhythm text must settle, rather than repeatedly replace an empty array.
s.measures.value=richSong(3);s.measures.value[1].lyrics.rawText='';await nextTick();assert.equal(s.measures.value[1].lyrics.syllables.length,0);checks++;
s.measures.value[1].beats[0].type='7';await nextTick();assert.equal(s.measures.value[1].lyrics.syllables.length,0);checks++;
// Replaced/removed measures cannot retain live normalization subscriptions.
const removed=s.measures.value[1];s.measures.value.splice(1,1);await nextTick();removed.lyrics.rawText='retirado';await nextTick();assert.equal(removed.lyrics.lastText,'');checks++;
// Creating a tie must not immediately run the validator and remove a fused note.
s.measures.value=richSong(3);s.measures.value[0].beats.forEach(b=>{b.root='C';b.harmonicRhythm='quarter';b.subdivisions=[];});
await nextTick();s.selectedBeat.value={measureIndex:0,beatIndex:0};s.tiedSlots.value=new Set();
s.toggleTieActiveSlot();await nextTick();assert.equal(s.tiedSlots.value.has('0_1'),true);checks++;
current.stop();
// Optional side-by-side semantic comparison with the previous delivery.
if(process.env.HG_COMPARE_SOURCE){
 const old=await createEditor(process.env.HG_COMPARE_SOURCE);const now=await createEditor();
 const editors=[old.editor,now.editor];
 const normalized=value=>JSON.parse(JSON.stringify(value).replace(/"\d{13}-\d+"/g,'"generated-id"'));
 for(const e of editors){e.setPlan('PRO');e.measures.value=richSong(12);}await nextTick();
 const compare=()=>{
  assert.deepEqual(normalized(now.editor.measures.value),normalized(old.editor.measures.value));checks++;
  assert.deepEqual(normalized(now.editor.systems.value),normalized(old.editor.systems.value));checks++;
  for(let i=0;i<now.editor.measures.value.length;i++) for(let b=0;b<4;b++) {
    for(const sub of [null,0,1]) {
      assert.deepEqual(now.editor.getSyllableAtSlot(now.editor.measures.value[i],b,sub),old.editor.getSyllableAtSlot(old.editor.measures.value[i],b,sub));checks++;
    }
  }
};compare();
 for(const mutate of [
  e=>e.measures.value[1].lyrics.rawText='Mi can-ción nue-va',
  e=>e.measures.value[1].beats[0].subdivisions[1].isSilence=true,
  e=>e.windowWidth.value=390,
  e=>e.windowWidth.value=1200,
  e=>e.notationMode.value='roman',
  e=>e.notationMode.value='chords',
  e=>{e.repeats.value=[{type:'simple',startMeasure:1,endMeasure:4,times:3}];e.viewMode.value='expanded';},
  e=>e.viewMode.value='compact',
  e=>e.measures.value[2].beats[0].root='',
  e=>e.measures.value[1].timeSignature={beats:3,unit:4},
  e=>delete e.measures.value[1].timeSignature,
  e=>e.measures.value.reverse(),
  e=>e.measures.value.splice(3,1),
  e=>e.measures.value[0].lyrics.mode='synced',
  e=>{e.saveHistory();e.measures.value[0].lyrics.rawText='letra editada';},
  e=>e.undo(),
  e=>{e.lyricsTiedSlots.value=new Set(['lyrics_1_1']);e.syncRhythmLyricsTimeline(e.measures.value[1]);}
 ]) {for(const e of editors)mutate(e);await nextTick();compare();}
 for(const e of editors){e.measures.value=richSong(3);e.measures.value[2].lyrics.mode='rhythm';}await nextTick();
 for(const e of editors){e.measures.value[2].lyrics.syllables[0].rhythmEventId=null;e.lyricsTiedSlots.value=new Set(['lyrics_2_0']);}await nextTick();compare();
 assert.deepEqual(now.editor.getSyllableAtSlot(now.editor.measures.value[2],0,null),{text:'~',isRoot:false,tied:true});checks++;
 old.stop();now.stop();
}
console.log(`${checks} history/lyrics regression checks passed`);
