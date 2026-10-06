// Source-only, text-only scan. Conservative reservations are never refunded,
// including failed calls/retries. Prices checked against official GPT-5.4 docs.
import http from 'node:http'
import {randomBytes} from 'node:crypto'
import {Readable} from 'node:stream'
import fs from 'node:fs'
import path from 'node:path'
export function reserveRequest(body,state) {
  if(body?.model!=='gpt-5.4'||!Array.isArray(body.messages)||body.messages.length>200)throw Error('Unsupported model or messages')
  for(const message of body.messages) {
    if(typeof message.content==='string'||message.content==null)continue
    if(!Array.isArray(message.content)||message.content.some(part=>part.type!=='text'||typeof part.text!=='string'))throw Error('Text-only scan required')
  }
  if(body.tools?.some(tool=>tool.type!=='function'))throw Error('Paid hosted tools are not allowed')
  const request={...body,service_tier:'default',n:1,max_completion_tokens:4096}
  delete request.max_tokens
  delete request.prediction
  const payload=JSON.stringify(request)
  const bytes=Buffer.byteLength(payload)
  if(bytes>100000)throw Error('Request exceeds conservative text budget')
  // UTF-8 byte count plus framing allowance overestimates text token count.
  // US$6/M input and US$30/M output exceed documented standard/long-context rates.
  const reservation=Math.ceil(((bytes+16384)*6+4096*30)/1000000*1000000)
  if(state.reservedMicros+reservation>4500000)throw Error('Local scan budget exhausted')
  state.reservedMicros+=reservation
  state.calls++
  return payload
}
export async function startBudgetRelay(apiKey,privateDirectory,fetchUpstream=fetch) {
  const token=randomBytes(32).toString('hex')
  const ledger=path.join(privateDirectory,'strix-budget-state.json')
  const lock=path.join(privateDirectory,'strix-budget.lock')
  fs.closeSync(fs.openSync(lock,'wx',0o600))
  const state=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):{reservedMicros:0,calls:0}
  if(!Number.isSafeInteger(state.reservedMicros)||state.reservedMicros<0||state.reservedMicros>4500000||!Number.isSafeInteger(state.calls)||state.calls<0)throw Error('Invalid private budget ledger')
  const reject=(res,status,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error:{message,type:'local_budget_guard',code:'local_budget_guard'}}))}
  const server=http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/v1/chat/completions'||req.headers.authorization!==`Bearer ${token}`)return reject(res,403,'Unauthorized relay request')
    try {
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>100000)throw Error('Request too large');chunks.push(chunk)}
      const payload=reserveRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')),state)
      // Persist before sending: restarting the scanner cannot reset its budget.
      fs.writeFileSync(ledger+'.tmp',JSON.stringify(state),{mode:0o600})
      fs.renameSync(ledger+'.tmp',ledger)
      // Fixed destination; never forward incoming auth headers or arbitrary URLs.
      const upstream=await fetchUpstream('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:payload,signal:AbortSignal.timeout(300000),redirect:'error'})
      res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'application/json'})
      if(upstream.body)Readable.fromWeb(upstream.body).on('error',()=>res.destroy()).pipe(res);else res.end()
    }catch(error){if(!res.headersSent)reject(res,429,error.message);else res.destroy()}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  return {base:`http://127.0.0.1:${server.address().port}/v1`,token,state,close:()=>{server.close();fs.unlinkSync(lock)}}
}
