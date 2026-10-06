import assert from 'node:assert/strict'
import {reserveRequest,settleUsage,startBudgetRelay,MAX_SCAN_MICROS} from '../scripts/strix-budget-relay.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const state={reservedMicros:0,calls:0}
const body={model:'gpt-5.4',messages:[{role:'user',content:'local audit'}],max_completion_tokens:128000,service_tier:'priority',n:10}
const request=JSON.parse(reserveRequest(body,state))
assert.equal(request.max_completion_tokens,4096)
assert.equal(request.service_tier,'default')
assert.equal(request.n,1)
assert.throws(()=>reserveRequest({...body,model:'other'},state))
assert.throws(()=>reserveRequest({...body,messages:[{content:[{type:'image_url',image_url:{url:'https://example.com'}}]}]},state))
assert.throws(()=>reserveRequest({...body,tools:[{type:'web_search'}]},state))
assert.throws(()=>reserveRequest({...body,messages:[{content:'x'.repeat(1000001)}]},state))
assert.equal(state.calls,1)
while(true){try{reserveRequest(body,state)}catch{break}}
const before={...state}
for(let i=0;i<20;i++)assert.throws(()=>reserveRequest(body,state))
assert.deepEqual(state,before)
assert.ok(state.reservedMicros<=MAX_SCAN_MICROS)
assert.ok(state.calls>1)
const countedState={reservedMicros:0,calls:0}
const small=JSON.parse(reserveRequest({...body,max_completion_tokens:16},countedState,()=>10))
assert.equal(small.max_completion_tokens,16)
assert.equal(countedState.reservedMicros,(10+16384)*6+16*30)
assert.throws(()=>reserveRequest(body,countedState,()=>NaN))
const settled={reservedMicros:300000,calls:1}
assert.equal(settleUsage(settled,300000,{prompt_tokens:300,completion_tokens:40,prompt_tokens_details:{cached_tokens:200}},4096),true)
assert.equal(settled.reservedMicros,2000)
assert.equal(settleUsage(settled,2000,null,4096),false)
assert.equal(settled.reservedMicros,2000)
assert.equal(settleUsage(settled,2000,{prompt_tokens:300,completion_tokens:5000},4096),false)
assert.equal(settled.frozen,true)
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hg-budget-test-'))
let forwarded=0
const mock=async(url,options)=>{
  forwarded++
  assert.equal(url,'https://api.openai.com/v1/chat/completions')
  assert.equal(options.headers.authorization,'Bearer fake-private-key')
  assert.equal(JSON.parse(options.body).max_completion_tokens,4096)
  assert.ok(fs.existsSync(path.join(directory,'strix-budget-state.json')))
  if(JSON.parse(options.body).stream)return new Response('data: '+JSON.stringify({choices:[{delta:{content:'{"usage":{"prompt_tokens":0,"completion_tokens":0}}'}}]})+'\n\ndata:'+JSON.stringify({usage:{prompt_tokens:300,completion_tokens:40,prompt_tokens_details:{cached_tokens:200}}})+'\n\ndata:[DONE]',{headers:{'content-type':'text/event-stream'}})
  return new Response('mock result')
}
let relay=await startBudgetRelay('fake-private-key',directory,mock)
const post=(token,payload)=>fetch(relay.base+'/chat/completions',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(payload)})
try {
  assert.equal((await post('wrong-token',body)).status,403)
  assert.equal((await post(relay.token,{...body,model:'other'})).status,429)
  assert.equal(forwarded,0)
  assert.equal((await post(relay.token,body)).status,200)
  assert.equal(forwarded,1)
  const saved=relay.state.reservedMicros
  const firstStream=await post(relay.token,{...body,stream:true})
  assert.equal(firstStream.status,200)
  await firstStream.text()
  // Drain the response before checking settled usage.
  const checked=await post(relay.token,{...body,stream:true})
  await checked.text()
  assert.equal(relay.state.reservedMicros,saved+4000)
  const receipts=fs.readFileSync(path.join(directory,'strix-budget-receipts.jsonl'),'utf8')
  assert.ok(!receipts.includes('fake-private-key'))
  assert.equal(receipts.split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(entry=>entry.settled).length,2)
  const after=relay.state.reservedMicros
  await relay.close()
  relay=await startBudgetRelay('fake-private-key',directory,mock)
  assert.equal(relay.state.reservedMicros,after)
  assert.equal(relay.state.calls,3)
  await assert.rejects(()=>startBudgetRelay('fake-private-key',directory,mock))
}finally{await relay.close();fs.rmSync(directory,{recursive:true,force:true})}
// An uncertain network failure must retain its reservation and stop retries.
const failedDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'hg-budget-failure-'))
let failures=0
const blocked=[]
const failedRelay=await startBudgetRelay('fake-private-key',failedDirectory,async()=>{
  failures++
  throw new TypeError('network failure fake-private-key',{cause:{code:'ECONNRESET'}})
},()=>10,reason=>blocked.push(reason))
try {
  const failed=await fetch(failedRelay.base+'/chat/completions',{method:'POST',headers:{authorization:`Bearer ${failedRelay.token}`,'content-type':'application/json'},body:JSON.stringify(body)})
  assert.equal(failed.status,429)
  const text=await failed.text()
  assert.ok(!text.includes('fake-private-key'))
  assert.deepEqual(blocked,['incomplete_request'])
  assert.equal(failures,1)
  const reserved=(10+16384)*6+4096*30
  assert.equal(failedRelay.state.reservedMicros,reserved)
  assert.equal(JSON.parse(fs.readFileSync(path.join(failedDirectory,'strix-budget-state.json'),'utf8')).reservedMicros,reserved)
  const receipts=fs.readFileSync(path.join(failedDirectory,'strix-budget-receipts.jsonl'),'utf8')
  assert.ok(!receipts.includes('fake-private-key'))
  assert.equal(JSON.parse(receipts.trim().split('\n').at(-1)).causeCode,'ECONNRESET')
  failedRelay.state.reservedMicros=MAX_SCAN_MICROS
  const exhausted=await fetch(failedRelay.base+'/chat/completions',{method:'POST',headers:{authorization:`Bearer ${failedRelay.token}`,'content-type':'application/json'},body:JSON.stringify(body)})
  assert.equal(exhausted.status,429);await exhausted.text()
  assert.equal(failures,1)
  assert.equal(failedRelay.state.reservedMicros,MAX_SCAN_MICROS)
  assert.deepEqual(blocked,['incomplete_request','budget_exhausted'])
}finally{await failedRelay.close();fs.rmSync(failedDirectory,{recursive:true,force:true})}
console.log('Strix budget guard passed: bounded output, text-only, fixed model/tier, cumulative reservations and retry rejection. No API calls.')
