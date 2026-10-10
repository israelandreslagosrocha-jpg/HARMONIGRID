// Live API audit: public key only. Never print credentials or response bodies.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {validateSupabaseConfig} from '../src/services/supabase.js'

if(fs.existsSync('.env.local'))process.loadEnvFile('.env.local')
if(fs.existsSync('.env.audit.local'))process.loadEnvFile('.env.audit.local')
const {url,key}=validateSupabaseConfig(process.env)
assert.equal(new URL(url).hostname,'wvkldhkgznersewjmhzo.supabase.co','Unexpected audit target')
const clients=[]
function client(){const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});clients.push(c);return c}
const table='harmonigrid_projects'
let checks=0
function check(condition,label){assert.ok(condition,label);checks++;console.log(`PASS: ${label}`)}
const publicClient=client()
const anonymous=await publicClient.from(table).select('id').limit(1)
check(Boolean(anonymous.error)&&[401,403].includes(anonymous.status),'Anonymous project reads denied')
const names=['HG_AUDIT_A_EMAIL','HG_AUDIT_A_PASSWORD','HG_AUDIT_B_EMAIL','HG_AUDIT_B_PASSWORD']
if(!names.every(name=>process.env[name])){
 console.log('Two-account API checks PENDING: configure .env.audit.local locally; do not send passwords in chat.')
 process.exitCode=2
}else{
 const a=client(),b=client()
 const login=async(c,prefix)=>{
  const {data,error}=await c.auth.signInWithPassword({email:process.env[`HG_AUDIT_${prefix}_EMAIL`],password:process.env[`HG_AUDIT_${prefix}_PASSWORD`]})
  if(error)throw new Error(`Audit ${prefix} login failed (${error.status||'unknown'}); no credentials logged`)
  assert.ok(data.user.email_confirmed_at,`Audit ${prefix} must be verified`)
  return data.user.id
 }
 try{
  const aid=await login(a,'A'),bid=await login(b,'B')
  assert.notEqual(aid,bid,'Two distinct accounts required')
  // All mutation attempts target this disposable fixture, never existing songs.
  // Client deletion is intentionally denied; retain fixture for owner review.
  const id=randomUUID(),title=`AUDITORÍA API · ${new Date().toISOString()}`
  const inserted=await a.from(table).insert({id,title,document:{measures:[{id:'audit-measure',beats:[]}]}}).select('id,owner_id,revision,title').single()
  check(!inserted.error&&inserted.data?.owner_id===aid,'A creates an owned test fixture')
  console.log(`Test fixture retained for review: ${id}`)
  const baseline=inserted.data
  const foreignRead=await b.from(table).select('id').eq('id',id)
  check(!foreignRead.error&&foreignRead.data.length===0,'B cannot read A fixture by exact ID')
  const foreignWrite=await b.from(table).update({title:'UNAUTHORIZED AUDIT WRITE'}).eq('id',id).select('id')
  check(!foreignWrite.error&&foreignWrite.data.length===0,'B cannot update A fixture')
  const foreignDelete=await b.from(table).delete().eq('id',id)
  check(Boolean(foreignDelete.error)&&[401,403].includes(foreignDelete.status),'B cannot delete A fixture')
  const transfer=await a.from(table).update({owner_id:bid}).eq('id',id)
  check(Boolean(transfer.error)&&[401,403].includes(transfer.status),'A cannot transfer fixture ownership')
  const final=await a.from(table).select('id,owner_id,revision,title').eq('id',id).single()
  assert.ifError(final.error);assert.deepEqual(final.data,baseline)
  check(true,'A fixture remains unchanged after adversarial requests')
 }finally{
  // Local-only session removal; no global sign-out of users' app sessions.
  for(const c of [a,b])await c.auth.signOut({scope:'local'})
 }
}
console.log(`${checks} live API checks passed; remaining checks are explicitly pending when credentials are absent.`)
