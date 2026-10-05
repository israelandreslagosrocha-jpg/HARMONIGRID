-- READ-ONLY diagnostic. Not a migration. No account IDs, emails or music returned.
-- Run with project administrator access; inspect all rows and definitions.
-- Presence checks do not replace functional tests with two real accounts.
begin read only;
select 'project_rls_enabled' as check_name,
       (select relrowsecurity from pg_class where oid='public.harmonigrid_projects'::regclass) as passed
union all select 'anonymous_select_denied',not has_table_privilege('anon','public.harmonigrid_projects','SELECT')
union all select 'anonymous_insert_document_denied',not has_column_privilege('anon','public.harmonigrid_projects','document','INSERT')
union all select 'authenticated_select_enabled',has_table_privilege('authenticated','public.harmonigrid_projects','SELECT')
union all select 'authenticated_insert_document_enabled',has_column_privilege('authenticated','public.harmonigrid_projects','document','INSERT')
union all select 'authenticated_update_document_enabled',has_column_privilege('authenticated','public.harmonigrid_projects','document','UPDATE')
union all select 'owner_transfer_denied',not has_column_privilege('authenticated','public.harmonigrid_projects','owner_id','UPDATE')
union all select 'client_revision_update_denied',not has_column_privilege('authenticated','public.harmonigrid_projects','revision','UPDATE')
union all select 'client_measure_ceiling_update_denied',not has_column_privilege('authenticated','public.harmonigrid_projects','measure_ceiling','UPDATE')
union all select 'client_measure_ceiling_insert_denied',not has_column_privilege('authenticated','public.harmonigrid_projects','measure_ceiling','INSERT')
union all select 'client_delete_denied',not has_table_privilege('authenticated','public.harmonigrid_projects','DELETE')
union all select 'client_quota_configuration_denied',not has_table_privilege('authenticated','public.hg_project_resource_limits','UPDATE')
union all select 'verified_account_rpc_anonymous_denied',not has_function_privilege('anon','public.hg_has_verified_project_account_v1()','EXECUTE')
union all select 'verified_account_rpc_authenticated_enabled',has_function_privilege('authenticated','public.hg_has_verified_project_account_v1()','EXECUTE')
union all select 'approved_resource_limits',exists(select 1 from public.hg_project_resource_limits where singleton and max_projects=20 and max_storage_bytes=52428800 and max_writes_per_minute=120)
union all select 'verified_restrictive_policy_present',exists(select 1 from pg_policies where schemaname='public' and tablename='harmonigrid_projects' and policyname='hg_projects_verified_account' and permissive='RESTRICTIVE' and cmd='ALL' and 'authenticated'=any(roles))
union all select 'all_three_expected_triggers_enabled',
  (select count(*)=3 from pg_trigger where tgrelid='public.harmonigrid_projects'::regclass and not tgisinternal and tgenabled in ('O','A') and tgname in ('harmonigrid_projects_revision','harmonigrid_projects_resource_guard','harmonigrid_projects_free_measure_guard'));

-- Review actual owner/verification expressions, not merely policy names.
select policyname,permissive,roles,cmd,qual,with_check
  from pg_policies where schemaname='public' and tablename='harmonigrid_projects'
  order by policyname;
-- Definitions are code only; no private project content or credentials.
select p.proname,pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('hg_has_verified_project_account_v1','hg_guard_project_resources_v1','hg_guard_free_measure_creation_v1','hg_project_revision_v1')
  order by p.proname;
rollback;
