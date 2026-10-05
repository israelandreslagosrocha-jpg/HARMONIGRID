<script setup>
import {ref,shallowRef,computed,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {preserveGoogleDraft,restoreGoogleDraft,clearGoogleDraft,prepareGoogleLogin} from '../services/googleAuth.js'
import {getSupabaseClient} from '../services/supabase.js'
import {createProjectRepository} from '../services/projects.js'
import {projectRecovery} from '../services/projectRecovery.js'
import {createProjectAutosave} from '../core/projectAutosave.js'
import {validateProjectDocument} from '../core/projectDocument.js'

const props=defineProps({document:Object,generation:Number})
const emit=defineEmits(['load','clear-account'])
const user=shallowRef(null),open=ref(false),dialog=ref(null),accountButton=ref(null),mode=ref('login'),email=ref(''),password=ref(''),busy=ref(false),message=ref(''),projects=ref([]),drafts=ref([]),more=ref(false),ready=ref(false)
const saveState=shallowRef({status:'guest',dirty:false,id:null,message:''})
let client,repository,autosave,subscription,applying=false,authEpoch=0,disposed=false
const labels={guest:'Inicia sesión para guardar',unsaved:'Composición sin guardar',pending:'Cambios pendientes',saving:'Guardando…',saved:'Guardado en tu cuenta',error:'No se pudo guardar',conflict:'Conflicto entre versiones'}
const label=computed(()=>labels[saveState.value.status]||'Sin conexión')
const redirect=()=>{
  const configured=import.meta.env.VITE_AUTH_REDIRECT_URL
  const url=new URL(configured||location.pathname||'/',location.origin)
  if(url.origin!==location.origin)throw new Error('La URL de retorno debe corresponder a esta versión de la aplicación.')
  return url.href
}
async function listProjects(append=false) {
  if(!user.value||!repository)return
  const owner=user.value.id,epoch=authEpoch
  const [remote,local]=await Promise.allSettled([repository.list(owner,append?projects.value.length:0),projectRecovery.list(owner)])
  if(epoch!==authEpoch||disposed)return
  if(local.status==='fulfilled')drafts.value=local.value
  if(remote.status==='fulfilled') {
    const rows=remote.value
    projects.value=append?[...projects.value,...rows]:rows;more.value=rows.length===50
  } else message.value=remote.reason.message

}
function sessionChanged(session,event) {
  if(disposed)return
  const next=session?.user&&!session.user.is_anonymous?session.user:null
  const previous=user.value?.id
  if(previous!==next?.id) {
    authEpoch++;projects.value=[];drafts.value=[];message.value='';password.value=''
    autosave.setOwner(next?.id||null)
    if(previous)emit('clear-account')
    user.value=next
    if(next)queueMicrotask(()=>{if(!disposed)listProjects()})
  }
  user.value=next
  if(event==='PASSWORD_RECOVERY'){mode.value='password';open.value=true;message.value='Elige tu nueva contraseña.'}
}
onMounted(async()=>{
  try {
    client=getSupabaseClient();repository=createProjectRepository(client)
    autosave=createProjectAutosave({repository,recovery:projectRecovery,onState:state=>{saveState.value=state}})
    const result=client.auth.onAuthStateChange((event,session)=>sessionChanged(session,event));subscription=result.data.subscription
    const initialEpoch=authEpoch
    const {data,error}=await client.auth.getSession()
    if(error)throw error
    if(!disposed&&initialEpoch===authEpoch)sessionChanged(data.session,'INITIAL_SESSION')
    ready.value=true
    const returningDraft=restoreGoogleDraft(sessionStorage)
    if(returningDraft&&!props.document){emit('load',returningDraft);await nextTick();clearGoogleDraft(sessionStorage)}
    if(new URLSearchParams(location.search).has('error')){open.value=true;message.value='No se completó el acceso con Google. Puedes volver a intentarlo; tu composición se conserva.'}
  }catch(error){message.value=error.message}
  if(disposed)return
  window.addEventListener('beforeunload',beforeUnload)
  window.addEventListener('online',retryOnline)
})
watch(()=>props.generation,()=>{autosave?.beginNew()})
watch(()=>props.document,document=>{if(!applying)autosave?.changed(document)})
watch(open,async value=>{await nextTick();if(value){dialog.value?.querySelector('input,button')?.focus();if(user.value)listProjects()}else accountButton.value?.focus()})
function beforeUnload(event){if(props.document&&(!saveState.value.id||saveState.value.dirty)){event.preventDefault();event.returnValue=''}}
function retryOnline(){if(saveState.value.status==='error')autosave?.flush().catch(()=>{})}
function trapKeys(event){
  if(event.key==='Escape'&&!busy.value){open.value=false;return}
  if(event.key!=='Tab')return
  const elements=[...dialog.value.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el=>el.getClientRects().length)
  const first=elements[0],last=elements.at(-1)
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
}
async function googleLogin() {
  if(busy.value||!ready.value)return
  busy.value=true;message.value=''
  try {
    const url=await prepareGoogleLogin(client,redirect(),import.meta.env.VITE_SUPABASE_URL)
    // Capture before leaving: OAuth reloads the editor, unlike email/password login.
    preserveGoogleDraft(sessionStorage,props.document)
    location.assign(url)
  }catch(error){message.value=`No se pudo iniciar el acceso con Google: ${error.message}`}finally{busy.value=false}
}
async function authenticate() {
  busy.value=true;message.value=''
  try {
    let result
    if(mode.value==='register') {
      result=await client.auth.signUp({email:email.value.trim(),password:password.value,options:{emailRedirectTo:redirect()}})
      if(!result.error)message.value='Revisa tu correo para confirmar tu cuenta. Si ya está registrada, inicia sesión o recupera el acceso.'
    }else if(mode.value==='reset') {
      result=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:redirect()})
      if(!result.error)message.value='Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.'
    }else if(mode.value==='password') {
      result=await client.auth.updateUser({password:password.value})
      if(!result.error){message.value='Contraseña actualizada.';mode.value='login'}
    }else result=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value})
    if(result.error)throw result.error
    password.value=''
  }catch(error){message.value=error.message}finally{busy.value=false}
}
async function save(copy=false) {
  if(!props.document||!autosave)return
  const snapshot=props.document,epoch=authEpoch,generation=props.generation
  busy.value=true;message.value=''
  try {
    if(copy||!saveState.value.id)await autosave.saveNew(snapshot)
    else await autosave.flush()
    if(epoch===authEpoch&&generation===props.generation&&props.document!==snapshot){autosave.changed(props.document);await autosave.flush()}
    await listProjects()
  }catch(error){if(epoch===authEpoch)message.value=error.message}finally{busy.value=false}
}
async function load(row,local=false) {
  const owner=user.value?.id,epoch=authEpoch
  if(!owner)return
  busy.value=true;message.value=''
  try {
    // Save the current associated project before replacing its editor contents.
    // Conflict/error aborts the replacement and leaves current work intact.
    await autosave.flush()
    const data=local?{...row,document:validateProjectDocument(row.document)}:await repository.load(row.id,owner)
    if(epoch!==authEpoch||disposed)return
    // Visitor work is not discarded silently when opening a saved composition.
    if(props.document&&!saveState.value.id) {
      message.value='Guarda primero la composición actual en tu cuenta antes de abrir otra.'
      return
    }
    applying=true;emit('load',data.document);await nextTick()
    if(epoch!==authEpoch||disposed)return
    if(local)autosave.recover(data);else autosave.attach(data)
    open.value=false
  }catch(error){if(epoch===authEpoch)message.value=error.message}finally{applying=false;busy.value=false}
}
async function logout() {
  busy.value=true;message.value=''
  try {
    await autosave.flush()
    const {error}=await client.auth.signOut({scope:'local'})
    if(error)throw error
    mode.value='login'
  }catch(error){message.value=`No se cerró la sesión: ${error.message}`}finally{busy.value=false}
}
onBeforeUnmount(()=>{
  disposed=true;subscription?.unsubscribe();autosave?.dispose()
  window.removeEventListener('beforeunload',beforeUnload);window.removeEventListener('online',retryOnline)
})
</script>
<template>
  <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 bg-white border-b border-gray-200 px-3 py-2 text-xs">
    <span role="status" aria-live="polite" class="min-w-0 text-gray-600">{{ label }}</span>
    <div class="flex gap-2">
      <button v-if="user && document" :disabled="busy || !ready" @click="save()" class="rounded-lg bg-violet-700 text-white px-3 py-2 disabled:opacity-50">{{ saveState.id ? 'Guardar ahora' : 'Guardar en mi cuenta' }}</button>
      <button ref="accountButton" @click="open=true" class="rounded-lg border border-gray-300 px-3 py-2">{{ user ? 'Mis composiciones' : 'Cuenta' }}</button>
    </div>
    <p v-if="saveState.message" class="w-full text-red-700">{{ saveState.message }}</p>
  </div>
  <div v-if="open" class="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-3" @click.self="!busy && (open=false)">
    <section ref="dialog" role="dialog" aria-modal="true" aria-labelledby="account-heading" @keydown="trapKeys" class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 space-y-4 text-sm">
      <header class="flex justify-between items-center gap-3">
        <h2 id="account-heading" class="text-xl font-bold">{{ user ? 'Mis composiciones' : 'Tu cuenta HarmoniGrid' }}</h2>
        <button :disabled="busy" @click="open=false" aria-label="Cerrar cuenta y proyectos" class="px-3 py-2 border rounded-lg">Cerrar</button>
      </header>
      <p v-if="message" role="status" class="rounded-lg bg-gray-100 p-3 break-words">{{ message }}</p>
      <template v-if="!user || mode==='password'">
        <template v-if="mode==='login' || mode==='register'">
          <button type="button" :disabled="busy || !ready" @click="googleLogin" class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50">Continuar con Google</button>
          <p class="text-center text-xs text-gray-500">o utiliza tu correo electrónico</p>
        </template>
        <form @submit.prevent="authenticate" class="space-y-4">
          <label v-if="mode!=='password'" class="block">Correo electrónico
            <input v-model="email" type="email" autocomplete="email" required :disabled="busy || !ready" class="mt-1 w-full rounded-lg border p-3" />
          </label>
          <label v-if="mode!=='reset'" class="block">{{ mode==='password' ? 'Nueva contraseña' : 'Contraseña' }}
            <input v-model="password" type="password" :autocomplete="mode==='login'?'current-password':'new-password'" :minlength="mode==='login'?6:8" required :disabled="busy || !ready" class="mt-1 w-full rounded-lg border p-3" />
          </label>
          <button :disabled="busy || !ready" class="w-full bg-violet-700 text-white rounded-lg px-4 py-3 disabled:opacity-50">{{ busy ? 'Procesando…' : mode==='register' ? 'Crear cuenta' : mode==='reset' ? 'Enviar enlace de recuperación' : mode==='password' ? 'Actualizar contraseña' : 'Iniciar sesión' }}</button>
        </form>
        <nav class="flex flex-wrap gap-3" aria-label="Opciones de cuenta">
          <button :disabled="busy" @click="mode='login'; message=''">Iniciar sesión</button>
          <button :disabled="busy" @click="mode='register'; message=''">Crear cuenta</button>
          <button :disabled="busy" @click="mode='reset'; message=''">Recuperar acceso</button>
        </nav>
        <p class="text-xs text-gray-500">Confirma tu correo para acceder. Tus composiciones se guardan vinculadas a tu cuenta.</p>
      </template>
      <template v-else>
        <p class="text-gray-600 break-all">{{ user.email }}</p>
        <div class="flex flex-wrap gap-2">
          <button :disabled="busy || !document" @click="save()" class="border rounded-lg px-3 py-2">Guardar composición actual</button>
          <button :disabled="busy || !document" @click="save(true)" class="border rounded-lg px-3 py-2">Guardar como copia</button>
          <button :disabled="busy" @click="listProjects()" class="border rounded-lg px-3 py-2">Actualizar lista</button>
        </div>
        <div v-if="drafts.length" class="rounded-xl border border-amber-300 p-3 space-y-2">
          <h3 class="font-bold">Borradores de recuperación de esta cuenta</h3>
          <button v-for="draft in drafts" :key="draft.checkpoint" :disabled="busy" @click="load(draft,true)" class="block w-full text-left border rounded-lg p-3">Recuperar: {{ draft.document.title }} · {{ new Date(draft.recovered_at).toLocaleString() }}</button>
        </div>
        <p v-if="!projects.length" class="text-gray-500">Aún no hay composiciones guardadas en esta cuenta.</p>
        <button v-for="project in projects" :key="project.id" :disabled="busy" @click="load(project)" class="block w-full text-left border rounded-xl p-3 hover:bg-gray-50">
          <span class="block font-semibold break-words">{{ project.title }}</span>
          <span class="block text-xs text-gray-500">{{ new Date(project.updated_at).toLocaleString() }}</span>
        </button>
        <button v-if="more" :disabled="busy" @click="listProjects(true)" class="border rounded-lg px-3 py-2">Ver más composiciones</button>
        <button :disabled="busy" @click="logout" class="text-red-700 border rounded-lg px-3 py-2">Cerrar sesión</button>
      </template>
    </section>
  </div>
</template>
