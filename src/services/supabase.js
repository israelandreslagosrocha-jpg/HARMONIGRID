import {createClient} from '@supabase/supabase-js'

export function validateSupabaseConfig(env) {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !key) throw new Error('Falta configurar la URL y la clave pública de Supabase.')
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new Error('La URL de Supabase debe ser un origen HTTPS válido.')
  }
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)
  if (!publicKey && key.split('.').length === 3) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      publicKey = payload.role === 'anon'
    } catch { /* Reject malformed or privileged keys. */ }
  }
  if (!publicKey) throw new Error('Usa solamente la clave publishable o anon. Las claves administrativas no pertenecen al navegador.')
  return {url: parsed.origin, key}
}

let client
export function getSupabaseClient() {
  if (!client) {
    const config = validateSupabaseConfig(import.meta.env ?? {})
    client = createClient(config.url, config.key, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'harmonigrid-auth-v1',
      },
    })
  }
  return client
}
