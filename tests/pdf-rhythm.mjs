import assert from 'node:assert/strict'
import {buildRhythmEvents,positionRhythmEvents,drawRhythmVoice,createRhythmTimeGrid,splitPdfChord} from '../src/core/pdfRhythm.js'
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

const grid=createRhythmTimeGrid([{start:0,labelWidth:14},{start:.25,labelWidth:12},{start:.5,labelWidth:11},{start:.75,labelWidth:10},{start:1,labelWidth:3}],20,80,4)
const gridNotes=positionRhythmEvents([{start:0},{start:.25},{start:.5},{start:.75}],20,80,4,grid)
const gridHarmony=positionRhythmEvents([{start:0},{start:.5}],20,80,4,grid)
assert.equal(gridNotes[0].x,gridHarmony[0].x)
assert.equal(gridNotes[2].x,gridHarmony[1].x)
assert.ok(gridNotes[1].x-gridNotes[0].x>=14,'Text spacing expands the shared grid')
const tuplets=[{start:0,duration:1/3,tuplet:3,beatIndex:0},{start:1/3,duration:1/3,tuplet:3,beatIndex:0},{start:2/3,duration:1/3,tuplet:3,beatIndex:0},...Array.from({length:5},(_,i)=>({start:1+i/5,duration:1/5,tuplet:5,beatIndex:1}))]
calls.length=0
drawRhythmVoice(doc,positionRhythmEvents(tuplets,20,80,4),40,{grouping:[4],unit:4})
assert.deepEqual(calls.filter(c=>c[0]==='text').map(c=>c[1]),['3','5'],'Adjacent tuplets retain separate numbers and beams')
console.log('Shared text-aware grid and separate triplet/quintuplet groups passed')

assert.deepEqual(splitPdfChord('G6/9/B'),{main:'G6/9',bass:'/B'})
assert.deepEqual(splitPdfChord('Ebm6/9/Gb'),{main:'Ebm6/9',bass:'/Gb'})
assert.deepEqual(splitPdfChord('C6/9'),{main:'C6/9',bass:''})
assert.deepEqual(splitPdfChord('F#7(b9, #9, b13)/A#'),{main:'F#7(b9, #9, b13)',bass:'/A#'})
const doubleBeams=calls.filter(c=>c[0]==='line'&&c[2]===34.1&&c[4]===34.1)
assert.equal(doubleBeams.length,1,'Five sixteenths in a quarter retain two beam levels')
console.log('Complex slash chords and quintuplet written-value beams passed')
