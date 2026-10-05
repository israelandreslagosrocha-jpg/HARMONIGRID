-- Follow-up to 202610040001. Prepared locally; not applied remotely.
-- Require a permanent account with confirmed email, even if Auth settings change.
-- No compositions are deleted or transformed. Unverified accounts must confirm
-- their email before they can read/write their own private compositions.
begin;

create function public.hg_has_verified_project_account_v1()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users as account
    where account.id = (select auth.uid())
      and account.is_anonymous is not true
      and account.email_confirmed_at is not null
      and nullif(btrim(account.email), '') is not null
  );
$$;

-- No UID parameter and no user data returned: only current caller's eligibility.
revoke all on function public.hg_has_verified_project_account_v1() from public, anon, authenticated;
grant execute on function public.hg_has_verified_project_account_v1() to authenticated;

-- Restrictive policies are ANDed with the existing owner policies. This also
-- prevents a later permissive policy accidentally granting unverified access.
create policy hg_projects_verified_account
  on public.harmonigrid_projects as restrictive
  for all to authenticated
  using ((select public.hg_has_verified_project_account_v1()))
  with check ((select public.hg_has_verified_project_account_v1()));

commit;
