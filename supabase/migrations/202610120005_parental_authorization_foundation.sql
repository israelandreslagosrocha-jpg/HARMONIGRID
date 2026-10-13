-- Foundation only. NOT applied remotely; does not alter project access policies.
-- Activate child registration only after consent verification and server gates exist.
begin;

create table public.hg_parental_authorizations (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references auth.users(id) on delete restrict,
  guardian_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  purpose text not null check (purpose = 'private_cloud_compositions'),
  notice_version text not null check (char_length(btrim(notice_version)) between 1 and 80),
  verification_method text,
  evidence_reference text,
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint hg_parental_distinct_users check (child_user_id <> guardian_user_id),
  constraint hg_parental_state_fields check (
    (status='pending' and approved_at is null and revoked_at is null
      and verification_method is null and evidence_reference is null)
    or (status='approved' and approved_at is not null and revoked_at is null
      and nullif(btrim(verification_method),'') is not null
      and nullif(btrim(evidence_reference),'') is not null)
    or (status='revoked' and approved_at is not null and revoked_at >= approved_at
      and nullif(btrim(verification_method),'') is not null
      and nullif(btrim(evidence_reference),'') is not null)
  ),
  constraint hg_parental_evidence_size check (
    char_length(verification_method) <= 80 and char_length(evidence_reference) <= 200
  )
);

-- One active decision per child. Revoked records remain immutable evidence;
-- renewing approval requires a separate record and verification.
create unique index hg_parental_one_approval on public.hg_parental_authorizations(child_user_id)
  where status='approved';
create index hg_parental_guardian_lookup on public.hg_parental_authorizations(guardian_user_id);

create function public.hg_parental_transition_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' and new.status <> 'pending' then
    raise exception 'Create a pending request before recording verification';
  end if;
  if tg_op='UPDATE' then
    if old.status='revoked'
      or new.id is distinct from old.id
      or new.child_user_id is distinct from old.child_user_id
      or new.guardian_user_id is distinct from old.guardian_user_id
      or new.purpose is distinct from old.purpose
      or new.notice_version is distinct from old.notice_version
      or new.created_at is distinct from old.created_at then
      raise exception 'Authorization identity and revoked records are immutable';
    end if;
    if not ((old.status='pending' and new.status='approved')
       or (old.status='approved' and new.status='revoked')) then
      raise exception 'Invalid parental authorization transition';
    end if;
    if old.status='approved' and (
      new.approved_at is distinct from old.approved_at
      or new.verification_method is distinct from old.verification_method
      or new.evidence_reference is distinct from old.evidence_reference) then
      raise exception 'Approval evidence must be preserved on revocation';
    end if;
  end if;
  if new.status='approved' and not exists (
    select 1 from auth.users u where u.id=new.guardian_user_id
      and u.is_anonymous is not true and u.email_confirmed_at is not null
      and nullif(btrim(u.email),'') is not null
  ) then
    raise exception 'Guardian must have a verified permanent account';
  end if;
  return new;
end;
$$;
create trigger hg_parental_transition before insert or update
  on public.hg_parental_authorizations for each row
  execute function public.hg_parental_transition_v1();

alter table public.hg_parental_authorizations enable row level security;
revoke all on public.hg_parental_authorizations from public,anon,authenticated;
-- Browser cannot create, approve, revoke, delete or read evidence.
grant select(id,child_user_id,guardian_user_id,status,purpose,notice_version,approved_at,revoked_at,created_at)
  on public.hg_parental_authorizations to authenticated;
create policy hg_parental_participants_read on public.hg_parental_authorizations
  for select to authenticated using (
    (select auth.uid()) in (child_user_id,guardian_user_id)
    and (select public.hg_has_verified_project_account_v1())
  );

-- Only evaluates the CURRENT user, not arbitrary IDs supplied by the client.
-- False for absent/pending/revoked authorization. This is NOT an adulthood check.
create function public.hg_has_parental_cloud_authorization_v1()
returns boolean language sql stable security definer set search_path='' as $$
  select public.hg_has_verified_project_account_v1() and exists (
    select 1 from public.hg_parental_authorizations a
    join auth.users guardian on guardian.id=a.guardian_user_id
    where a.child_user_id=(select auth.uid()) and a.status='approved'
      and guardian.email_confirmed_at is not null
      and guardian.is_anonymous is not true
      and nullif(btrim(guardian.email),'') is not null
  );
$$;
revoke all on function public.hg_parental_transition_v1() from public,anon,authenticated;
revoke all on function public.hg_has_parental_cloud_authorization_v1() from public,anon,authenticated;
grant execute on function public.hg_has_parental_cloud_authorization_v1() to authenticated;

-- Server role only; never send this role's credentials to the browser.
grant all on public.hg_parental_authorizations to service_role;
commit;
