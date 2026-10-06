// Local adversarial documents; no network, real accounts or personal data.
import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {createEditor,richSong,clone} from './component-harness.mjs'
import {validateProjectDocument} from '../src/core/projectDocument.js'
const h=await createEditor(),e=h.editor
let checks=0
try {
  e.setPlan('PRO');e.measures.value=richSong(2);e.title.value='Trabajo que debe conservarse'
  await nextTick()
  const original=clone(e.cloudDocument.value)
  const attacks=[
    d=>{d.key='<svg onload=alert(1)>'},
    d=>{d.measures[0].beats[0].root='<img src=x onerror=alert(1)>'},
    d=>{d.measures[0].beats[0].type='maj"><script>alert(1)</script>'},
    d=>{d.measures[0].beats[0].tensions=['9"><svg onload=alert(1)>']},
    d=>{d.measures[0].id='m1" onmouseover="alert(1)'},
    d=>{d.measures[0].keyChange={key:'C',scaleType:'__proto__'}},
    d=>{d.preferences.bpm=Infinity},
    d=>{d.measures[0].beats[0].subdivisions[0].subdivisions=[]},
    d=>{d.repeats=[{type:'simple',startMeasure:1,endMeasure:2,times:1e12}]},
    d=>{d.extra=JSON.parse('{"__proto__":{"polluted":true}}')},
    d=>{d.extra={constructor:{prototype:{polluted:true}}}},
    d=>{d.extra={};d.extra.loop=d.extra},
    d=>{let x=d;for(let i=0;i<20;i++){x.extra={};x=x.extra}},
    // UTF-8 size limits must count bytes, including international text.
    d=>{d.measures[0].lyrics.rawText='🎵'.repeat(2100000)},
  ]
  for(const attack of attacks){
    const hostile=clone(original);attack(hostile)
    assert.throws(()=>e.hydrateProjectDocument(hostile));checks++
    await nextTick()
    assert.deepEqual(clone(e.cloudDocument.value),original);checks++
    assert.equal(Object.prototype.polluted,undefined);checks++
  }
  // Text is content: validation must retain punctuation, Unicode and literal
  // markup in titles/lyrics, rather than destructively deleting user writing.
  const text=clone(original)
  text.title='Creación personal <3 — 日本語'
  text.measures[0].lyrics.rawText='<script>texto literal</script> Canción 🎵'
  const safe=validateProjectDocument(text)
  assert.equal(safe.title,text.title);checks++
  assert.equal(safe.measures[0].lyrics.rawText,text.measures[0].lyrics.rawText);checks++
  assert.notEqual(safe.measures,text.measures);checks++
  console.log(`${checks} adversarial-document rejection, editor preservation and international-text checks passed; no DOM execution or remote penetration test`)
}finally{h.stop()}
