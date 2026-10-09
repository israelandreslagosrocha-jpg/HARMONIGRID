import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {createEditor,clone} from './component-harness.mjs'
const {editor:e,stop}=await createEditor(undefined,{freeLaunch:true})
let checks=0
const eq=(a,b)=>{assert.deepEqual(a,b);checks++}
try {
 e.windowWidth.value=390;e.configMeasuresCount.value=8;e.startProject();await nextTick()
 const document=clone(e.cloudDocument.value)
 e.mobileFocusedIndex.value=2;e.toggleSelectionMode();eq(e.mobileFocusedIndex.value,null)
 e.selectMobileMeasure(5);await nextTick();eq([e.minSelectedMeasure.value,e.maxSelectedMeasure.value],[6,6])
 e.selectMobileMeasure(1);await nextTick();eq([e.minSelectedMeasure.value,e.maxSelectedMeasure.value],[2,6])
 eq([e.mobileRangeFrom.value,e.mobileRangeTo.value],[2,6]);eq(e.mobileRangeAnchor.value,null)
 e.copySelectedMeasures();eq(e.copiedMeasureIndexes.value,[1,2,3,4,5]);eq(e.copiedMeasures.value.length,5)
 eq(clone(e.cloudDocument.value),document)
 e.selectMobileMeasure(3);e.selectMobileMeasure(3);await nextTick();eq([e.minSelectedMeasure.value,e.maxSelectedMeasure.value],[4,4])
 for(const [from,to] of [['',2],[0,2],[1,9],[1.5,3],['abc',2]]) {
  e.mobileRangeFrom.value=from;e.mobileRangeTo.value=to;eq(e.applyMobileRange(),false)
  eq([e.minSelectedMeasure.value,e.maxSelectedMeasure.value],[4,4])
 }
 e.mobileRangeFrom.value=7;e.mobileRangeTo.value=2;eq(e.applyMobileRange(),true);await nextTick()
 eq([e.minSelectedMeasure.value,e.maxSelectedMeasure.value],[2,7]);eq([e.mobileRangeFrom.value,e.mobileRangeTo.value],[2,7])
 e.selectMobileMeasure(-1);e.selectMobileMeasure(8);eq([e.minSelectedMeasure.value,e.maxSelectedMeasure.value],[2,7])
 eq(clone(e.cloudDocument.value),document)
 e.confirmTimes(2);await nextTick();eq(e.repeats.value.map(r=>[r.startMeasure,r.endMeasure,r.times]),[[2,7,2]])
 eq(clone(e.measures.value),document.measures);eq(e.isSelectionMode.value,false);eq(e.mobileRangeAnchor.value,null)
 e.toggleSelectionMode();e.mobileRangeFrom.value=1;e.mobileRangeTo.value=1;e.applyMobileRange();e.clearSelection();await nextTick()
 eq([e.mobileRangeFrom.value,e.mobileRangeTo.value],['','']);eq(e.selectedRangeStart.value,null)
 console.log(`${checks} mobile typed/touch range, original indices, copy, repeat, rejection and document preservation checks passed`)
}finally{stop()}
