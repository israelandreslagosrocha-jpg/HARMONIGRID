import {validateSupabaseConfig} from '../src/services/supabase.js'
const PROJECT_ORIGIN='https://wvkldhkgznersewjmhzo.supabase.co'
export function validateReleaseConfig(env) {
  const config=validateSupabaseConfig(env)
  if(config.url!==PROJECT_ORIGIN)throw new Error('El build de lanzamiento debe usar el proyecto Supabase aprobado de HarmoniGrid; revisa URL y CSP antes de cambiarlo.')
  if(env.VITE_AUTH_REDIRECT_URL?.trim()) {
    const callback=new URL(env.VITE_AUTH_REDIRECT_URL.trim())
    if(callback.protocol!=='https:'||callback.username||callback.password||callback.search||callback.hash) {
      throw new Error('El retorno de autenticación del lanzamiento debe ser HTTPS y no incluir credenciales, query ni hash.')
    }
    const deploymentHost=env.VERCEL_ENV==='production'?env.VERCEL_PROJECT_PRODUCTION_URL:env.VERCEL_URL
    if(deploymentHost&&callback.origin!==new URL(`https://${deploymentHost}`).origin) {
      throw new Error('El retorno de autenticación debe pertenecer al mismo origen del despliegue. Déjalo vacío para usar automáticamente el origen actual.')
    }
  }
  return {supabaseOrigin:config.url,callbackMode:env.VITE_AUTH_REDIRECT_URL?.trim()?'explicit':'current-origin'}
}
