import assert from 'node:assert/strict'
import {requestAccountEmail} from '../src/services/accountEmail.js'
let sent
const client={auth:{async resend(args){sent=args;return{error:null}},async resetPasswordForEmail(email,options){sent={email,options};return{error:null}}}}
const redirect='https://harmonigrid.app/'
assert.match(await requestAccountEmail(client,'confirmation',' musician@example.com ',redirect),/Si tu cuenta necesita/)
assert.deepEqual(sent,{type:'signup',email:'musician@example.com',options:{emailRedirectTo:redirect}})
assert.match(await requestAccountEmail(client,'recovery','musician@example.com',redirect),/Si existe una cuenta/)
assert.deepEqual(sent,{email:'musician@example.com',options:{redirectTo:redirect}})
for(const kind of ['confirmation','recovery'])await assert.rejects(requestAccountEmail({auth:{resend:async()=>({error:new Error('rate limit')}),resetPasswordForEmail:async()=>({error:new Error('rate limit')})}},kind,'x@example.com',redirect),/rate limit/)
await assert.rejects(requestAccountEmail(client,'unknown','x@example.com',redirect),/desconocida/)
await assert.rejects(requestAccountEmail(client,'confirmation',' ',redirect),/correo/)
await assert.rejects(requestAccountEmail(client,'recovery','x@example.com','javascript:alert(1)'),/inválido/)
console.log('Account emails: verification and recovery requests, neutral responses and error preservation passed')
