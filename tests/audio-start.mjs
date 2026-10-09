import assert from 'node:assert/strict'
import {createEditor,richSong} from './component-harness.mjs'
let resolveResume, rejectResume, context, chords=0
const originalWindow=globalThis.window
const originalRAF=globalThis.requestAnimationFrame
const originalCancel=globalThis.cancelAnimationFrame
class Context {
 constructor(){this.state='suspended';this.currentTime=0;context=this}
 resume(){return new Promise((resolve,reject)=>{resolveResume=()=>{this.state='running';resolve()};rejectResume=reject})}
}
globalThis.requestAnimationFrame=()=>1
globalThis.cancelAnimationFrame=()=>{}
globalThis.__recordChord=()=>{assert.equal(context.state,'running');chords++}
const fixture=await createEditor(undefined,{freeLaunch:true,transformSource:source=>source.replace("import { playClick, playChordNotes, getVoiceLedMidi, getRootPositionMidi } from './core/audio.js'", "import { getVoiceLedMidi, getRootPositionMidi } from './core/audio.js'\nconst playClick = () => {}\nconst playChordNotes = () => globalThis.__recordChord()")})
globalThis.window={AudioContext:Context,innerWidth:390,addEventListener(){},removeEventListener(){}}
try {
 const e=fixture.editor;e.measures.value=richSong(2)
 let start=e.startPlayback()
 assert.equal(e.isPlaying.value,false);assert.equal(chords,0)
 resolveResume();await start
 assert.equal(e.isPlaying.value,true);assert.ok(chords>0,'First chord scheduled immediately after resume')
 e.stopPlayback()
 context.state='interrupted';start=e.startPlayback();e.stopPlayback();resolveResume();await start
 assert.equal(e.isPlaying.value,false,'Stop cancels pending startup')
 context.state='suspended';start=e.startPlayback();rejectResume(new Error('activation denied'));await start
 assert.equal(e.isPlaying.value,false);assert.match(e.toastMessage.value,/activation denied/)
 context.state='closed';start=e.startPlayback();resolveResume();await start
 assert.equal(e.isPlaying.value,true,'Closed context recreated');e.stopPlayback()
 console.log('Audio startup: readiness, first chord, cancellation, rejection and closed context passed')
} finally {
 fixture.editor.stopPlayback();fixture.stop();globalThis.window=originalWindow;globalThis.requestAnimationFrame=originalRAF;globalThis.cancelAnimationFrame=originalCancel;delete globalThis.__recordChord
}
