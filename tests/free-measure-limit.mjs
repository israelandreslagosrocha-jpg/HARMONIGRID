import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL('/private/tmp/hg-supabase-sql-tests/node_modules/@electric-sql/pglite/dist/index.js'))
const db=new PGlite(),uid='11111111-1111-4111-8111-111111111111';let checks=0
const same=(a,b)=>{assert.deepEqual(a,b);checks++}
const denied=async(sql,args=[])=>{await assert.rejects(db.query(sql,args));checks++}
const doc=count=>JSON.stringify({measures:Array.from({length:count},(_,i)=>({id:`m${i}`,beats:[]}))})
const insert=count=>db.query('insert into public.harmonigrid_projects(title,document) values($1,$2) returning id,revision,measure_ceiling',['test',doc(count)])
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text default 'verified@example.test',email_confirmed_at timestamptz default now(),is_anonymous boolean default false);insert into auth.users(id) values('${uid}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`)
 for(const f of ['202610040001_private_projects.sql','202610040002_verified_project_accounts.sql','202610040003_project_resource_guards.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+f,'utf8'))
 await db.exec(`set request.jwt.claim.sub='${uid}'`)
 const legacy=(await db.query('insert into public.harmonigrid_projects(title,document) values($1,$2) returning id',['legacy',doc(32)])).rows[0]
 await db.exec(fs.readFileSync('supabase/migrations/202610040004_free_measure_creation.sql','utf8'))
 await db.exec('set role authenticated')
 same((await db.query('select measure_ceiling from public.harmonigrid_projects where id=$1',[legacy.id])).rows[0].measure_ceiling,32)
 const fresh=(await insert(20)).rows[0];same(fresh.measure_ceiling,20)
 await denied('insert into public.harmonigrid_projects(title,document) values($1,$2)',['oversize',doc(21)])
 await denied('update public.harmonigrid_projects set document=$1 where id=$2',[doc(21),fresh.id])
 await denied('update public.harmonigrid_projects set measure_ceiling=999 where id=$1',[fresh.id])
 await denied('insert into public.harmonigrid_projects(title,document,measure_ceiling) values($1,$2,999)',['bypass',doc(21)])
 await db.query('update public.harmonigrid_projects set document=$1 where id=$2',[doc(20),legacy.id])
 await db.query('update public.harmonigrid_projects set document=$1 where id=$2',[doc(32),legacy.id]);same((await db.query('select jsonb_array_length(document->\'measures\') as count from public.harmonigrid_projects where id=$1',[legacy.id])).rows[0].count,32)
 await denied('update public.harmonigrid_projects set document=$1 where id=$2',[doc(33),legacy.id])
 same((await db.query('select measure_ceiling from public.harmonigrid_projects where id=$1',[legacy.id])).rows[0].measure_ceiling,32)
 same(Number((await db.query('select revision from public.harmonigrid_projects where id=$1',[fresh.id])).rows[0].revision),1)
 await db.exec('reset role');same((await db.query('select writes from public.hg_project_write_windows where owner_id=$1',[uid])).rows[0].writes,3)
 const diagnostic=await db.exec(fs.readFileSync('supabase/checks/verify_launch_security.sql','utf8'))
 const metadataChecks=diagnostic.flatMap(result=>result.rows||[]).filter(row=>row.check_name)
 same(metadataChecks.length,17);same(metadataChecks.filter(row=>row.passed!==true),[])
 console.log(`${checks} FREE server measure-limit, bypass denial, rollback, historical undo and read-only diagnostic checks passed`)
}finally{await db.close()}
