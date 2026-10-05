import assert from 'node:assert/strict'
import {validateReleaseConfig} from '../scripts/release-config.mjs'
const valid={VITE_SUPABASE_URL:'https://wvkldhkgznersewjmhzo.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_test'}
let checks=0
const same=(actual,expected)=>{assert.deepEqual(actual,expected);checks++}
const denied=env=>{assert.throws(()=>validateReleaseConfig(env));checks++}
same(validateReleaseConfig(valid).callbackMode,'current-origin')
for(const value of [{}, {...valid,VITE_SUPABASE_PUBLISHABLE_KEY:''}, {...valid,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_never_client'}, {...valid,VITE_SUPABASE_URL:'https://other-project.supabase.co'}])denied(value)
for(const callback of ['http://localhost:4173/','https://user:pass@harmonigrid.app/','https://harmonigrid.app/?token=anything','https://harmonigrid.app/#token','not-a-url'])denied({...valid,VITE_AUTH_REDIRECT_URL:callback})
same(validateReleaseConfig({...valid,VITE_AUTH_REDIRECT_URL:'https://preview-example.vercel.app/',VERCEL_URL:'preview-example.vercel.app',VERCEL_ENV:'preview'}).callbackMode,'explicit')
denied({...valid,VITE_AUTH_REDIRECT_URL:'https://harmonigrid.app/',VERCEL_URL:'preview-example.vercel.app',VERCEL_ENV:'preview'})
same(validateReleaseConfig({...valid,VITE_AUTH_REDIRECT_URL:'https://harmonigrid.app/',VERCEL_URL:'build-example.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'harmonigrid.app',VERCEL_ENV:'production'}).callbackMode,'explicit')
same(validateReleaseConfig({...valid,VERCEL_ENV:'preview',VERCEL_URL:'preview-example.vercel.app'}).callbackMode,'current-origin')
console.log(`${checks} release configuration, privileged-key rejection and callback-origin checks passed`)
