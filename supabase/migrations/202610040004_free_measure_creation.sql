-- FREE launch: new compositions contain at most 20 measures.
-- Existing longer compositions retain their original ceiling, including undo.
-- Apply once after 001, 002 and 003. Does not delete or truncate music.
begin;
alter table public.harmonigrid_projects
  add column measure_ceiling integer not null default 20
  check (measure_ceiling between 20 and 999);
update public.harmonigrid_projects
  set measure_ceiling=jsonb_array_length(document->'measures')
  where jsonb_array_length(document->'measures') > 20;

create function public.hg_guard_free_measure_creation_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_setting('role',true) is distinct from 'authenticated' then return new; end if;
  if tg_op='INSERT' then
    new.measure_ceiling := 20;
  else
    new.measure_ceiling := old.measure_ceiling;
  end if;
  if jsonb_array_length(new.document->'measures') > new.measure_ceiling then
    raise exception using errcode='P0001',
      message='Las composiciones nuevas FREE admiten hasta 20 compases. Tu trabajo sigue en el editor.';
  end if;
  return new;
end;
$$;
revoke all on function public.hg_guard_free_measure_creation_v1() from public,anon,authenticated;
create trigger harmonigrid_projects_free_measure_guard
  before insert or update on public.harmonigrid_projects
  for each row execute function public.hg_guard_free_measure_creation_v1();
commit;
