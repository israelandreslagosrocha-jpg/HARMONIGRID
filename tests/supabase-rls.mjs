// Real PostgreSQL engine via isolated test dependency, not a product dependency.
// npm install --prefix /private/tmp/hg-supabase-sql-tests --no-save --ignore-scripts @electric-sql/pglite
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL('/private/tmp/hg-supabase-sql-tests/node_modules/@electric-sql/pglite/dist/index.js'));
const db=new PGlite();let checks=0;
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const doc=JSON.stringify({measures:[{id:'m1',beats:[],lyrics:{rawText:'Creación privada'}}]});
const denied=async sql=>{await assert.rejects(()=>db.query(sql));checks++};
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text default 'verified@example.test',email_confirmed_at timestamptz default now(),is_anonymous boolean default false);insert into auth.users(id) values ('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/202610040001_private_projects.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610040002_verified_project_accounts.sql','utf8'));
 const eligibility='public.hg_has_verified_project_account_v1()';
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${A}';`);
 const inserted=await db.query('insert into public.harmonigrid_projects(title,document) values ($1,$2) returning *',['Mi creación',doc]);
 const row=inserted.rows[0];assert.equal(row.owner_id,A);assert.equal(Number(row.revision),1);checks+=2;
 const update=await db.query('update public.harmonigrid_projects set title=$1 where id=$2 and revision=1 returning *',['Mi creación editada',row.id]);assert.equal(update.rows.length,1);assert.equal(Number(update.rows[0].revision),2);checks+=2;
 const stale=await db.query('update public.harmonigrid_projects set title=$1 where id=$2 and revision=1 returning *',['Versión antigua',row.id]);assert.equal(stale.rows.length,0);checks++;
 await denied(`update public.harmonigrid_projects set owner_id='${B}' where id='${row.id}'`);
 await denied(`update public.harmonigrid_projects set revision=100 where id='${row.id}'`);
 await denied(`insert into public.harmonigrid_projects(owner_id,title,document) values ('${B}','Forjado','${doc}')`);
 await denied(`insert into public.harmonigrid_projects(title,document) values ('Vacío','{"measures":[]}')`);
 await denied(`insert into public.harmonigrid_projects(title,document) values ('Inválido','{}')`);
 await denied(`delete from public.harmonigrid_projects where id='${row.id}'`);
 await db.exec(`set request.jwt.claim.sub='${B}';`);
 assert.equal((await db.query('select * from public.harmonigrid_projects')).rows.length,0);checks++;
 assert.equal((await db.query('update public.harmonigrid_projects set title=$1 where id=$2 returning *',['Ajeno',row.id])).rows.length,0);checks++;
 const own=await db.query('insert into public.harmonigrid_projects(title,document) values ($1,$2) returning owner_id',['Creación B',doc]);assert.equal(own.rows[0].owner_id,B);checks++;
 // An authenticated anonymous identity and unconfirmed email must be denied,
 // even though they have a UID and would pass the original owner policy.
 await db.exec(`reset role;update auth.users set is_anonymous=true where id='${B}';set role authenticated;`);
 assert.equal((await db.query(`select ${eligibility} as allowed`)).rows[0].allowed,false);checks++;
 assert.equal((await db.query('select * from public.harmonigrid_projects')).rows.length,0);checks++;
 await denied(`insert into public.harmonigrid_projects(title,document) values ('Anonymous','${doc}')`);
 await db.exec(`reset role;update auth.users set is_anonymous=false,email_confirmed_at=null where id='${B}';set role authenticated;`);
 assert.equal((await db.query(`select ${eligibility} as allowed`)).rows[0].allowed,false);checks++;
 assert.equal((await db.query('update public.harmonigrid_projects set title=$1 returning id',['Unverified'])).rows.length,0);checks++;
 await denied(`insert into public.harmonigrid_projects(title,document) values ('Unverified','${doc}')`);
 await db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${B}';set role authenticated;`);
 assert.equal((await db.query(`select ${eligibility} as allowed`)).rows[0].allowed,true);checks++;
 assert.equal((await db.query('select * from public.harmonigrid_projects')).rows.length,1);checks++;
 await denied(`select email from auth.users`);
 await db.exec(`reset role;create policy hg_test_permissive on public.harmonigrid_projects for select to authenticated using (true);update auth.users set email_confirmed_at=null where id='${B}';set role authenticated;`);
 assert.equal((await db.query('select * from public.harmonigrid_projects')).rows.length,0);checks++;
 await db.exec(`reset role;drop policy hg_test_permissive on public.harmonigrid_projects;set role authenticated;`);
 await db.exec('reset role;set role anon;');await denied('select * from public.harmonigrid_projects');
 await denied(`select ${eligibility}`);
 await db.exec("reset role;set role authenticated;set request.jwt.claim.sub='';");await denied(`insert into public.harmonigrid_projects(title,document) values ('Sin cuenta','${doc}')`);
 console.log(`${checks} PostgreSQL ownership, privileges, RLS and revision checks passed`);
}finally{await db.close()}
