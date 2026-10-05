// Test-only local simulator. No real accounts, emails or Supabase writes.
let session=null,callbacks=[],offline=false
const rows=new Map()
export function switchAccount(id){session=id?{user:{id,email:`${id}@example.test`},access_token:`test-${id}`}:null;callbacks.forEach(fn=>fn('SIGNED_IN',session))}
export function setOffline(value){offline=value}
export function changeRemote(){for(const row of rows.values())if(row.owner_id===session?.user.id)row.revision++}
export function getSupabaseClient(){return client}
const client={auth:{async getSession(){return{data:{session},error:null}},onAuthStateChange(fn){callbacks.push(fn);return{data:{subscription:{unsubscribe(){callbacks=callbacks.filter(x=>x!==fn)}}}}},async signOut(){switchAccount(null);return{error:null}}},from(){
 let operation='select',payload,fields='*',filters=[],range=[0,49],single=false,token
 const query={select(value){fields=value;return query},insert(value){operation='insert';payload=value;return query},update(value){operation='update';payload=value;return query},eq(k,v){filters.push([k,v]);return query},order(){return query},range(a,b){range=[a,b];return query},setHeader(k,v){if(k==='Authorization')token=v;return query},single(){single=true;return query},maybeSingle(){single=true;return query},then(resolve,reject){return Promise.resolve().then(()=>{
  if(offline)return{data:null,error:{message:'Sin conexión (simulación local)'}}
  const owner=token?.replace('Bearer test-','')
  if(!owner||owner!==session?.user.id)return{data:null,error:{message:'Acceso denegado'}}
  let result=[...rows.values()].filter(r=>r.owner_id===owner&&filters.every(([k,v])=>r[k]===v))
  if(operation==='insert'){
   if(rows.has(payload.id))return{data:null,error:{code:'23505',message:'Duplicado'}}
   const row={...structuredClone(payload),owner_id:owner,revision:1,updated_at:new Date().toISOString()};rows.set(row.id,row);result=[row]
  }else if(operation==='update')result=result.map(r=>{Object.assign(r,structuredClone(payload),{revision:r.revision+1,updated_at:new Date().toISOString()});return r})
  if(!single)result=result.slice(range[0],range[1]+1)
  const clean=result.map(r=>fields==='*'?structuredClone(r):Object.fromEntries(fields.split(',').map(k=>[k,r[k]])))
  return{data:single?(clean[0]??null):clean,error:null}
 }).then(resolve,reject)}}
 return query
}}
