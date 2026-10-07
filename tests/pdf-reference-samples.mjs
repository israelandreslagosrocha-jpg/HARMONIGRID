// Synthetic reference scores: never use account data or change public FREE gates.
import fs from 'node:fs'
import path from 'node:path'
import {jsPDF} from 'jspdf'
import {generatePDF} from '../src/core/pdfExport.js'
const out=process.env.HG_PDF_RESULTS || 'output/pdf'
fs.mkdirSync(out,{recursive:true})
const make=(i,root,type,words,rhythms=[],obligado=false)=>({id:`m${i}`,originalMeasureIndex:i,displayedMeasureIndex:i,showObligado:obligado,showSubdivisions:true,
 beats:Array.from({length:6},(_,b)=>({id:`b${i}_${b}`,root,type,harmonicRhythm:'auto',subdivisions:[]})),
 lyrics:{mode:'rhythm',rawText:words.join(' '),beats:Array.from({length:6},(_,b)=>({harmonicRhythm:rhythms[b]||'auto',subdivisions:[]})),syllables:words.map((text,b)=>({text,wordId:`w${i}_${Math.floor(b/3)}`,rhythmEventId:`lyrics_${i}_${b}`}))}})
const common={title:'Mi Canción',key:'C',scaleType:'major',timeSignature:6,timeSignatureUnit:8,globalGroove:'Ninguno',viewMode:'compact',repeats:[],tiedSlots:[],lyricsTiedSlots:[]}
const measures=[make(0,'D','min7',['Ca','mi','no','ca','mi','no']),make(1,'F','maj7',['Si','len','cio','si','len','cio']),make(2,'G','7',['O','tra','vez','o','tra','vez']),make(3,'B','m7b5',['Ca','ba','lli','to','ca','ba']),make(4,'A','min7',['Co','ne','ji','to','co','ne']),make(5,'E','min7',['Ca','ba','lli','to','co','me']),make(6,'G','7',[]),make(7,'A','min7',[])]
for(const i of [3,4,5]){
 const m=measures[i];m.lyrics.beats[0]={harmonicRhythm:'eighth',eighthPattern:'2_notes'}
 m.lyrics.syllables=m.lyrics.syllables.filter(s=>!s.rhythmEventId.endsWith('_0'))
 m.lyrics.syllables.unshift({text:'Ca',wordId:'w0',rhythmEventId:`lyrics_${i}_0_0`},{text:'ba',wordId:'w0',rhythmEventId:`lyrics_${i}_0_1`})
}
const save=(name,project,format)=>{jsPDF.API.save=function(){fs.writeFileSync(path.join(out,name+'.pdf'),Buffer.from(this.output('arraybuffer')));return this};generatePDF(project,format)}
save('letras-ritmicas-armonia-referencia',structuredClone({...common,measures}),'chords-and-lyrics-rhythm')
const both=structuredClone(measures)
both.forEach(m=>{m.showObligado=true;m.beats[0].harmonicRhythm='quarter';m.activeGrouping=[3,3];m.beats[2].harmonicRhythm='eighth';m.beats[2].eighthPattern='2_notes';m.beats[2].subdivisions=[{root:m.beats[0].root,type:m.beats[0].type},{root:'G',type:'7'}]})
both[1].beats[0].root='D';both[1].beats[0].type='min7'
both[1].lyrics.syllables=both[1].lyrics.syllables.filter(s=>s.rhythmEventId!=='lyrics_1_0')
save('letras-y-armonia-ritmicas',{...common,measures:both,tiedSlots:['1_0'],lyricsTiedSlots:['lyrics_1_0']},'chords-and-lyrics-rhythm')
const harmony=structuredClone(both).slice(0,4)
harmony.forEach(m=>{m.beats=m.beats.slice(0,4);m.beats[0].harmonicRhythm='quarter';m.beats[1].harmonicRhythm='eighth';m.beats[1].subdivisions=[{root:'D',type:'7'},{root:'E',type:'min7'}];m.beats[2].harmonicRhythm='sixteenth';m.beats[2].subdivisions=Array.from({length:4},()=>({root:'F',type:'maj7'}));m.activeGrouping=[1,1,1,1]})
save('partitura-armonica-ritmica',{...common,timeSignature:4,timeSignatureUnit:4,measures:harmony,tiedSlots:['0_2_1']},'chords-only')
console.log('Three synthetic reference PDFs generated in '+out)
