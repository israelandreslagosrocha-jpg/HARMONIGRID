import assert from 'node:assert/strict'
import {prepareGoogleLogin,preserveGoogleDraft,restoreGoogleDraft} from '../src/services/googleAuth.js'
import {createEditor} from './component-harness.mjs'
const origin='https://wvkldhkgznersewjmhzo.supabase.co'
let call
const client={auth:{async signInWithOAuth(input){call=input;return {data:{url:`${origin}/auth/v1/authorize?provider=google`},error:null}}}}
assert.equal(await prepareGoogleLogin(client,'https://preview.example/',origin),`${origin}/auth/v1/authorize?provider=google`)
assert.equal(call.provider,'google');assert.equal(call.options.skipBrowserRedirect,true);assert.equal(call.options.redirectTo,'https://preview.example/')
for(const url of ['https://evil.example/auth/v1/authorize?provider=google',`${origin}/other?provider=google`,`${origin}/auth/v1/authorize?provider=github`])await assert.rejects(prepareGoogleLogin({auth:{async signInWithOAuth(){return{data:{url}}}}},'https://preview.example/',origin))
await assert.rejects(prepareGoogleLogin({auth:{async signInWithOAuth(){return{error:new Error('provider disabled')}}}},'https://preview.example/',origin),/provider disabled/)
const rows=new Map(),storage={getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)}
const h=await createEditor()
try {
 h.editor.startProject();const document=JSON.parse(JSON.stringify(h.editor.cloudDocument.value))
 preserveGoogleDraft(storage,document,1000);assert.deepEqual(restoreGoogleDraft(storage,1001),document)
 assert.equal(restoreGoogleDraft(storage,1801001),null);assert.equal(rows.size,0)
 preserveGoogleDraft(storage,document,1000);assert.equal(restoreGoogleDraft(storage,999),null)
 preserveGoogleDraft(storage,document,1000);preserveGoogleDraft(storage,null,1001);assert.equal(restoreGoogleDraft(storage,1002),null)
}finally{h.stop()}
console.log('Google OAuth: secure destination, error handling and draft recovery passed')
