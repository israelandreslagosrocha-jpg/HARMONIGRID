// Explicit invocation only. Never imports application credentials or scans production.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn,spawnSync} from 'node:child_process'
import {startBudgetRelay} from './strix-budget-relay.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const fail=message=>{console.error(message);process.exit(1)}
const config=path.join(root,'.tools/strix.env')
if(!fs.existsSync(config))fail('Falta .tools/strix.env. Configura la clave localmente, nunca en el chat.')
const values=Object.fromEntries(fs.readFileSync(config,'utf8').split(/\r?\n/).filter(line=>/^(STRIX_LLM|LLM_API_KEY)=/.test(line)).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1).trim()]}))
if(!values.LLM_API_KEY)fail('Falta LLM_API_KEY en .tools/strix.env. No se ha ejecutado ningún escaneo.')
if(values.STRIX_LLM!=='openai/gpt-5.4')fail('El proveedor/modelo debe ser openai/gpt-5.4 para este primer escaneo.')
const executable=path.join(root,'.tools/strix/bin/strix')
if(!fs.existsSync(executable))fail('La instalación local de Strix aún no está lista.')
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,LANG:process.env.LANG,DOCKER_HOST:`unix://${process.env.HOME}/.colima/harmonigrid-security/docker.sock`,...values}
const docker=spawnSync('docker',['info','--format','{{.ServerVersion}}'],{env,encoding:'utf8',timeout:20000})
if(docker.status!==0)fail('Docker no está disponible o su máquina virtual aún no está iniciada.')
const help=spawnSync(executable,['--help'],{env,encoding:'utf8',timeout:30000})
if(help.status!==0||!help.stdout.includes('--max-budget')||!help.stdout.includes('--max-turns'))fail('Esta versión de Strix no confirma los controles de presupuesto y turnos. Se cancela sin llamadas al modelo.')
const prepared=spawnSync(process.execPath,[path.join(root,'scripts/prepare-strix-target.mjs')],{cwd:root,encoding:'utf8'})
if(prepared.status!==0)fail('No se pudo preparar la copia aislada.')
const target=prepared.stdout.match(/^Prepared isolated source target: (.+)$/m)?.[1]
if(!target)fail('No se pudo identificar la copia aislada.')
// Do not inherit unrelated user MCP connections or scan configuration.
const cliConfig=path.join(root,'.tools/strix-cli.json')
const mcpConfig=path.join(root,'.tools/strix-mcp.json')
fs.writeFileSync(cliConfig,'{}\n',{mode:0o600})
fs.writeFileSync(mcpConfig,'{"mcpServers":{}}\n',{mode:0o600})
console.log('Primer escaneo OpenAI: reservas conservadoras antes de cada llamada, máximo US$4,50. Umbral adicional de Strix: US$4.')
console.log(`Objetivo aislado: ${target}`)
const relay=await startBudgetRelay(values.LLM_API_KEY,path.join(root,'.tools'))
env.LLM_API_KEY=relay.token
env.LLM_API_BASE=relay.base
env.STRIX_API_TYPE='chat_completions'
let status=1
try {
  status=await new Promise((resolve,reject)=>{
    const child=spawn(executable,['--config',cliConfig,'--mcp-config',mcpConfig,'--target',target,'--instruction-file',path.join(target,'STRIX_SCOPE.md'),'--scan-mode','quick','--scope-mode','full','--non-interactive','--max-budget','4','--max-turns','40'],{cwd:root,env,stdio:'inherit'})
    child.once('error',reject);child.once('exit',code=>resolve(code??1))
  })
}finally{relay.close();console.log(`Guardia local: ${relay.state.calls} llamadas reservadas; cota conservadora US$${(relay.state.reservedMicros/1000000).toFixed(2)}. No es una lectura de la factura.`)}
process.exitCode=status
