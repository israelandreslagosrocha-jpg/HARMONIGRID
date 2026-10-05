import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL('/private/tmp/hg-supabase-sql-tests/node_modules/@electric-sql/pglite/dist/index.js'))
const db=new PGlite(),A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';let checks=0
const same=(a,b)=>{assert.deepEqual(a,b);checks++}
const denied=async(query,args=[])=>{await assert.rejects(db.query(query,args));checks++}
const doc=size=>JSON.stringify({measures:[{id:'m',beats:[]}],padding:'x'.repeat(size)})
const insert=(title,size=10)=>db.query('insert into public.harmonigrid_projects(title,document) values($1,$2) returning *',[title,doc(size)])
const admin=async sql=>db.exec(`reset role;${sql};set role authenticated;`)
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text default 'verified@example.test',email_confirmed_at timestamptz default now(),is_anonymous boolean default false);insert into auth.users(id) values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`)
 for(const file of ['202610040001_private_projects.sql','202610040002_verified_project_accounts.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'))
 await db.exec(fs.readFileSync('supabase/migrations/202610040003_project_resource_guards.sql','utf8'))
 const approved=(await db.query('select max_projects,max_storage_bytes,max_writes_per_minute from public.hg_project_resource_limits')).rows[0]
 same([approved.max_projects,Number(approved.max_storage_bytes),approved.max_writes_per_minute],[20,52428800,120])
 await db.exec('update public.hg_project_resource_limits set max_projects=2,max_storage_bytes=1024,max_writes_per_minute=2')
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`)
 const one=(await insert('A1')).rows[0];await insert('A2');same((await db.query('select id from public.harmonigrid_projects')).rows.length,2)
 await denied('insert into public.harmonigrid_projects(title,document) values($1,$2)',['A3',doc(10)])
 await denied('update public.harmonigrid_projects set title=$1 where id=$2',['Too fast',one.id])
 same(Number((await db.query('select revision from public.harmonigrid_projects where id=$1',[one.id])).rows[0].revision),1)
 await admin("update public.hg_project_write_windows set started_at=now()-interval '2 minutes'")
 const updated=await db.query('update public.harmonigrid_projects set title=$1 where id=$2 returning revision',['A1 changed',one.id]);same(Number(updated.rows[0].revision),2)
 await denied('update public.harmonigrid_projects set document=$1 where id=$2',[doc(2000),one.id])
 same((await db.query('select document from public.harmonigrid_projects where id=$1',[one.id])).rows[0].document.padding.length,10)
 await denied('select * from public.hg_project_resource_limits')
 await denied('update public.hg_project_resource_limits set max_projects=9999')
 await denied('delete from public.hg_project_write_windows')
 await db.exec(`set request.jwt.claim.sub='${B}';`);await insert('B1');same((await db.query('select id from public.harmonigrid_projects')).rows.length,1)
 await db.exec(`set request.jwt.claim.sub='${A}';`)
 // Lowering quota never deletes old data; equal-size/shrinking saves still work.
 await admin('update public.hg_project_resource_limits set max_storage_bytes=1,max_writes_per_minute=100')
 await db.query('update public.harmonigrid_projects set document=$1 where id=$2',[doc(0),one.id]);same((await db.query('select id from public.harmonigrid_projects')).rows.length,2)
 await denied('update public.harmonigrid_projects set document=$1 where id=$2',[doc(1),one.id])
 // Stale revision returns zero rows and consumes no accepted-write quota.
 await admin('update public.hg_project_resource_limits set max_storage_bytes=1024')
 const countBefore=(await db.query('select 1')).rows.length
 same(countBefore,1)
 const stale=await db.query('update public.harmonigrid_projects set title=$1 where id=$2 and revision=1 returning id',['stale',one.id]);same(stale.rows.length,0)
 // Failed quota writes do not leave partial accounting changes.
 await admin(`update public.hg_project_resource_limits set max_writes_per_minute=1;update public.hg_project_write_windows set writes=1,started_at=now() where owner_id='${A}'`)
 await denied('update public.harmonigrid_projects set title=$1 where id=$2',['rate rejected',one.id])
 await db.exec('reset role;')
 same((await db.query('select writes from public.hg_project_write_windows where owner_id=$1',[A])).rows[0].writes,1)
 console.log(`${checks} server resource-limit, rollback, owner isolation and rate-window checks passed; test-only limits, no remote application`)
}finally{await db.close()}
