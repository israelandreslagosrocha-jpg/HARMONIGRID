-- Approved FREE beta limits: 20 compositions, 50 MiB JSON documents, 120 accepted saves/minute.
-- Apply once after migrations 001 and 002. Does not delete existing projects.
begin;
create table public.hg_project_resource_limits (
  singleton boolean primary key default true check (singleton),
  max_projects integer not null check (max_projects > 0),
  max_storage_bytes bigint not null check (max_storage_bytes > 0),
  max_writes_per_minute integer not null check (max_writes_per_minute > 0)
);
revoke all on public.hg_project_resource_limits from public,anon,authenticated;
insert into public.hg_project_resource_limits(max_projects,max_storage_bytes,max_writes_per_minute)
values (20,52428800,120);

create table public.hg_project_write_windows (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  writes integer not null check (writes >= 0)
);
revoke all on public.hg_project_write_windows from public,anon,authenticated;
alter table public.hg_project_resource_limits enable row level security;
alter table public.hg_project_write_windows enable row level security;

create function public.hg_guard_project_resources_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  limits public.hg_project_resource_limits%rowtype;
  quota public.hg_project_write_windows%rowtype;
  project_count bigint;
  used_bytes bigint;
  previous_bytes bigint := 0;
  incoming_bytes bigint;
  stamp timestamptz;
begin
  -- Administrative backup/restore is not a browser account operation.
  if current_setting('role',true) is distinct from 'authenticated' then return new; end if;
  if new.owner_id is distinct from (select auth.uid()) then
    raise exception using errcode='42501',message='No tienes acceso a esta composición.';
  end if;
  -- Serialize all accepted mutations for the same account across sessions.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,0));
  select * into strict limits from public.hg_project_resource_limits where singleton;
  select count(*),coalesce(sum(octet_length(document::text)),0)
    into project_count,used_bytes from public.harmonigrid_projects where owner_id=new.owner_id;
  incoming_bytes := octet_length(new.document::text);
  if tg_op='UPDATE' then previous_bytes := octet_length(old.document::text); end if;
  if tg_op='INSERT' and project_count >= limits.max_projects then
    raise exception using errcode='P0001',message='Alcanzaste el límite de composiciones de tu cuenta. Tu trabajo sigue en el editor.';
  end if;
  -- Preserve accounts already above a newly lowered quota: shrinking or equal
  -- size updates remain possible; never truncate their compositions.
  if used_bytes-previous_bytes+incoming_bytes > limits.max_storage_bytes
     and (tg_op='INSERT' or incoming_bytes > previous_bytes) then
    raise exception using errcode='P0001',message='Alcanzaste el almacenamiento de tu cuenta. Tu trabajo sigue en el editor.';
  end if;
  stamp := clock_timestamp();
  select * into quota from public.hg_project_write_windows where owner_id=new.owner_id;
  if not found or quota.started_at <= stamp-interval '1 minute' then
    insert into public.hg_project_write_windows(owner_id,started_at,writes)
      values(new.owner_id,stamp,1)
      on conflict(owner_id) do update set started_at=excluded.started_at,writes=1;
  else
    if quota.writes >= limits.max_writes_per_minute then
      raise exception using errcode='P0001',message='Demasiados guardados seguidos. Espera un minuto y vuelve a guardar; tu trabajo se conserva.';
    end if;
    update public.hg_project_write_windows set writes=writes+1 where owner_id=new.owner_id;
  end if;
  return new;
end;
$$;
revoke all on function public.hg_guard_project_resources_v1() from public,anon,authenticated;
create trigger harmonigrid_projects_resource_guard
  before insert or update on public.harmonigrid_projects
  for each row execute function public.hg_guard_project_resources_v1();
commit;
