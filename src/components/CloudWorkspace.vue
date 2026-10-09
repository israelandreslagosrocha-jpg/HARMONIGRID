<script setup>
import {ref,shallowRef,computed,watch,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {preserveGoogleDraft,restoreGoogleDraft,clearGoogleDraft,prepareGoogleLogin} from '../services/googleAuth.js'
import {getSupabaseClient} from '../services/supabase.js'
import {createProjectRepository} from '../services/projects.js'
import {projectRecovery} from '../services/projectRecovery.js'
import {createProjectAutosave} from '../core/projectAutosave.js'
import {validateProjectDocument} from '../core/projectDocument.js'

const props=defineProps({document:Object,generation:Number,toolbarTarget:Object})
const emit=defineEmits(['load','clear-account'])
const user=shallowRef(null),open=ref(false),dialog=ref(null),accountButton=ref(null),mode=ref('login'),email=ref(''),password=ref(''),busy=ref(false),message=ref(''),projects=ref([]),drafts=ref([]),more=ref(false),ready=ref(false)
const menuOpen=ref(false),accountMenu=ref(null),menuTop=ref(64)
function toggleAccountMenu() {
  menuTop.value=(accountButton.value?.getBoundingClientRect().bottom||56)+4
  menuOpen.value=!menuOpen.value
}
function showAccount() {menuOpen.value=false;open.value=true}
watch(menuOpen,async value=>{
  await nextTick()
  if(value)accountMenu.value?.querySelector('button')?.focus()
  else if(!open.value)accountButton.value?.focus()
})
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
  <Teleport :to="toolbarTarget || 'body'" :disabled="!toolbarTarget">
    <button ref="accountButton" type="button" @click="toggleAccountMenu" aria-label="Cuenta y composiciones" :aria-expanded="menuOpen" aria-controls="account-navigation"
      :title="label" class="account-icon relative flex items-center justify-center w-11 h-11 rounded-full text-gray-900 hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#244000]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-6 h-6" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0114 0v2"/></svg>
      <span v-if="user" class="absolute right-1 top-1 w-2 h-2 rounded-full" :class="['error','conflict'].includes(saveState.status) ? 'bg-red-700' : saveState.dirty ? 'bg-amber-600' : 'bg-green-700'"></span>
      <span role="status" aria-live="polite" class="sr-only">{{ label }} {{ saveState.message }}</span>
    </button>
  </Teleport>
  <Teleport to="body">
    <div v-if="menuOpen" class="fixed inset-0 z-[190]" @click.self="menuOpen=false" @keydown.esc.prevent="menuOpen=false">
      <nav id="account-navigation" ref="accountMenu" aria-label="Menú de cuenta" :style="{top:menuTop+'px'}" class="hg-account-menu absolute right-3 w-80 max-w-[calc(100vw-24px)] max-h-[70dvh] overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-3 space-y-2 text-sm text-gray-800">
        <div class="flex items-center justify-between"><strong>HarmoniGrid · Cuenta</strong><button @click="menuOpen=false" aria-label="Cerrar menú de cuenta" class="min-h-11 px-3">✕</button></div>
        <p class="text-gray-600">{{ label }}</p>
        <p v-if="saveState.message" role="alert" class="text-red-700 break-words">{{ saveState.message }}</p>
        <button @click="showAccount" class="block w-full text-left min-h-11 rounded-lg px-3 hover:bg-gray-100">{{ user ? '☰ Mis composiciones y cuenta' : '☰ Iniciar sesión / crear cuenta' }}</button>
        <button v-if="user && document" :disabled="busy || !ready" @click="save()" class="block w-full text-left min-h-11 rounded-lg px-3 hover:bg-gray-100 disabled:opacity-50">{{ saveState.id ? 'Guardar ahora' : 'Guardar en mi cuenta' }}</button>
        <p class="border-t border-gray-100 pt-2 text-xs text-gray-500">Próximamente: nuevas herramientas musicales.</p>
      </nav>
    </div>
  </Teleport>
  <div v-if="open" class="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-3" @click.self="!busy && (open=false)">
    <section ref="dialog" role="dialog" aria-modal="true" aria-labelledby="account-heading" @keydown="trapKeys" class="hg-account-dialog bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto p-5 space-y-4 text-sm">
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
          <button :disabled="busy || !ready" class="hg-account-primary w-full bg-[#8EE000] text-[#172600] rounded-lg px-4 py-3 disabled:opacity-50">{{ busy ? 'Procesando…' : mode==='register' ? 'Crear cuenta' : mode==='reset' ? 'Enviar enlace de recuperación' : mode==='password' ? 'Actualizar contraseña' : 'Iniciar sesión' }}</button>
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
        <button v-for="project in projects" :key="project.id" :disabled="busy" @click="load(project)" class="hg-composition block w-full text-left border rounded-xl p-3 hover:bg-gray-50">
          <span class="block font-semibold break-words">{{ project.title }}</span>
          <span class="block text-xs text-gray-500">{{ new Date(project.updated_at).toLocaleString() }}</span>
        </button>
        <button v-if="more" :disabled="busy" @click="listProjects(true)" class="border rounded-lg px-3 py-2">Ver más composiciones</button>
        <button :disabled="busy" @click="logout" class="text-red-700 border rounded-lg px-3 py-2">Cerrar sesión</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.hg-account-menu, .hg-account-dialog {
  color: #172600;
  background: linear-gradient(135deg, #f5fce6, #fff 65%);
  border: 1px solid #cde7a2;
  box-shadow: 0 16px 48px #17260026;
}
.hg-account-dialog header { border-bottom: 3px solid #8ee000; padding-bottom: 14px; }
.hg-account-menu strong, .hg-account-dialog h2 { color: #244000; }
.hg-account-menu button, .hg-account-dialog button { min-height: 44px; transition: background-color .15s; }
.hg-account-menu button:hover:not(:disabled), .hg-account-dialog button:hover:not(:disabled) { background: #e9f7d0; }
.hg-account-dialog input { font-size: 16px; border-color: #b9ce9b; background: #fff; }
.hg-account-dialog input:focus-visible, .hg-account-dialog button:focus-visible, .hg-account-menu button:focus-visible {
  outline: 2px solid #477000; outline-offset: 3px;
}
.hg-account-primary { font-weight: 700; border: 1px solid #6ca600; }
.hg-account-dialog .hg-account-primary:hover:not(:disabled) { background: #7bca00; }
.hg-composition { border-color: #cde7a2; background: #fff; border-left: 4px solid #8ee000; }
.hg-account-dialog nav button { color: #365600; text-decoration: underline; text-underline-offset: 4px; }
.hg-account-dialog button:disabled { opacity: .5; }
</style>
