// Exercise actual watcher subscriptions with a spy instead of DOM geometry.
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {createEditor,richSong} from './component-harness.mjs'
const transformSource=source=>source
 .replace('let connectorUpdateTimer = null','let connectorUpdateTimer = null;const connectorSignals={calls:0}')
 .replace(/function updateConnectors\(\) \{[\s\S]*?\n\}\nconst getLyricsActiveChord/, 'function updateConnectors(){connectorSignals.calls++}\nconst getLyricsActiveChord')
const h=await createEditor(undefined,{transformSource}),e=h.editor
let checks=0
try {
 e.setPlan('PRO');e.measures.value=richSong(24);e.showLyricsGlobal.value=true
 await nextTick();void e.systems.value
 const actions=[
  s=>{s.measures.value[0].beats[0].root='D'},
  s=>{s.measures.value[2].lyrics.rawText='Can-ción con nue-va le-tra'},
  s=>{s.measures.value[2].lyrics.anchors.push({chordId:'b2_1',start:8,end:10})},
  s=>{s.measures.value[0].beats[1].harmonicRhythm='eighth'},
  s=>{s.measures.value[1].timeSignature={beats:3,unit:4}},
  s=>{s.measures.value[1].systemBreak=true},
  s=>{s.notationMode.value='roman'},
  s=>{s.viewMode.value='expanded'},
  s=>{s.defaultMeasuresPerSystem.value=2},
  s=>{s.globalShowObligado.value=true},
  s=>{s.globalShowSubdivisions.value=true},
  s=>{s.globalGroove.value='Bossa'},
  s=>{s.hoveredChordId.value='b2_0'},
  s=>{s.showLyricsGlobal.value=false},
 ]
 for(const action of actions){e.connectorSignals.calls=0;action(e);await nextTick();assert.ok(e.connectorSignals.calls>0,'Connector refresh must survive every supported edit/presentation change');checks++}
 console.log(`${checks} connector scheduling checks passed for nested edits, anchors, reflow and global presentation; DOM geometry requires browser verification`)
}finally{h.stop()}
