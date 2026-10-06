import assert from 'node:assert/strict'
import {SCALES,getScaleNotes,getDiatonicChords,getScaleDegreeLabels} from '../src/core/scales.js'
import {NOTE_TO_INDEX,transposeNote,CHROMATIC_NOTES_SHARP,CHROMATIC_NOTES_FLAT} from '../src/core/notes.js'
import {CHORD_TYPE_INTERVALS,getRootPositionMidi} from '../src/core/audio.js'
import {getChordNotes,analyzeModulationRelationship} from '../src/core/suggestions.js'
let checks=0
const same=(a,b)=>{assert.deepEqual(a,b);checks++}
// Independently specified parent collections; modal rotations must match exactly.
const families=[
 [[0,2,4,5,7,9,11],['major','dorian','phrygian','lydian','mixolydian','minor','locrian']],
 [[0,2,3,5,7,8,11],['harmonic_minor','locrian_sharp6','ionian_sharp5','dorian_sharp4','phrygian_dominant','lydian_sharp2','ultralocrian']],
 [[0,2,3,5,7,9,11],['melodic_minor','dorian_flat2','lydian_augmented','lydian_dominant','mixolydian_flat6','locrian_sharp2','altered']]
]
for(const [parent,ids]of families)ids.forEach((id,i)=>same(SCALES[id].intervals,parent.map((_,j)=>(parent[(i+j)%7]-parent[i]+12)%12)))
const bases={C:0,D:2,E:4,F:5,G:7,A:9,B:11}
const pitch=note=>{const [,letter,accidental]=/^([A-G])([#b]*)$/.exec(note);return(bases[letter]+[...accidental].reduce((n,a)=>n+(a==='#'?1:-1),0)+24)%12}
const keys=[...new Set([...CHROMATIC_NOTES_SHARP,...CHROMATIC_NOTES_FLAT])]
for(const[id,scale]of Object.entries(SCALES)) {
 const steps=scale.formula.split('–').map(x=>({'T':2,'S':1,'1.5T':3}[x.trim()]))
 same(steps,scale.intervals.map((n,i)=>(i+1<scale.intervals.length?scale.intervals[i+1]:12)-n))
 for(const key of keys) {
  const notes=getScaleNotes(key,id);same(notes.length,scale.intervals.length)
  notes.forEach((note,i)=>{same(pitch(note),(pitch(key)+scale.intervals[i])%12);same(NOTE_TO_INDEX[note],pitch(note));same(transposeNote(note,12,key),transposeNote(note,0,key))})
  for(const complexity of ['triad','tetrad'])for(const chord of getDiatonicChords(key,id,complexity)) {
   const midi=getRootPositionMidi(chord);same(midi.length,CHORD_TYPE_INTERVALS[chord.type].length)
   same(midi.map(n=>(n-pitch(chord.root)+12)%12),CHORD_TYPE_INTERVALS[chord.type].map(n=>n%12))
  }
 }
}
// True tertian harmonizations, not parent-scale compatibility tables.
for(const id of [...families.flatMap(([,ids])=>ids),'harmonic_major']) {
 const scale=SCALES[id]
 for(let i=0;i<7;i++)for(const [kind,count]of [['triad',3],['tetrad',4]])same(CHORD_TYPE_INTERVALS[scale.degrees[i][kind]],Array.from({length:count},(_,j)=>(scale.intervals[(i+2*j)%7]-scale.intervals[i]+12)%12))
}
same(getScaleNotes('C#','major'),['C#','D#','E#','F#','G#','A#','B#'])
same(getRootPositionMidi({root:'E#',type:'maj'}),getRootPositionMidi({root:'F',type:'maj'}))
same(getRootPositionMidi({root:'Cb',type:'maj',bass:'Ebb'}),getRootPositionMidi({root:'B',type:'maj',bass:'D'}))
same(getChordNotes('C','aug','C').fifth,'G#')
same(getChordNotes('C','sus4','C').fourth,'F')
same(getChordNotes('C','sus2','C').second,'D')
same(getChordNotes('C','69','C').sixth,'A')
same(getChordNotes('C','69','C').ninth,'D')
same(analyzeModulationRelationship('C','major','A','minor').type,'Relativa')
same(analyzeModulationRelationship('C','major','D','dorian').type,'Modos relativos')
same(analyzeModulationRelationship('C','major','C','harmonic_minor').type,'Tonalidad Paralela')
assert.notEqual(analyzeModulationRelationship('C','major','A','harmonic_minor').type,'Relativa');checks++
same(NOTE_TO_INDEX.constructor,undefined)
same(getScaleDegreeLabels('C','lydian'),['R','2','3','♯4','5','6','7'])
same(getScaleDegreeLabels('C','hungarian_major'),['R','♯2','3','♯4','5','6','♭7'])
same(getScaleDegreeLabels('C','ultralocrian'),['R','♭2','♭3','♭4','♭5','♭6','♭♭7'])
console.log(`${checks} music checks passed: 31 scales × 17 keys, formulas, modal families, audio, enharmonics and modulation`)
