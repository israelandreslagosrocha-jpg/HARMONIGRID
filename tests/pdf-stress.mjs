import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {jsPDF} from 'jspdf'
import {buildExpandedSequence} from '../src/core/repeatSequence.js'
import {formats,stressProject} from './pdf-stress-fixtures.mjs'
const output=process.env.HG_PDF_RESULTS || 'output/pdf/pruebas-irregulares'
fs.mkdirSync(output,{recursive:true})
// Observe real exporter placements using a temporary test-only module. The
// shipped exporter exposes neither composition data nor this diagnostic hook.
let source=fs.readFileSync('src/core/pdfExport.js','utf8')
source=source.replace(/from "(\.\/[^\"]+)"/g,(_,p)=>`from "${pathToFileURL(path.resolve('src/core',p)).href}"`)
source=source.replaceAll('drawRhythmTie(doc,','recordTie(doc,')
source+='\nfunction recordTie(doc,...args){trace.ties.push({page:doc.internal.getCurrentPageInfo().pageNumber,args});drawRhythmTie(doc,...args)}\n'
source='export const trace={harmony:[],lyrics:[],ties:[]}\n'+source
source=source.replace('    if(measure.showObligado)drawRhythmVoice', '    trace.harmony.push({index,sig,x,y,width,timeOffset,obligado:measure.showObligado,grouping,timeline,events:placed});\n    if(measure.showObligado)drawRhythmVoice')
source=source.replace('    drawRhythmVoice(doc,positioned,y+34', '    trace.lyrics.push({index,sig,events:positioned});\n    drawRhythmVoice(doc,positioned,y+34')
const temporary=path.resolve(`tests/.hg-pdf-stress-${process.pid}.mjs`)
fs.writeFileSync(temporary,source)
const summaries=[]
let aligned=0,compactMusic=[]
try {
 const {generatePDF,trace}=await import(pathToFileURL(temporary))
 for(const format of formats){
  const project=stressProject(format)
  if(format==='chords-only-expanded'){project.measures=buildExpandedSequence(project.measures,project.repeats);project.repeats=[]}
  const before=JSON.stringify(project)
  trace.harmony.length=trace.lyrics.length=trace.ties.length=0
  let pages=0,bytes=0
  jsPDF.API.save=function(){const data=Buffer.from(this.output('arraybuffer'));bytes=data.length;pages=this.internal.getNumberOfPages();fs.writeFileSync(path.join(output,format+'.pdf'),data);return this}
  generatePDF(project,format)
  assert.equal(JSON.stringify(project),before,'PDF export must preserve every composition field')
  const signature=voice=>voice.events.map(({start,duration,tuplet,rest})=>({start,duration,tuplet,rest}))
  for(const voice of trace.harmony){assert.deepEqual(voice.grouping,project.measures[voice.index].activeGrouping,'Export grouping must match the editor, including expanded occurrences');for(const event of voice.events)assert.ok(event.start+event.duration*voice.sig.unit/4<=voice.sig.beats+1e-8,'A harmonic duration must fit its measure in these valid fixtures')}
  if(format==='chords-only')compactMusic=trace.harmony.map(signature)
  if(format==='chords-only-expanded')for(const voice of trace.harmony){const original=project.measures[voice.index].originalMeasureIndex;assert.deepEqual(signature(voice),compactMusic[original],'Expanded copies must retain the same rhythmic durations and onsets')}

  if(format==='chords-and-lyrics-rhythm'){
   assert.equal(trace.lyrics.length,14)
   assert.ok(trace.ties.length>=6,'Within-measure and cross-row ties must render in both voices')
   for(const voice of trace.lyrics){
    const harmony=trace.harmony.find(h=>h.index===voice.index)
    for(const note of voice.events){
     assert.ok(note.start+note.duration*voice.sig.unit/4<=voice.sig.beats+1e-8,'A vocal duration must fit its measure in these valid fixtures')
     // Recover the denominator-beat onset from the actual export position.
     const expected=harmony.timeline.points.find(p=>Math.abs(p.time-note.start)<1e-8).x
     assert.ok(Math.abs(expected-note.x)<1e-8,'Lyric onset displaced from shared musical time')
     for(const chord of harmony.events.filter(e=>Math.abs(e.start-note.start)<1e-8)){assert.ok(Math.abs(chord.x-note.x)<1e-8,'Simultaneous voices must align exactly');aligned++}
    }
   }
   for(const [index,starts] of [[0,[0,.25,.5,.75]],[8,[0,.25,.5,.75]],[4,[0,.5,1,1.5]]]){
     const notes=trace.lyrics.find(v=>v.index===index).events.filter(e=>e.syllable?.wordId===`w${index}`)
     assert.deepEqual(notes.map(e=>e.start),starts,'Four syllables must keep their exact subdivision onsets')
   }
   fs.writeFileSync(path.join(output,'alignment.json'),JSON.stringify(trace,null,2))
  }
  summaries.push({format,measures:project.measures.length,pages,bytes,unchanged:true,minimumFontScale:trace.harmony.length?Math.min(...trace.harmony.map(h=>h.timeline.scale)):null})
 }
 assert.ok(aligned>100)
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({alignedOnsets:aligned,formats:summaries},null,2))
 console.log(`Five real PDF exports generated; ${aligned} simultaneous harmonic/vocal onsets aligned; inputs unchanged`)
}finally{fs.unlinkSync(temporary)}
