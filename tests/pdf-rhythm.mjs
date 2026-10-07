import assert from 'node:assert/strict'
import {buildRhythmEvents,positionRhythmEvents,drawRhythmVoice} from '../src/core/pdfRhythm.js'
const states=[{beat:{},durationSlots:1},{beat:{},durationSlots:1}]
const options={unit:4,measureIndex:0,rhythmFor:()=> 'sixteenth',slotsFor:()=>[{},{isMerged:true},{},{}],syllableFor:()=>null}
const events=buildRhythmEvents(states,options)
assert.deepEqual(events.map(e=>e.start),[0,.5,.75,1,1.5,1.75])
assert.deepEqual(events.map(e=>e.duration),[.5,.25,.25,.5,.25,.25])
const vocal=buildRhythmEvents([{beat:{},durationSlots:2},{isMerged:true}],{...options,lyrics:true,rhythmFor:()=> 'double',slotsFor:()=>[]})
assert.equal(vocal[0].duration,2)
const pos=positionRhythmEvents(events,20,80,4),lyricsPos=positionRhythmEvents(vocal,20,80,4)
assert.equal(pos[0].x,lyricsPos[0].x,'Independent durations must share their onset')
assert.equal(positionRhythmEvents([{start:1}],20,80,4)[0].x,42.5)
const compound=buildRhythmEvents(states,{...options,unit:8,rhythmFor:()=> 'eighth',slotsFor:()=>[]})
assert.deepEqual(compound.map(e=>e.duration),[.5,.5])
const calls=[]
const doc=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args])})
drawRhythmVoice(doc,positionRhythmEvents(events,20,80,4),40,{slash:true,grouping:[1,1,1,1]})
const beams=calls.filter(c=>c[0]==='line'&&c[2]===47&&c[4]===47)
assert.equal(beams.length,2,'Beam groups must stop at denominator beat boundaries')
assert.equal(calls.filter(c=>c[0]==='circle').length,0,'Merged eighths must not acquire an augmentation dot')
const original=JSON.stringify(states)
buildRhythmEvents(states,options)
assert.equal(JSON.stringify(states),original)
console.log('PDF rhythm: temporal alignment, merged durations, compound meter, slash heads and beam boundaries passed')
