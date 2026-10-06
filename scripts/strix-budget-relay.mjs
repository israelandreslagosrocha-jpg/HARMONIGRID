// Source-only, text-only scan. Failed/unknown calls retain their reservation.
// Completed calls settle only from provider usage. Official GPT-5.4 prices.
import http from 'node:http'
import {randomBytes,randomUUID} from 'node:crypto'
import {Readable} from 'node:stream'
import fs from 'node:fs'
import path from 'node:path'
export const MAX_SCAN_MICROS=4900000
export class ScanBudgetExhausted extends Error {}
export function reserveRequest(body,state,countInputTokens) {
  if(state.frozen)throw Error('Budget ledger requires review')
  if(body?.model!=='gpt-5.4'||!Array.isArray(body.messages)||body.messages.length>200)throw Error('Unsupported model or messages')
  for(const message of body.messages) {
    if(typeof message.content==='string'||message.content==null)continue
    if(!Array.isArray(message.content)||message.content.some(part=>part.type!=='text'||typeof part.text!=='string'))throw Error('Text-only scan required')
  }
  if(body.tools?.some(tool=>tool.type!=='function'))throw Error('Paid hosted tools are not allowed')
  const requestedOutput=body.max_completion_tokens??body.max_tokens??4096
  if(!Number.isSafeInteger(requestedOutput)||requestedOutput<=0)throw Error('Invalid output limit')
  const request={...body,service_tier:'default',n:1,max_completion_tokens:Math.min(requestedOutput,4096)}
  if(request.stream)request.stream_options={...request.stream_options,include_usage:true}
  delete request.max_tokens
  delete request.prediction
  const payload=JSON.stringify(request)
  const bytes=Buffer.byteLength(payload)
  if(bytes>1000000)throw Error('Request exceeds conservative text budget')
  const tokens=countInputTokens?countInputTokens(payload):bytes
  if(!Number.isSafeInteger(tokens)||tokens<0||tokens>1000000)throw Error('Invalid token estimate')
  // Local tokenizer plus framing allowance; byte upper bound as fallback.
  // US$6/M input and US$30/M output exceed documented standard/long-context rates.
  const reservation=(tokens+16384)*6+request.max_completion_tokens*30
  if(state.reservedMicros+reservation>MAX_SCAN_MICROS)throw new ScanBudgetExhausted('Local scan budget exhausted')
  state.reservedMicros+=reservation
  state.calls++
  return payload
}
export function settleUsage(state,reservation,usage,outputLimit) {
  const input=usage?.prompt_tokens,output=usage?.completion_tokens,cached=usage?.prompt_tokens_details?.cached_tokens??0
  if(![input,output,cached].every(value=>Number.isSafeInteger(value)&&value>=0)||cached>input)return false
  // Cached US$1/M also exceeds the documented long-context/regional rate.
  const upperCost=(input-cached)*6+cached+output*30
  if(output>outputLimit||upperCost>reservation){state.frozen=true;return false}
  state.reservedMicros-=reservation-upperCost
  return true
}
export async function startBudgetRelay(apiKey,privateDirectory,fetchUpstream=fetch,countInputTokens,onScanBlocked=()=>{}) {
  const token=randomBytes(32).toString('hex')
  const ledger=path.join(privateDirectory,'strix-budget-state.json')
  const lock=path.join(privateDirectory,'strix-budget.lock')
  fs.closeSync(fs.openSync(lock,'wx',0o600))
  const state=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{reservedMicros:0,calls:0}
  if(!Number.isSafeInteger(state.reservedMicros)||state.reservedMicros<0||state.reservedMicros>MAX_SCAN_MICROS||!Number.isSafeInteger(state.calls)||state.calls<0)throw Error('Invalid private budget ledger')
  const persist=()=>{fs.writeFileSync(ledger+'.tmp',JSON.stringify(state),{mode:0o600});fs.renameSync(ledger+'.tmp',ledger)}
  const receipt=(entry)=>fs.appendFileSync(path.join(privateDirectory,'strix-budget-receipts.jsonl'),JSON.stringify({at:new Date().toISOString(),...entry})+'\n',{mode:0o600})
  const inflight=new Set()
  const reject=(res,status,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error:{message,type:'local_budget_guard',code:'local_budget_guard'}}))}
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/v1/chat/completions'||req.headers.authorization!==`Bearer ${token}`)return reject(res,403,'Unauthorized relay request')
    let finish
    const finished=new Promise(resolve=>{finish=resolve})
    inflight.add(finished)
    const requestId=randomUUID()
    let reservation=0,upstreamStatus=null
    const block=reason=>onScanBlocked(reason)
    const disconnected=new AbortController()
    res.once('close',()=>{if(!res.writableEnded)disconnected.abort()})
    try {
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>1000000)throw Error('Request too large');chunks.push(chunk)}
      const before=state.reservedMicros
      const payload=reserveRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')),state,countInputTokens)
      reservation=state.reservedMicros-before
      // Persist before sending: restarting the scanner cannot reset its budget.
      persist()
      receipt({requestId,event:'reserved',reservation,totalMicros:state.reservedMicros})
      // Fixed destination; never forward incoming auth headers or arbitrary URLs.
      const upstream=await fetchUpstream('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:payload,signal:AbortSignal.any([AbortSignal.timeout(300000),disconnected.signal]),redirect:'error'})
      upstreamStatus=upstream.status
      res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'})
      if(upstream.body){
        const source=Readable.fromWeb(upstream.body),decoder=new TextDecoder()
        const streaming=JSON.parse(payload).stream===true
        let buffer='',usage=null,done=false
        const consumeLine=line=>{
          if(!line.startsWith('data:'))return
          const value=line.slice(5).trim()
          if(value==='[DONE]'){done=true;return}
          try{const event=JSON.parse(value);if(event.usage)usage=event.usage}catch{}
        }
        source.on('data',chunk=>{
          buffer+=decoder.decode(chunk,{stream:true})
          if(streaming){let index;while((index=buffer.indexOf('\n'))>=0){consumeLine(buffer.slice(0,index).replace(/\r$/, ''));buffer=buffer.slice(index+1)}}
        })
        await new Promise(resolve=>{
          source.once('end',()=>{
            buffer+=decoder.decode()
            if(streaming){if(buffer)consumeLine(buffer.replace(/\r$/, ''))}
            else{try{usage=JSON.parse(buffer).usage;done=true}catch{}}
            const settled=upstream.status===200&&done&&settleUsage(state,reservation,usage,JSON.parse(payload).max_completion_tokens)
            if(settled)persist()
            else if(state.frozen)persist()
            receipt({requestId,event:'completed',status:upstream.status,settled:!!settled,done,input:usage?.prompt_tokens,output:usage?.completion_tokens,cached:usage?.prompt_tokens_details?.cached_tokens,totalMicros:state.reservedMicros})
            if(!settled)block('unconfirmed_usage')
            resolve()
          })
          source.once('error',()=>{block('interrupted_response');res.destroy();resolve()});source.once('close',resolve)
          source.pipe(res)
        })
      }else res.end()
    }catch(error){
      if(reservation){
        const causeCode=error.cause?.code
        receipt({requestId,event:'incomplete',status:upstreamStatus,errorName:/^[A-Za-z]+$/.test(error.name)?error.name:'Error',causeCode:typeof causeCode==='string'&&/^[A-Z0-9_]+$/.test(causeCode)?causeCode:undefined,disconnected:disconnected.signal.aborted,totalMicros:state.reservedMicros})
        block('incomplete_request')
      }else if(error instanceof ScanBudgetExhausted)block('budget_exhausted')
      if(!res.headersSent)reject(res,429,reservation?'Incomplete provider request; scan stopped for budget review':error.message)
      else res.destroy()
    }
    finally{inflight.delete(finished);finish()}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  return {base:`http://127.0.0.1:${server.address().port}/v1`,token,state,close:async()=>{await new Promise(resolve=>server.close(resolve));await Promise.all(inflight);fs.unlinkSync(lock)}}
}
