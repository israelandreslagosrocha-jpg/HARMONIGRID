import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {createEditor,richSong,clone} from './component-harness.mjs'
import {applySuggestion} from '../src/core/suggestions.js'
import {pasteInternalTies} from '../src/core/copyMeasures.js'
import {validateProjectDocument} from '../src/core/projectDocument.js'
let checks=0
const same=(a,b)=>{assert.deepEqual(a,b);checks++}
const song=richSong(4)
song[0].beats[0].mutedNotes=['E'];song[0].beats[0].subdivisions[0].mutedNotes=['G']
const before=clone(song),out=applySuggestion(song,[{measureIndex:0,beatIndex:0,chord:{root:'F',type:'maj',tensions:['9','9']}}])
same(song,before);same(out[0].beats[0].id,before[0].beats[0].id);same(out[0].beats[0].harmonicRhythm,'eighth');same(out[0].beats[0].mutedNotes,['E'])
same(out[0].beats[0].subdivisions[0].id,before[0].beats[0].subdivisions[0].id);same(out[0].beats[0].subdivisions[0].root,'F');same(out[0].beats[0].subdivisions[0].mutedNotes,['G']);same(out[0].beats[0].subdivisions[1],before[0].beats[0].subdivisions[1]);same(out[0].lyrics,before[0].lyrics);same(out[0].beats[0].tensions,['9']);same(out.slice(1),before.slice(1))
same([...pasteInternalTies(new Set(['8_1','4_2']),['0_0','0_0_1','1_0'],[0,1],4,2)],['8_1','4_0_1','5_0'])
const h=await createEditor(),e=h.editor
try {
 e.setPlan('PRO');e.measures.value=richSong(8);e.title.value='Copia segura'
 e.measures.value[0].groove='custom';e.measures.value[0].systemBreak=true
 await nextTick()
 e.tiedSlots.value=new Set(['0_0_1']);e.lyricsTiedSlots.value=new Set([])
 const initial=clone(e.cloudDocument.value)
 e.selectedRangeStart.value=0;e.selectedRangeEnd.value=1;e.copySelectedMeasures()
 const clipboard=clone(e.copiedMeasures.value)
 e.selectedRangeStart.value=4;e.selectedRangeEnd.value=5;e.pasteCopiedMeasures();await nextTick()
 const first=clone(e.measures.value[4]);same(first.id,initial.measures[4].id);same(first.groove,'custom');same(first.systemBreak,true)
 same(first.lyrics.rawText,initial.measures[0].lyrics.rawText)
 same(first.lyrics.anchors[0].chordId,first.beats[0].id)
 assert.notEqual(first.beats[0].id,e.measures.value[0].beats[0].id);checks++
 assert.notEqual(first.beats[0].subdivisions[0].id,e.measures.value[0].beats[0].subdivisions[0].id);checks++
 same(e.copiedMeasures.value,clipboard)
 assert.ok(e.measures.value[5].lyrics.syllables.filter(s=>s.rhythmEventId).every(s=>s.rhythmEventId.startsWith('lyrics_5_')));checks++
 e.selectedRangeStart.value=6;e.selectedRangeEnd.value=7;e.pasteCopiedMeasures();await nextTick()
 assert.notEqual(e.measures.value[6].beats[0].id,first.beats[0].id);checks++
 const ids=e.measures.value.flatMap(m=>m.beats.flatMap(b=>[b.id,...(b.subdivisions||[]).map(s=>s.id)]))
 same(new Set(ids).size,ids.length)
 const saved=validateProjectDocument(e.cloudDocument.value);e.hydrateProjectDocument(saved);await nextTick();same(clone(e.cloudDocument.value),saved)
 e.undo();await nextTick() // Hydration intentionally resets history.
 same(e.undoStack.value.length,0)
 e.hydrateProjectDocument(initial);await nextTick();e.selectedRangeStart.value=0;e.selectedRangeEnd.value=1;e.copySelectedMeasures();e.selectedRangeStart.value=4;e.selectedRangeEnd.value=5;e.pasteCopiedMeasures();await nextTick();e.undo();await nextTick();same(clone(e.cloudDocument.value),initial)
}finally{h.stop()}
console.log(`${checks} non-destructive suggestion, copying, links, roundtrip and undo checks passed`)
