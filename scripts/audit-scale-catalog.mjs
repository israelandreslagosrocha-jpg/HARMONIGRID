import {SCALES,getScaleNotes,getScaleDegreeLabels} from '../src/core/scales.js'
import {CHORD_TYPE_INTERVALS} from '../src/core/audio.js'
const rows=Object.entries(SCALES).map(([id,scale])=>{
 const tertianMismatches=[],externalChordTones=[]
 scale.degrees.forEach((degree,i)=>{
  for(const kind of ['triad','tetrad']) {
   const intervals=CHORD_TYPE_INTERVALS[degree[kind]]
   if(!intervals)return
   const external=intervals.filter(n=>!scale.intervals.includes((scale.intervals[i]+n)%12))
   if(external.length)externalChordTones.push({degree:i+1,kind,type:degree[kind],externalIntervals:external})
   if(scale.intervals.length===7) {
    const stacked=Array.from({length:kind==='triad'?3:4},(_,j)=>(scale.intervals[(i+2*j)%7]-scale.intervals[i]+12)%12)
    if(JSON.stringify(intervals)!==JSON.stringify(stacked))tertianMismatches.push({degree:i+1,kind,offered:degree[kind],actualIntervals:stacked})
   }
  }
 })
 return{id,name:scale.name,isPro:scale.isPro,intervals:scale.intervals,formula:scale.formula,notesC:getScaleNotes('C',id),degreeLabelsC:getScaleDegreeLabels('C',id),explanation:scale.explanation,tertianMismatches,externalChordTones,status:tertianMismatches.length||externalChordTones.length?'needs-harmonic-review':'structural-check-passed'}
})
console.log(JSON.stringify({scope:'Structural audit, not pedagogical certification. Non-heptatonic compatibility tables are not necessarily tertian harmonizations.',scales:rows},null,2))
