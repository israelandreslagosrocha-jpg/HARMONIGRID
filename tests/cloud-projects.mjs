import assert from 'node:assert/strict'
import {nextTick} from 'vue'
import {createEditor,richSong,clone} from './component-harness.mjs'
import {validateProjectDocument,canonicalDocument} from '../src/core/projectDocument.js'
import {createProjectAutosave} from '../src/core/projectAutosave.js'
import {createProjectRecovery} from '../src/services/projectRecovery.js'
import {createProjectRepository} from '../src/services/projects.js'
let checks=0
const equal=(a,b)=>{assert.deepEqual(a,b);checks++}
const h=await createEditor(),e=h.editor
let document
try {
 e.setPlan('PRO');e.measures.value=richSong(24);e.title.value='Canción de prueba';e.scaleType.value='dorian';e.globalGroove.value='Bossa';e.showLyricsGlobal.value=true
 await nextTick();document=validateProjectDocument(e.cloudDocument.value)
 equal(document.measures.length,24)
 const original=clone(e.cloudDocument.value)
 e.clearAccountWorkspace();await nextTick();equal(e.measures.value.length,0)
 e.hydrateProjectDocument(original);await nextTick();equal(clone(e.cloudDocument.value),original)
 e.setPlan('FREE');await nextTick();e.hydrateProjectDocument(original);await nextTick();equal(e.currentPlan.value,'FREE');equal(e.measures.value.length,24)
 for(const patch of [{schemaVersion:2},{measures:[]},{preferences:{...document.preferences,bpm:Infinity}},{key:'<img>'},{tiedSlots:['bad']},{repeats:[{type:'simple',startMeasure:1,endMeasure:24,times:10000}]}]) {
  const before=clone(e.cloudDocument.value);assert.throws(()=>e.hydrateProjectDocument({...document,...patch}));equal(clone(e.cloudDocument.value),before)
 }
 const hostile=JSON.parse(JSON.stringify(document));hostile.measures[0].evil=JSON.parse('{"__proto__":{}}');assert.throws(()=>validateProjectDocument(hostile));checks++
 e.measures.value=richSong(999);await nextTick();equal(validateProjectDocument(e.cloudDocument.value).measures.length,999)
} finally {h.stop()}
const recoveryRows=new Map(),calls=[]
const recovery={async put(owner,id,row){recoveryRows.set(`${owner}:${id}:${row.checkpoint}`,clone(row))},async remove(owner,id,cp){recoveryRows.delete(`${owner}:${id}:${cp}`)}}
let mode='success',gate,release
const repository={async save(task){calls.push(clone(task));if(mode==='wait')await gate;if(mode==='error')throw new Error('offline');if(mode==='conflict'){const err=new Error('conflict');err.code='PROJECT_CONFLICT';throw err}return{id:task.id,revision:(task.revision??0)+1,updated_at:'2026-10-04'}}}
let serial=0
const a=createProjectAutosave({repository,recovery,onState(){},delay:100000,newId:()=>`p${++serial}`})
a.setOwner('A');await a.saveNew(document);equal(a.state().status,'saved');equal(calls[0].ownerId,'A');equal(recoveryRows.size,0)
mode='wait';gate=new Promise(r=>release=r);a.changed({...document,title:'first'});const saving=a.flush();await new Promise(r=>setTimeout(r,0));a.changed({...document,title:'second'});mode='success';release();await saving;equal(calls.slice(-2).map(t=>[t.document.title,t.revision]),[['first',1],['second',2]]);equal(a.state().revision,3)
mode='wait';gate=new Promise(r=>release=r);a.changed({...document,title:'A pending'});const old=a.flush();await new Promise(r=>setTimeout(r,0));a.setOwner('B');equal(a.state().id,null);mode='success';release();await old;equal(a.state().owner,'B');equal(a.state().status,'unsaved');equal(calls.at(-1).ownerId,'A')
await a.saveNew(document);mode='error';a.changed({...document,title:'offline'});await assert.rejects(a.flush());equal(a.state().status,'error');assert.ok(recoveryRows.size);checks++
mode='conflict';await assert.rejects(a.flush());equal(a.state().status,'conflict');const n=calls.length;await assert.rejects(a.flush());equal(calls.length,n)
mode='success';await a.saveNew({...document,title:'copy'});equal(a.state().status,'saved');equal(calls.at(-1).revision,null)
a.changed({...document,title:'old project'});const begin=a.beginNew();a.changed({...document,title:'new project'});await begin;equal(calls.at(-1).document.title,'old project');equal(a.state().id,null);a.dispose()
// An automatic save does not immediately send every keystroke queued during
// a slow response. Explicit Save still drains pending changes without overlap.
const automaticCalls=[];let automaticRelease
const auto=createProjectAutosave({repository:{async save(task){automaticCalls.push(task);if(automaticCalls.length===1)await new Promise(r=>automaticRelease=r);return{revision:(task.revision??0)+1,updated_at:'now'}}},recovery,onState(){},delay:1000})
auto.setOwner('A');auto.attach({id:'automatic',revision:1,updated_at:'now'})
auto.changed({...document,title:'auto-first'});const automatic=auto.flush(false)
await new Promise(r=>setTimeout(r,0));auto.changed({...document,title:'auto-latest'});automaticRelease();await automatic
equal(automaticCalls.length,1);equal(auto.state().dirty,true)
await auto.flush();equal(automaticCalls.length,2);equal(automaticCalls.at(-1).document.title,'auto-latest');auto.dispose()
// Fluent SDK contract: bind the captured account's bearer token to every request.
const requests=[];let session={user:{id:'A'},access_token:'token-A'},response={data:{id:'x',owner_id:'A',revision:1,updated_at:'now'},error:null}
const client={auth:{async getSession(){return{data:{session},error:null}}},from(name){const request={name,filters:[],headers:{}};requests.push(request);const q={then(resolve,reject){return Promise.resolve(response).then(resolve,reject)}};for(const method of ['select','insert','update','order','range','single','maybeSingle'])q[method]=(...args)=>{request[method]=args;return q};q.eq=(...args)=>{request.filters.push(args);return q};q.setHeader=(k,v)=>{request.headers[k]=v;return q};return q}}
const repo=createProjectRepository(client);await repo.save({id:'x',revision:null,ownerId:'A',document});equal(requests.at(-1).headers.Authorization,'Bearer token-A');equal(Object.hasOwn(requests.at(-1).insert[0],'owner_id'),false)
await repo.save({id:'x',revision:1,ownerId:'A',document});equal(requests.at(-1).filters,[['id','x'],['owner_id','A'],['revision',1]])
session={user:{id:'B'},access_token:'token-B'};await assert.rejects(repo.save({id:'x',revision:1,ownerId:'A',document}));checks++
session={user:{id:'A',is_anonymous:true},access_token:'anon'};await assert.rejects(repo.list('A'));checks++
session={user:{id:'A'},access_token:'token-A'};response={data:null,error:null};await assert.rejects(repo.save({id:'x',revision:1,ownerId:'A',document}),err=>err.code==='PROJECT_CONFLICT');checks++
equal(canonicalDocument({b:2,a:{d:4,c:3}}),canonicalDocument({a:{c:3,d:4},b:2}))
const stored=new Map(),storage={async setItem(k,v){stored.set(k,v)},async removeItem(k){stored.delete(k)},async iterate(fn){for(const [k,v] of stored)fn(v,k)}}
const backups=createProjectRecovery(storage)
await backups.put('B','x',{checkpoint:'B',document})
for(let i=0;i<6;i++)await backups.put('A','x',{checkpoint:String(i),document:{...document,title:String(i)}})
equal((await backups.list('A')).length,3);equal((await backups.list('B')).length,1)
await backups.remove('A','x','0');equal((await backups.list('A')).length,3)
assert.ok((await backups.list('A')).some(row=>row.document.title==='5'));checks++
console.log(`${checks} cloud document, ownership, sequential save and conflict checks passed`)
