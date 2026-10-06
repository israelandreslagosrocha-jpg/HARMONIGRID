// Explicit invocation only. Never imports application credentials or scans production.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const fail=message=>{console.error(message);process.exit(1)}
const config=path.join(root,'.tools/strix.env')
if(!fs.existsSync(config))fail('Falta .tools/strix.env. Configura la clave localmente, nunca en el chat.')
const values=Object.fromEntries(fs.readFileSync(config,'utf8').split(/\r?\n/).filter(line=>/^(STRIX_LLM|LLM_API_KEY)=/.test(line)).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).trim()]}))
if(!values.LLM_API_KEY)fail('Falta LLM_API_KEY en .tools/strix.env. No se ha ejecutado ningún escaneo.')
if(values.STRIX_LLM!=='openai/gpt-5.4')fail('El proveedor/modelo debe ser openai/gpt-5.4 para este primer escaneo.')
const executable=path.join(root,'.tools/strix/bin/strix')
if(!fs.existsSync(executable))fail('La instalación local de Strix aún no está lista.')
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:process.env.LANG,...values}
const docker=spawnSync('docker',['info','--format','{{.ServerVersion}}'],{env,encoding:'utf8',timeout:20000})
if(docker.status!==0)fail('Docker no está disponible o su máquina virtual aún no está iniciada.')
const help=spawnSync(executable,['--help'],{env,encoding:'utf8',timeout:30000})
if(help.status!==0||!help.stdout.includes('--max-budget')||!help.stdout.includes('--max-turns'))fail('Esta versión de Strix no confirma los controles de presupuesto y turnos. Se cancela sin llamadas al modelo.')
const prepared=spawnSync(process.execPath,[path.join(root,'scripts/prepare-strix-target.mjs')],{cwd:root,encoding:'utf8'})
if(prepared.status!==0)fail('No se pudo preparar la copia aislada.')
const target=prepared.stdout.match(/^Prepared isolated source target: (.+)$/m)?.[1]
if(!target)fail('No se pudo identificar la copia aislada.')
console.log('Primer escaneo OpenAI: umbral estimado US$4, margen respecto del presupuesto de US$5. No es un límite exacto de facturación.')
console.log(`Objetivo aislado: ${target}`)
const result=spawnSync(executable,['--target',target,'--instruction-file',path.join(target,'STRIX_SCOPE.md'),'--scan-mode','quick','--scope-mode','full','--non-interactive','--max-budget','4','--max-turns','40'],{cwd:root,env,stdio:'inherit'})
process.exit(result.status??1)
