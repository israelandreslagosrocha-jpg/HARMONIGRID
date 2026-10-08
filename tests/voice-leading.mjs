import assert from 'node:assert/strict'
import {getRootPositionMidi,getVoiceLedMidi} from '../src/core/audio.js'
const pc = notes => notes.map(n => (n % 12 + 12) % 12).sort((a,b)=>a-b)
assert.deepEqual(getVoiceLedMidi({root:'F',type:'maj'},[60,64,67]),[60,65,69])
assert.deepEqual(getVoiceLedMidi({root:'G',type:'maj'},[60,64,67]),[59,62,67])
assert.deepEqual(getVoiceLedMidi({root:'C',type:'maj'},[60,64,67]),[60,64,67])
// Independent exhaustive oracle for every three-voice target in the MIDI window.
let checked = 0
for (const root of ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']) {
 for (const type of ['maj','min','dim','aug','sus2','sus4']) {
  const chord={root,type},previous=[60,64,67],target=getRootPositionMidi(chord)
  const actual=getVoiceLedMidi(chord,previous)
  assert.deepEqual(pc(actual),pc(target))
  const tones=pc(target).join(','); let minimum=Infinity
  for(let a=48;a<=79;a++)for(let b=a+1;b<=79;b++)for(let c=b+1;c<=79;c++) {
   if(pc([a,b,c]).join(',')===tones)minimum=Math.min(minimum,Math.abs(a-60)+Math.abs(b-64)+Math.abs(c-67))
  }
  assert.equal(actual.reduce((sum,n,i)=>sum+Math.abs(n-previous[i]),0),minimum)
  checked++
 }
}
for (const chord of [
 {root:'G',type:'7',bass:'B'}, {root:'Db',type:'maj7',tensions:['9','#11']},
 {root:'E',type:'7',tensions:['b9','#9','b13']}, {root:'C',type:'69'},
 {root:'F',type:'m7b5'}, {root:'C',type:'maj7',tensions:['omit3']}
]) {
 const before=JSON.stringify(chord),previous=[48,60,64,67],copy=[...previous]
 const fundamental=getRootPositionMidi(chord)
 const voiced=getVoiceLedMidi(chord,previous)
 assert.deepEqual(pc(voiced),pc(fundamental))
 assert.ok(voiced.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=127&&(!i||n>voiced[i-1])))
 if(chord.bass)assert.equal(voiced[0],fundamental[0])
 assert.equal(JSON.stringify(chord),before);assert.deepEqual(previous,copy)
 assert.deepEqual(getVoiceLedMidi(chord,[]),fundamental)
}
// Explicit voicing without continuity remains unchanged.
assert.deepEqual(getRootPositionMidi({root:'C',type:'maj'},'inversion1'),[64,67,72])
assert.deepEqual(getRootPositionMidi({root:'C',type:'maj'}),[60,64,67])
console.log(`Voice leading: ${checked} exhaustive minimum-motion cases, common tones, slash bass, extensions and preservation passed`)
