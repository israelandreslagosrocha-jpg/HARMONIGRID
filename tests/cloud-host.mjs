// Compile the real host and test its child props/events without real accounts.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {parse,compileScript} from '@vue/compiler-sfc'
import {createSSRApp,h,shallowRef} from 'vue'
import {renderToString} from '@vue/server-renderer'
const root=process.cwd()
const {descriptor}=parse(fs.readFileSync('src/components/CloudWorkspaceHost.vue','utf8'))
let source=compileScript(descriptor,{id:'cloud-host-contract',inlineTemplate:true}).content
source=source.replace("import CloudWorkspace from './CloudWorkspace.vue'",`import {h as testH} from 'vue'
export const probe={}
const CloudWorkspace={props:['document','generation'],emits:['load','clear-account'],setup(props,{emit}){probe.props=props;probe.emit=emit;return()=>testH('p',props.document?.title||'Sin composición')}}`)
source=source.replace(/from ['"]vue['"]/g,`from '${pathToFileURL(path.join(root,'node_modules/vue/dist/vue.runtime.esm-bundler.js')).href}'`)
const file=path.join(os.tmpdir(),`hg-cloud-host-${process.pid}.mjs`)
fs.writeFileSync(file,source)
let checks=0
try {
  const {default:Host,probe}=await import(pathToFileURL(file))
  const document=shallowRef(null),context={document},loaded=[],cleared=[]
  const app=()=>createSSRApp({render:()=>h(Host,{context,generation:7,onLoad:value=>loaded.push(value),onClearAccount:()=>cleared.push(true)})})
  assert.ok((await renderToString(app())).includes('Sin composición'));checks++
  const first={title:'Mi creación',measures:[{id:'one',beats:[{root:'C'}]}]}
  document.value=first
  assert.ok((await renderToString(app())).includes('Mi creación'));checks++
  assert.equal(probe.props.document,first);checks++
  assert.equal(probe.props.generation,7);checks++
  const second={...first,title:'Editada después de guardar'}
  document.value=second
  assert.ok((await renderToString(app())).includes(second.title));checks++
  assert.equal(probe.props.document,second);checks++
  probe.emit('load',first)
  assert.deepEqual(loaded,[first]);checks++
  probe.emit('clear-account')
  assert.deepEqual(cleared,[true]);checks++
  document.value=null
  assert.ok((await renderToString(app())).includes('Sin composición'));checks++
  console.log(`${checks} cloud-host live-document, generation and account/load event checks passed`)
}finally{fs.unlinkSync(file)}
