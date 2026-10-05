import {validateProjectDocument} from '../core/projectDocument.js'
const DRAFT_KEY='harmonigrid-google-return-v1'
const MAX_AGE=30*60*1000
export function preserveGoogleDraft(storage,document,now=Date.now()) {
  storage.removeItem(DRAFT_KEY)
  if(document)storage.setItem(DRAFT_KEY,JSON.stringify({createdAt:now,document:validateProjectDocument(document)}))
}
export function restoreGoogleDraft(storage,now=Date.now()) {
  const raw=storage.getItem(DRAFT_KEY)
  if(!raw)return null
  const data=JSON.parse(raw)
  if(!Number.isFinite(data.createdAt)||now-data.createdAt<0||now-data.createdAt>MAX_AGE){storage.removeItem(DRAFT_KEY);return null}
  return validateProjectDocument(data.document)
}
export function clearGoogleDraft(storage){storage.removeItem(DRAFT_KEY)}
export async function prepareGoogleLogin(client,redirectTo,supabaseUrl) {
  const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}})
  if(error)throw error
  const url=new URL(data?.url)
  if(url.origin!==new URL(supabaseUrl).origin||url.pathname!=='/auth/v1/authorize'||url.searchParams.get('provider')!=='google')throw new Error('No se recibió una dirección segura para iniciar sesión con Google.')
  return url.href
}
