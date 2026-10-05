// Generate the same five-format corpus before/after layout changes with current jsPDF.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {jsPDF} from 'jspdf';
import {generatePDF} from '../src/core/pdfExport.js';
import {richSong} from './component-harness.mjs';
const baseline=process.env.HG_PDF_BASELINE;
const out=process.env.HG_PDF_RESULTS || '/private/tmp/hg-pdf-layout';
fs.mkdirSync(out,{recursive:true});
let oldGenerate,temporary;
if(baseline){
 let source=fs.readFileSync(baseline,'utf8').replace(/from "(\.\/[^\"]+)"/g,(_,p)=>`from "${pathToFileURL(path.resolve('src/core',p)).href}"`);
 temporary=path.resolve(`tests/.hg-pdf-layout-${process.pid}.mjs`);fs.writeFileSync(temporary,source);
 oldGenerate=(await import(pathToFileURL(temporary))).generatePDF;
}
const formats=['chords-only','chords-only-expanded','chords-and-lyrics-free','chords-and-lyrics-rhythm','chords-and-lyrics-synced'];
try{
 for(const format of formats){
  const measures=richSong(100).map((m,i)=>({...m,displayedMeasureIndex:i,activeKey:'F#',activeScale:'major',activeTimeSignature:{beats:4,unit:4},activeGrouping:[1,1,1,1],sectionLabel:i===0?'INTRO':i===20?'ESTROFA CON UNA ETIQUETA LARGA PARA COMPROBAR LOS MÁRGENES':'',lyrics:{...m.lyrics,mode:format.endsWith('rhythm')?'rhythm':format.endsWith('synced')?'synced':'free'}}));
  const project={title:'Una canción de corazón con un título largo que debe conservarse completo y permanecer separado de la cabecera',key:'F#',scaleType:'major',timeSignature:4,timeSignatureUnit:4,globalGroove:'Bossa',viewMode:format==='chords-only-expanded'?'expanded':'compact',measures,repeats:[],tiedSlots:[],lyricsTiedSlots:[]};
  for(const [name,exporter] of [['before',oldGenerate],['after',generatePDF]]){
   if(!exporter)continue;
   jsPDF.API.save=function(){fs.writeFileSync(path.join(out,`${format}-${name}.pdf`),Buffer.from(this.output('arraybuffer')));return this};
   exporter(JSON.parse(JSON.stringify(project)),format);
  }
 }
 console.log('Five-format PDF corpus generated in '+out);
}finally{if(temporary)fs.unlinkSync(temporary)}
