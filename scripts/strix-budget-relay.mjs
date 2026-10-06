// Source-only, text-only scan. Failed/unknown calls retain their reservation.
// Completed calls settle only from provider usage. Official GPT-5.4 prices.
import http from 'node:http'
import {randomBytes} from 'node:crypto'
import {Readable} from 'node:stream'
import fs from 'node:fs'
import path from 'node:path'
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
  if(state.reservedMicros+reservation>4500000)throw Error('Local scan budget exhausted')
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
export async function startBudgetRelay(apiKey,privateDirectory,fetchUpstream=fetch,countInputTokens) {
  const token=randomBytes(32).toString('hex')
  const ledger=path.join(privateDirectory,'strix-budget-state.json')
  const lock=path.join(privateDirectory,'strix-budget.lock')
  fs.closeSync(fs.openSync(lock,'wx',0o600))
  const state=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{reservedMicros:0,calls:0}
  if(!Number.isSafeInteger(state.reservedMicros)||state.reservedMicros<0||state.reservedMicros>4500000||!Number.isSafeInteger(state.calls)||state.calls<0)throw Error('Invalid private budget ledger')
  const persist=()=>{fs.writeFileSync(ledger+'.tmp',JSON.stringify(state),{mode:0o600});fs.renameSync(ledger+'.tmp',ledger)}
  const inflight=new Set()
  const reject=(res,status,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error:{message,type:'local_budget_guard',code:'local_budget_guard'}}))}
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/v1/chat/completions'||req.headers.authorization!==`Bearer ${token}`)return reject(res,403,'Unauthorized relay request')
    let finish
    const finished=new Promise(resolve=>{finish=resolve})
    inflight.add(finished)
    const disconnected=new AbortController()
    res.once('close',()=>{if(!res.writableEnded)disconnected.abort()})
    try {
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>1000000)throw Error('Request too large');chunks.push(chunk)}
      const before=state.reservedMicros
      const payload=reserveRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')),state,countInputTokens)
      const reservation=state.reservedMicros-before
      // Persist before sending: restarting the scanner cannot reset its budget.
      persist()
      // Fixed destination; never forward incoming auth headers or arbitrary URLs.
      const upstream=await fetchUpstream('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:payload,signal:AbortSignal.any([AbortSignal.timeout(300000),disconnected.signal]),redirect:'error'})
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
            if(upstream.status===200&&done){settleUsage(state,reservation,usage,JSON.parse(payload).max_completion_tokens);persist()}
            resolve()
          })
          source.once('error',()=>{res.destroy();resolve()});source.once('close',resolve)
          source.pipe(res)
        })
      }else res.end()
    }catch(error){if(!res.headersSent)reject(res,429,error.message);else res.destroy()}
    finally{inflight.delete(finished);finish()}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  return {base:`http://127.0.0.1:${server.address().port}/v1`,token,state,close:async()=>{await new Promise(resolve=>server.close(resolve));await Promise.all(inflight);fs.unlinkSync(lock)}}
}
