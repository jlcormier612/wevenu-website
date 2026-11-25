-- ============================================================================
-- HTC Program 3 (Communication Library) — durable Postgres store
--
-- Replaces task-local workspace/.data JSONL so founder templates, workflows,
-- sequences, enrollments/runs, and branding survive ECS redeploys.
-- Service-role only (same posture as htc_crm_*).
-- ============================================================================

create table if not exists public.htc_program3_store (
  id smallint primary key default 1 check (id = 1),
  version bigint not null default 0,
  document jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.htc_program3_store (id, version, document)
values (1, 0, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.htc_program3_store enable row level security;

revoke all on table public.htc_program3_store from public, anon, authenticated;
grant select, insert, update on table public.htc_program3_store to service_role;

create or replace function public.htc_program3_load_store()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.htc_program3_store%rowtype;
begin
  select * into row from public.htc_program3_store where id = 1;
  if not found then
    insert into public.htc_program3_store (id, version, document)
    values (1, 0, '{}'::jsonb)
    returning * into row;
  end if;
  return jsonb_build_object(
    'version', row.version,
    'document', row.document,
    'updatedAt', row.updated_at
  );
end;
$$;

revoke all on function public.htc_program3_load_store() from public, anon, authenticated;
grant execute on function public.htc_program3_load_store() to service_role;

create or replace function public.htc_program3_replace_store(
  p_document jsonb,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version bigint;
  new_version bigint;
begin
  select version into current_version
  from public.htc_program3_store
  where id = 1
  for update;

  if not found then
    insert into public.htc_program3_store (id, version, document)
    values (1, 0, '{}'::jsonb);
    current_version := 0;
  end if;

  if current_version is distinct from p_expected_version then
    raise exception 'htc_program3_version_conflict (expected %, actual %)',
      p_expected_version, current_version
      using errcode = 'P0001';
  end if;

  new_version := current_version + 1;
  update public.htc_program3_store
  set
    version = new_version,
    document = coalesce(p_document, '{}'::jsonb),
    updated_at = now()
  where id = 1;

  return jsonb_build_object(
    'version', new_version,
    'document', coalesce(p_document, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.htc_program3_replace_store(jsonb, bigint) from public, anon, authenticated;
grant execute on function public.htc_program3_replace_store(jsonb, bigint) to service_role;
