-- Wave 2 — Active venue context (Team & Permissions).
-- DB-backed active venue is authoritative. No LIMIT 1 membership fallback.
-- Does NOT change ownership semantics, venue_staff.role model, or capability RLS.

-- ── 1. Table ──────────────────────────────────────────────────────────────────

create table if not exists public.venue_staff_active_context (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_venue_id uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venue_staff_active_context_venue
  on public.venue_staff_active_context (active_venue_id);

alter table public.venue_staff_active_context enable row level security;

drop policy if exists venue_staff_active_context_select on public.venue_staff_active_context;
create policy venue_staff_active_context_select
  on public.venue_staff_active_context for select
  using (user_id = auth.uid());

drop policy if exists venue_staff_active_context_insert on public.venue_staff_active_context;
create policy venue_staff_active_context_insert
  on public.venue_staff_active_context for insert
  with check (user_id = auth.uid());

drop policy if exists venue_staff_active_context_update on public.venue_staff_active_context;
create policy venue_staff_active_context_update
  on public.venue_staff_active_context for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists venue_staff_active_context_delete on public.venue_staff_active_context;
create policy venue_staff_active_context_delete
  on public.venue_staff_active_context for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.venue_staff_active_context to authenticated;

-- ── 2. set_active_venue ───────────────────────────────────────────────────────

create or replace function public.set_active_venue(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_name text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'venue_required');
  end if;

  if not exists (
    select 1
    from public.venue_staff s
    where s.user_id = uid
      and s.venue_id = p_venue_id
      and s.is_active = true
      and s.accepted_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_a_member');
  end if;

  select v.name into v_name from public.venues v where v.id = p_venue_id;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'venue_not_found');
  end if;

  insert into public.venue_staff_active_context (user_id, active_venue_id, updated_at)
  values (uid, p_venue_id, now())
  on conflict (user_id) do update
    set active_venue_id = excluded.active_venue_id,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'venueId', p_venue_id,
    'venueName', v_name
  );
end;
$$;

grant execute on function public.set_active_venue(uuid) to authenticated;

-- ── 3. list_my_venue_memberships ──────────────────────────────────────────────

create or replace function public.list_my_venue_memberships()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated', 'memberships', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'memberships', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'venueId', s.venue_id,
          'venueName', v.name,
          'role', s.role,
          'isOwner', s.is_owner
        )
        order by v.name
      )
      from public.venue_staff s
      join public.venues v on v.id = s.venue_id
      where s.user_id = uid
        and s.is_active = true
        and s.accepted_at is not null
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.list_my_venue_memberships() to authenticated;

-- ── 4. Case A backfill (exactly one active accepted membership) ─────────────

insert into public.venue_staff_active_context (user_id, active_venue_id, updated_at)
select vs.user_id, vs.venue_id, now()
from public.venue_staff vs
where vs.user_id is not null
  and vs.is_active = true
  and vs.accepted_at is not null
  and (
    select count(*)::int
    from public.venue_staff vs2
    where vs2.user_id = vs.user_id
      and vs2.is_active = true
      and vs2.accepted_at is not null
  ) = 1
on conflict (user_id) do nothing;

-- ── 5. current_user_venue_id cutover (context + membership only) ─────────────

create or replace function public.current_user_venue_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_venue uuid;
begin
  if uid is null then
    return null;
  end if;

  select c.active_venue_id into v_venue
  from public.venue_staff_active_context c
  where c.user_id = uid;

  if v_venue is null then
    return null;
  end if;

  if exists (
    select 1
    from public.venue_staff s
    where s.user_id = uid
      and s.venue_id = v_venue
      and s.is_active = true
      and s.accepted_at is not null
  ) then
    return v_venue;
  end if;

  -- Case E: stale context — return NULL (fail closed). Clearing is done by
  -- trigger / app bootstrap; STABLE RLS helpers must not write.
  return null;
end;
$$;

grant execute on function public.current_user_venue_id() to authenticated;

-- ── 6. current_user_role scoped to active venue only ──────────────────────────

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.role
  from public.venue_staff s
  where s.user_id = auth.uid()
    and s.venue_id = public.current_user_venue_id()
    and s.accepted_at is not null
    and s.is_active = true
$$;

grant execute on function public.current_user_role() to authenticated, anon;

-- ── 7. Invalidate context when membership is lost ─────────────────────────────

create or replace function public.clear_active_venue_on_membership_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.user_id is not null then
      delete from public.venue_staff_active_context
      where user_id = old.user_id
        and active_venue_id = old.venue_id;
    end if;
    return old;
  end if;

  -- UPDATE: inactive, unaccepted, remapped user, or remapped venue
  if old.user_id is not null
     and (
       coalesce(new.is_active, false) is not true
       or new.accepted_at is null
       or new.user_id is distinct from old.user_id
       or new.venue_id is distinct from old.venue_id
     )
  then
    delete from public.venue_staff_active_context
    where user_id = old.user_id
      and active_venue_id = old.venue_id;
  end if;

  return new;
end;
$$;

drop trigger if exists venue_staff_clear_active_context on public.venue_staff;
create trigger venue_staff_clear_active_context
  after update or delete on public.venue_staff
  for each row
  execute function public.clear_active_venue_on_membership_loss();

-- Helper for app bootstrap: clear stale context when membership no longer valid
create or replace function public.clear_stale_active_venue_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_venue uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select c.active_venue_id into v_venue
  from public.venue_staff_active_context c
  where c.user_id = uid;

  if v_venue is null then
    return jsonb_build_object('ok', true, 'cleared', false);
  end if;

  if exists (
    select 1 from public.venue_staff s
    where s.user_id = uid
      and s.venue_id = v_venue
      and s.is_active = true
      and s.accepted_at is not null
  ) then
    return jsonb_build_object('ok', true, 'cleared', false, 'venueId', v_venue);
  end if;

  delete from public.venue_staff_active_context where user_id = uid;
  return jsonb_build_object('ok', true, 'cleared', true);
end;
$$;

grant execute on function public.clear_stale_active_venue_context() to authenticated;
