import {createApp,h,ref,nextTick} from 'vue';
import App from '../../src/App.vue';
import '../../src/style.css';
import {richSong} from './fixture.js';
const rows=ref([]),busy=ref(false),count=ref(20),letters=ref(true),editor=ref(null),suiteRunning=ref(false);
let longTasks=[];
const record=async row=>{row.phase=__HG_BENCH_PHASE__;row.scenario='live-subdivision-edit-v2';row.height=innerHeight;row.source=__HG_SOURCE_SHA__;row.recordedAt=new Date().toISOString();row.firstSystemMounted=document.querySelector('[data-score-system="sys-0"]')?.getAttribute('data-score-mounted');rows.value.push(row);await fetch('/HARMONIGRID/__test-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)})};
try{new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true})}catch{}
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const memory=()=>performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null;
async function sample(label,action){const start=performance.now();const result=action();if(result?.then)await result;await nextTick();const flushEnd=performance.now();if(label==='render'){while(!document.querySelector('#editor main'))await new Promise(r=>setTimeout(r,20));}await paint();const painted=performance.now();await new Promise(r=>setTimeout(r,60));const end=performance.now();const nodes=document.querySelectorAll('#editor *').length;await record({label,build:import.meta.env.PROD?'production':'development',count:editor.value.measures.length,letters:editor.value.showLyricsGlobal,viewport:innerWidth,stateFlushMs:+(flushEnd-start).toFixed(2),elapsedMs:+(end-start).toFixed(2),paintMs:+(painted-start).toFixed(2),domNodes:nodes,heap:memory(),longTasks:longTasks.filter(t=>t.start>=start&&t.start<=end)});await nextTick();}
async function load(){busy.value=true;editor.value.clearAccountWorkspace();await nextTick();document.querySelector('#editor main')?.scrollTo({top:0,behavior:'instant'});await paint();await sample('render',()=>{editor.value.stopPlayback();editor.value.currentPlan='PRO';editor.value.title=`Prueba ${count.value} compases`;editor.value.showLyricsGlobal=letters.value;editor.value.isSetupMode=false;editor.value.measures=richSong(Number(count.value));});busy.value=false;}
async function edits(){busy.value=true;await sample('idle-paint',()=>{});for(let i=0;i<3;i++){await sample('chord-edit',()=>{const beat=editor.value.measures[0].beats[0];beat.root=i%2?'C':'D';if(beat.subdivisions?.[0])beat.subdivisions[0].root=beat.root});await sample('lyrics-edit',()=>{editor.value.measures[1].lyrics.rawText=i%2?'Can-ción co-ra-zón':'Mi mú-si-ca sue-na'});await sample('history',()=>editor.value.saveHistory());}busy.value=false;}
async function playback(){busy.value=true;const gaps=[];let last=performance.now(),raf;const frame=t=>{gaps.push(t-last);last=t;raf=requestAnimationFrame(frame)};raf=requestAnimationFrame(frame);const start=performance.now();editor.value.startPlayback();await new Promise(r=>setTimeout(r,8000));const position={measure:editor.value.currentPlayingMeasureIndex,beat:editor.value.currentPlayingBeatIndex,playing:editor.value.isPlaying};editor.value.stopPlayback();cancelAnimationFrame(raf);gaps.sort((a,b)=>a-b);await record({label:'playback-8s',build:import.meta.env.PROD?'production':'development',count:editor.value.measures.length,letters:editor.value.showLyricsGlobal,viewport:innerWidth,elapsedMs:performance.now()-start,frames:gaps.length,p95FrameMs:gaps[Math.floor(gaps.length*.95)],maxFrameMs:Math.max(...gaps),position,stopped:!editor.value.isPlaying,heap:memory(),domNodes:document.querySelectorAll('#editor *').length});busy.value=false;}
async function addTestTies(){
  busy.value=true
  await sample('ties-render',async ()=>{
    const e=editor.value
    for(const m of e.measures.slice(0,2)){
      m.showSubdivisions=false;m.lyrics.mode='rhythm'
      m.beats.forEach(b=>{b.root='C';b.type='maj';b.harmonicRhythm='quarter';b.subdivisions=[]})
    }
    await nextTick()
    e.tiedSlots=new Set(['1_0']);e.lyricsTiedSlots=new Set(['lyrics_1_0'])
    await nextTick()
  })
  const e=editor.value
  await record({label:'ties-contract',build:import.meta.env.PROD?'production':'development',count:e.measures.length,viewport:innerWidth,music:[0,1].map(i=>e.getMeasureTiesPaths(e.systems[0].measures.find(m=>m.originalMeasureIndex===i)||{...e.measures[i],originalMeasureIndex:i})),lyrics:[0,1].map(i=>e.getMeasureLyricsTiesPaths({...e.measures[i],originalMeasureIndex:i})),ties:[...e.tiedSlots],lyricsTies:[...e.lyricsTiedSlots]})
  busy.value=false
}
async function navigateLast(){
  busy.value=true
  const e=editor.value, last=e.measures.length-1
  e.measures[last].lyrics.mode='free'
  e.activateLyricsForMeasure(last)
  await new Promise(r=>setTimeout(r,500));await paint()
  await record({label:'navigate-last',build:import.meta.env.PROD?'production':'development',count:e.measures.length,viewport:innerWidth,focused:document.activeElement?.id,expected:`lyrics-textarea-${last}`,mountedSystems:document.querySelectorAll('[data-score-mounted="true"]').length,totalSystems:e.systems.length})
  busy.value=false
}
async function series(){
  if(suiteRunning.value)return
  suiteRunning.value=true
  try{for(const n of [20,100,300,999]){count.value=n;await load();await edits();await playback();await navigateLast()}}
  finally{suiteRunning.value=false;busy.value=false}
}
createApp({setup(){return()=>h('div',[
 h('section',{style:'padding:8px;background:white;position:relative;z-index:100;font:12px sans-serif'},[
 h('strong','Banco de pruebas LOCAL'),h('button',{disabled:busy.value||suiteRunning.value,onClick:series},'Ejecutar serie completa'),h('select',{'aria-label':'Compases de prueba',disabled:busy.value||suiteRunning.value,value:count.value,onChange:e=>count.value=Number(e.target.value)},[20,100,300,999].map(n=>h('option',{value:n},String(n)))),
 h('label',[h('input',{type:'checkbox',disabled:busy.value||suiteRunning.value,checked:letters.value,onChange:e=>letters.value=e.target.checked}),' Letras visibles']),
 h('button',{disabled:busy.value||suiteRunning.value,onClick:load},'Cargar fixture'),h('button',{disabled:busy.value||suiteRunning.value,onClick:edits},'Medir edición'),h('button',{disabled:busy.value||suiteRunning.value,onClick:playback},'Medir reproducción 8s'),h('button',{disabled:busy.value||suiteRunning.value,onClick:navigateLast},'Ir al último compás'),h('button',{disabled:busy.value||suiteRunning.value,onClick:addTestTies},'Añadir ligaduras de prueba'),h('span',busy.value?' Ejecutando…':' Listo'),
 h('details',[h('summary','Resultados JSON'),h('pre',{id:'results'},JSON.stringify(rows.value,null,2))])]),
 h('div',{id:'editor'},[h(App,{ref:editor})])])}}).mount('#bench');
