// Prepare an isolated source-only target; this does not run Strix or contact any service.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const root=path.resolve(new URL('..',import.meta.url).pathname)
const output=await fs.mkdtemp(path.join(os.tmpdir(),'harmonigrid-strix-'))
for(const name of ['src','supabase','tests','scripts','package.json','package-lock.json','vite.config.js','tailwind.config.js','postcss.config.js','index.html','vercel.json']) {
 try{await fs.cp(path.join(root,name),path.join(output,name),{recursive:true})}
 catch(error){if(error.code!=='ENOENT')throw error}
}
await fs.writeFile(path.join(output,'STRIX_SCOPE.md'),`# Authorized source assessment\n\nTarget: this isolated HarmoniGrid copy only. Never edit or test the original checkout.\nTest data only. No .env files, account credentials or personal compositions are supplied.\nDo not contact production, Vercel, Supabase, Google, or any remote URL found in code. A referenced domain is NOT an authorized target.\nDo not provision accounts, send emails, enumerate users, brute force credentials, perform denial of service, or delete data.\nUse local mocked auth and isolated PostgreSQL fixtures for ownership, anonymous/unverified access, forged claims, quota bypass, race conditions, prototype pollution, XSS and save conflicts.\nValidate findings with minimal reproducible local tests. Label untested scenarios as hypotheses. Report file, line, trigger, evidence, impact and a proposed patch. Do not auto-apply changes to the original repository or push branches.\n`)
console.log(`Prepared isolated source target: ${output}`)
console.log('Strix has NOT been executed. Configure its runtime and approved model/budget before running.')
