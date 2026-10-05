import {loadEnv} from 'vite'
import {validateReleaseConfig} from './release-config.mjs'
try {
 const env={...loadEnv('production',process.cwd(),'VITE_'),...process.env}
 const config=validateReleaseConfig(env)
 console.log(`Configuración pública de lanzamiento válida: ${config.supabaseOrigin}; retorno ${config.callbackMode}. No se verificaron cuentas ni políticas remotas.`)
}catch(error){
 console.error(`No se preparó el lanzamiento: ${error.message}`)
 process.exitCode=1
}
