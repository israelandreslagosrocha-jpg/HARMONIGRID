// Compare the existing exporter with the old and patched jsPDF engines.
// Baseline is isolated in /private/tmp/hg-pdf-baseline (never a product dependency).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {jsPDF} from 'jspdf';
import legacy from '/private/tmp/hg-pdf-baseline/node_modules/jspdf/dist/jspdf.node.js';
import {generatePDF} from '../src/core/pdfExport.js';
const root=fileURLToPath(new URL('../',import.meta.url));
let source=fs.readFileSync(path.join(root,'src/core/pdfExport.js'),'utf8');
source=source.replace('import { jsPDF } from "jspdf"', 'import legacy from "/private/tmp/hg-pdf-baseline/node_modules/jspdf/dist/jspdf.node.js"; const {jsPDF}=legacy');
source=source.replace(/from "(\.\/[^\"]+)"/g,(_,p)=>`from "${pathToFileURL(path.resolve(root,'src/core',p)).href}"`);
const temporary=path.join(os.tmpdir(),`harmonigrid-pdf-legacy-${process.pid}.mjs`);
fs.writeFileSync(temporary,source);
const oldGenerate=(await import(pathToFileURL(temporary))).generatePDF;
const out='/private/tmp/hg-pdf-regression';fs.mkdirSync(out,{recursive:true});
const options=['chords-only','chords-only-expanded','chords-and-lyrics-free','chords-and-lyrics-rhythm','chords-and-lyrics-synced'];
for(const option of options) {
 const project={title:'Prueba de regresión',key:'F#',scaleType:'major',timeSignature:4,timeSignatureUnit:4,globalGroove:'Ninguno',repeats:[],tiedSlots:[],lyricsTiedSlots:[],viewMode:option==='chords-only-expanded'?'expanded':'compact',measures:Array.from({length:12},(_,i)=>({id:`m${i}`,originalMeasureIndex:i,displayedMeasureIndex:i,activeKey:'F#',activeScale:'major',activeTimeSignature:{beats:4,unit:4},activeGrouping:[1,1,1,1],section:i===0?'INTRO':'',showObligado:true,beats:Array.from({length:4},(_,b)=>({id:`b${i}_${b}`,root:['F#','C#','E#','B'][b],type:['maj7','7','dim','maj'][b],harmonicRhythm:'quarter',subdivisions:[]})),lyrics:{rawText:'Can-ción co-ra-zón',mode:option.endsWith('rhythm')?'rhythm':option.endsWith('synced')?'synced':'free',anchors:[{chordId:`b${i}_0`,start:0,end:7}],syllables:[{id:`s${i}`,text:'Can',wordId:'w0',rhythmEventId:`lyrics_${i}_0`,startTick:0,durationTicks:480}],beats:Array.from({length:4},(_,b)=>({id:`lb${i}_${b}`,harmonicRhythm:'quarter',subdivisions:[]}))}}))};
 for(const [name,engine,exporter] of [['before',legacy.jsPDF,oldGenerate],['after',jsPDF,generatePDF]]) {
  engine.API.save=function(){fs.writeFileSync(path.join(out,`${option}-${name}.pdf`),Buffer.from(this.output('arraybuffer')));return this;};
  exporter(JSON.parse(JSON.stringify(project)),option);
 }
}
fs.unlinkSync(temporary);
console.log('Generated five paired PDF exports in '+out);
