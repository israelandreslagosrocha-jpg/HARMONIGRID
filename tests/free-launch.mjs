import assert from 'node:assert/strict'
import {createEditor} from './component-harness.mjs'
import {SCALES} from '../src/core/scales.js'
const {editor:s,stop}=await createEditor(undefined,{freeLaunch:true});let checks=0
const same=(actual,expected)=>{assert.deepEqual(actual,expected);checks++}
try{
 same(s.isFreeLaunch,true);s.setPlan('PRO');same(s.currentPlan.value,'FREE')
 const offered=s.groupedScales.value.flatMap(group=>group.items.map(scale=>scale.id))
 same(offered,Object.entries(SCALES).filter(([,scale])=>!scale.isPro).map(([id])=>id))
 s.configMeasuresCount.value=20;s.startProject();same(s.measures.value.length,20)
 const before=JSON.stringify(s.measures.value);s.addMeasure();same(JSON.stringify(s.measures.value),before)
 for(const option of ['chords-only-expanded','chords-and-lyrics-rhythm','chords-and-lyrics-synced']){
  s.selectedPdfExportOption.value=option
  if(s.isProOptionSelected.value){s.exportPdf();same(s.selectedPdfExportOption.value,'chords-only')}
 }
 s.selectedPdfExportOption.value='chords-only-expanded';s.confirmExportPdf();same(s.selectedPdfExportOption.value,'chords-only');same(JSON.stringify(s.measures.value),before)
 s.configMeasuresCount.value=21;s.startProject();same(s.measures.value.length,20)
 console.log(`${checks} public FREE launch, advanced activation, scale availability, export and preservation checks passed`)
}finally{stop()}
