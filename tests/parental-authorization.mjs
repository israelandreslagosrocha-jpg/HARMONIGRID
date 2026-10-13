import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL('/private/tmp/hg-supabase-sql-tests/node_modules/@electric-sql/pglite/dist/index.js'))
const db=new PGlite();let checks=0
const child='11111111-1111-4111-8111-111111111111',guardian='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333'
const same=(a,b)=>{assert.deepEqual(a,b);checks++}
const denied=async sql=>{await assert.rejects(db.query(sql));checks++}
const allowed=async()=> (await db.query('select public.hg_has_parental_cloud_authorization_v1() as ok')).rows[0].ok
const caller=async id=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`)
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text default 'verified@example.test',email_confirmed_at timestamptz default now(),is_anonymous boolean default false);insert into auth.users(id) values('${child}'),('${guardian}'),('${outsider}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to authenticated;`)
 for(const file of ['202610040001_private_projects.sql','202610040002_verified_project_accounts.sql','202610120005_parental_authorization_foundation.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'))
 await caller(child);same(await allowed(),false)
 await denied(`insert into public.hg_parental_authorizations(child_user_id,guardian_user_id,purpose,notice_version) values('${child}','${guardian}','private_cloud_compositions','v1')`)
 await db.exec('reset role;set role service_role')
 const row=(await db.query(`insert into public.hg_parental_authorizations(child_user_id,guardian_user_id,purpose,notice_version) values('${child}','${guardian}','private_cloud_compositions','v1') returning id`)).rows[0]
 const id=row.id
 await caller(child);same(await allowed(),false)
 same((await db.query('select id,status from public.hg_parental_authorizations')).rows.length,1)
 await denied('select evidence_reference from public.hg_parental_authorizations')
 await denied(`update public.hg_parental_authorizations set status='approved' where id='${id}'`)
 await denied(`delete from public.hg_parental_authorizations where id='${id}'`)
 await caller(outsider);same((await db.query('select id,status from public.hg_parental_authorizations')).rows.length,0);same(await allowed(),false)
 await caller(guardian);same((await db.query('select id,status from public.hg_parental_authorizations')).rows.length,1);same(await allowed(),false)
 await db.exec('reset role;set role service_role')
 await denied(`update public.hg_parental_authorizations set status='approved',approved_at=now() where id='${id}'`)
 await db.exec(`reset role;update auth.users set email_confirmed_at=null where id='${guardian}';set role service_role;`)
 await denied(`update public.hg_parental_authorizations set status='approved',approved_at=now(),verification_method='test-only',evidence_reference='opaque-test-id' where id='${id}'`)
 await db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${guardian}';set role service_role;`)
 await db.query(`update public.hg_parental_authorizations set status='approved',approved_at=now(),verification_method='test-only',evidence_reference='opaque-test-id' where id='${id}'`)
 await caller(child);same(await allowed(),true)
 await caller(outsider);same(await allowed(),false)
 await db.exec(`reset role;update auth.users set is_anonymous=true where id='${guardian}';`);await caller(child);same(await allowed(),false)
 await db.exec(`reset role;update auth.users set is_anonymous=false where id='${guardian}';set role service_role;`)
 await denied(`update public.hg_parental_authorizations set guardian_user_id='${outsider}' where id='${id}'`)
 await denied(`update public.hg_parental_authorizations set notice_version='v2' where id='${id}'`)
 await denied(`update public.hg_parental_authorizations set status='revoked',revoked_at=now(),evidence_reference='changed' where id='${id}'`)
 await db.query(`update public.hg_parental_authorizations set status='revoked',revoked_at=now() where id='${id}'`)
 await caller(child);same(await allowed(),false)
 await db.exec('reset role;set role service_role')
 await denied(`update public.hg_parental_authorizations set status='approved',revoked_at=null where id='${id}'`)
 await db.exec('reset role;set role anon');await denied('select id from public.hg_parental_authorizations');await denied('select public.hg_has_parental_cloud_authorization_v1()')
 // Foundation must not revoke existing adult project eligibility or alter songs.
 await caller(outsider);same((await db.query('select public.hg_has_verified_project_account_v1() as ok')).rows[0].ok,true)
 const song=(await db.query(`insert into public.harmonigrid_projects(title,document) values('Existing behavior','{"measures":[{"id":"m1","beats":[]}]}') returning owner_id`)).rows[0];same(song.owner_id,outsider)
 console.log(`${checks} parental authorization foundation checks passed in isolated PostgreSQL; no live child onboarding enabled`)
}finally{await db.close()}
