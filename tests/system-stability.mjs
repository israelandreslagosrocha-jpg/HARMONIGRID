// Verify reactive row stability and compare actual grouping with the old engine.
import assert from 'node:assert/strict'
import {nextTick,watch} from 'vue'
import {createEditor,richSong,clone} from './component-harness.mjs'
const handles=[await createEditor(),...(process.env.HG_COMPARE_SOURCE?[await createEditor(process.env.HG_COMPARE_SOURCE)]:[])]
let checks=0
const equal=(a,b)=>{assert.deepEqual(a,b);checks++}
try {
  for(const {editor:e} of handles){
    e.setPlan('PRO');e.windowWidth.value=1471
    e.measures.value=richSong(100).map(m=>({...m,showSubdivisions:false,lyrics:{...m.lyrics,rawText:'',lastText:'',mode:'free',anchors:[]},beats:m.beats.map(b=>({...b,root:'C',type:'maj',harmonicRhythm:'quarter',subdivisions:[]}))}))
  }
  await nextTick()
  const e=handles[0].editor,before=e.systems.value
  const originalWidth=e.getMeasureMinWidth(e.displayedMeasures.value[0])
  let notifications=0
  const stop=watch(e.systems,()=>notifications++)
  let oldNotifications=0
  const oldStop=handles[1]?watch(handles[1].editor.systems,()=>oldNotifications++):()=>{}
  for(const {editor:s} of handles){s.measures.value[0].beats[0].root='D';s.measures.value[0].beats[0].type='maj7'}
  await nextTick()
  assert.ok(e.getMeasureMinWidth(e.displayedMeasures.value[0])>originalWidth);checks++
  assert.equal(e.systems.value,before);checks++
  equal(notifications,0)
  equal(e.systems.value[0].measures[0].beats[0].root,'D')
  equal(e.systems.value[0].measures[0].beats[0].type,'maj7')
  stop();oldStop()
  if(handles[1]){assert.ok(oldNotifications>0);checks++}
  const compare=()=>{
    const flattened=e.systems.value.flatMap(row=>row.measures)
    equal(flattened.length,e.displayedMeasures.value.length)
    equal(flattened.map(m=>m.displayedMeasureIndex),e.displayedMeasures.value.map(m=>m.displayedMeasureIndex))
    if(handles.length===2){
      const grouping=s=>s.systems.value.map(row=>({id:row.id,measures:row.measures.map(m=>({id:m.id,original:m.originalMeasureIndex,displayed:m.displayedMeasureIndex,key:m.activeKey,scale:m.activeScale,meter:m.activeTimeSignature,grouping:m.activeGrouping}))}))
      equal(clone(grouping(e)),clone(grouping(handles[1].editor)))
    }
  }
  compare()
  // Width-changing harmony, manual breaks, meter/key changes and insertions
  // must still trigger reflow; identity reuse cannot freeze the score layout.
  const actions=[
    s=>{s.measures.value[0].beats[1].root='C#';s.measures.value[0].beats[1].type='maj7';s.measures.value[0].beats[1].tensions=['#11','13']},
    s=>{s.measures.value[2].systemBreak=true},
    s=>{s.measures.value[4].timeSignature={beats:3,unit:4}},
    s=>{s.measures.value[5].keyChange={key:'D',scaleType:'dorian'}},
    s=>{s.measures.value[1].lyrics.rawText='Una letra considerablemente más larga';s.measures.value[1].lyrics.mode='synced'},
    s=>{s.defaultMeasuresPerSystem.value=2},
    s=>{s.windowWidth.value=390},
    s=>{s.notationMode.value='roman'},
    s=>{s.repeats.value=[{type:'simple',startMeasure:1,endMeasure:4,times:3}];s.viewMode.value='expanded'},
    s=>{s.viewMode.value='compact';s.measures.value.splice(8,1)},
    s=>{s.measures.value.push({...richSong(1)[0],id:'inserted',beats:richSong(1)[0].beats.map((b,i)=>({...b,id:`inserted-${i}`}))})},
    s=>{s.undoStack.value=[];s.saveHistory();s.measures.value[0].beats[0].root='F';s.undo()},
    s=>{s.setPlan('FREE')},
  ]
  for(const action of actions){for(const {editor:s} of handles)action(s);await nextTick();compare()}
  console.log(`${checks} row-stability, live-edit, reflow, mobile, repeats and undo checks passed`)
}finally{for(const h of handles)h.stop()}
