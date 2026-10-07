import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {parse,compileScript} from '@vue/compiler-sfc';
import {effectScope} from 'vue';
const root=fileURLToPath(new URL('../',import.meta.url));
let serial=0;
export async function createEditor(sourcePath=path.join(root,'src/App.vue'), {freeLaunch=false,transformSource=source=>source}={}) {
 const {descriptor}=parse(transformSource(fs.readFileSync(sourcePath,'utf8')));
 let compiled=compileScript(descriptor,{id:'regression'}).content;
 // Historical engine fixtures intentionally exercise retained advanced tools.
 if(!freeLaunch) compiled=compiled.replace('const isFreeLaunch = true','const isFreeLaunch = false');
 compiled = compiled.replace(/import (\w+) from '\.\/components\/[^']+\.vue'/g, (_, name) => `const ${name} = {}`);
 compiled=compiled.replace(/import logoUrl from '.\/assets\/logo.jpg'/,"const logoUrl = ''");
 compiled=compiled.replace(/from '(\.\/core\/[^']+)'/g,(_,p)=>`from '${pathToFileURL(path.resolve(root,'src',p)).href}'`);
 compiled=compiled.replace(/from 'vue'/g,`from '${pathToFileURL(path.join(root,'node_modules/vue/dist/vue.runtime.esm-bundler.js')).href}'`);
 const temporary=path.join(os.tmpdir(),`hg-editor-${process.pid}-${serial++}.mjs`);
 fs.writeFileSync(temporary,compiled);
 const {default:component}=await import(pathToFileURL(temporary));fs.unlinkSync(temporary);
 const warn=console.warn;console.warn=(...args)=>{if(!String(args[0]).includes('no active component instance'))warn(...args);};
 const scope=effectScope();let editor;
 try {editor=scope.run(()=>component.setup({},{expose(){}}));}finally{console.warn=warn;}
 return {editor,stop(){scope.stop();if(editor.connectorUpdateTimer)clearTimeout(editor.connectorUpdateTimer);if(editor.toastTimeout.value)clearTimeout(editor.toastTimeout.value);}};
}
export const clone=value=>JSON.parse(JSON.stringify(value));
export function richSong(count) {
 return Array.from({length:count},(_,i)=>({id:`m${i}`,originalMeasureIndex:i,showObligado:true,showSubdivisions:true,
  beats:Array.from({length:4},(_,b)=>({id:`b${i}_${b}`,root:['C','G','A','F'][b],type:b===2?'min':'maj',harmonicRhythm:b===0?'eighth':'quarter',subdivisions:b===0?[{id:`sub${i}_0`,root:'C',type:'maj',isSilence:false},{id:`sub${i}_1`,root:'G',type:'maj',isSilence:false}]:[]})),
  lyrics:{rawText:'Can-ción co-ra-zón',mode:['free','rhythm','synced'][i%3],anchors:[{chordId:`b${i}_0`,start:0,end:7}],lastText:'Can-ción co-ra-zón',lastMode:['free','rhythm','synced'][i%3],lastTextForSuggestion:'Can-ción co-ra-zón',syllableSuggestion:null,
   beats:Array.from({length:4},(_,b)=>({id:`lb${i}_${b}`,harmonicRhythm:'quarter',subdivisions:[]})),
   syllables:Array.from({length:5},(_,j)=>({id:`sy${i}_${j}`,text:['Can','ción','co','ra','zón'][j],wordId:j<2?'w_0':'w_1',rhythmEventId:j<4?`lyrics_${i}_${j}`:null,startTick:j<4?j*480:null,durationTicks:j<4?480:null,tied:false,linkedEvents:[]}))}
 }));
}
