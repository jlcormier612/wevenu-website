-- ============================================================================
-- Guest Experience — Phase 1: Guest & Household Foundation
--
-- Implements docs/guest-experience-implementation-plan.md's recommended
-- Phase 1. Scope: reconcile the guest/household data model and the two
-- guest-creation paths. Does not touch RSVP, Seating, Website, Calendar,
-- Requests, or Floor Plans.
--
-- 1. couple_households — a real, first-class entity. Guests belong to a
--    household instead of a free-typed `group_label` string. Client-Owned:
--    RLS is enabled with NO policy for `authenticated` at all — exactly the
--    original couple_guests/couple_todos design ("Couple writes via SECURITY
--    DEFINER functions — no direct authenticated insert policy", Sprint 50)
--    before Sprint 107 loosened couple_guests. Access is exclusively through
--    the portal-token SECURITY DEFINER functions below; no table grant is
--    needed for that pattern, so none is given.
--
-- 2. Backfill: every distinct existing `group_label` becomes a household,
--    and guests carrying that label are linked to it via `household_id`
--    (already a column since Sprint 73, but never had a real table to
--    reference, a FK, or any write path — nothing sets it today). `group_label`
--    is then dropped — one grouping mechanism, not two.
--
-- 3. couple_guests RLS: the Sprint 107 team-collaboration migration replaced
--    couple_guests' original "no coordinator RLS" design with a blanket
--    `venue_id = current_user_venue_id()` SELECT policy — any active venue
--    owner or team member can read every guest row directly, contradicting
--    the stated Client Ownership. Audited before touching this: every real
--    venue-side read of guest data goes through a SECURITY DEFINER RPC
--    (get_venue_analytics, get_client_health_scores, get_wedding_day_ops),
--    all of which bypass RLS regardless of this policy's existence — and the
--    one thing actually built to consume it directly, `shared_couple_guests`,
--    has zero callers anywhere in the app. Nothing operational depends on
--    this policy, so it is safe to remove now rather than defer. (Requests-
--    based sharing, if the couple ever opts in via `visibility_to_venue`, is
--    a later phase's concern — that column and its intent are left standing,
--    just not wired to anything yet.)
-- ============================================================================

-- ── 1. couple_households ──────────────────────────────────────────────────────

create table public.couple_households (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,

  name        text not null check (char_length(trim(name)) > 0),
  notes       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index couple_households_client on public.couple_households (client_id);

alter table public.couple_households enable row level security;
-- No policy: Client-Owned, no coordinator visibility. See header comment.

create trigger couple_households_updated_at
  before update on public.couple_households
  for each row execute function public.set_updated_at();

-- ── 2. Backfill group_label → couple_households, then retire group_label ────

insert into public.couple_households (venue_id, client_id, name)
select distinct venue_id, client_id, trim(group_label)
from public.couple_guests
where group_label is not null and trim(group_label) <> '';

update public.couple_guests g
set household_id = h.id
from public.couple_households h
where h.client_id = g.client_id
  and h.name = trim(g.group_label)
  and g.household_id is null
  and g.group_label is not null and trim(g.group_label) <> '';

alter table public.couple_guests
  add constraint couple_guests_household_id_fkey
  foreign key (household_id) references public.couple_households(id) on delete set null;

-- Depends on couple_guests.group_label via `g.*` — must go before the column drop.
-- Dead code besides: zero callers anywhere in the app (see header comment).
drop view if exists public.shared_couple_guests;

alter table public.couple_guests drop column group_label;

-- ── 3. Tighten couple_guests RLS back to Client-Owned ────────────────────────

drop policy if exists "venue owner reads couple guests" on public.couple_guests;

-- ── 4. Guest creation RPCs — reconciled to identical field sets ──────────────

-- add_couple_guest had two live, undropped overloads (the original 7-arg
-- Sprint 50 signature and the 9-arg Sprint 86 one that replaced it in
-- practice but never removed the old one at the database level). Both are
-- superseded by the single signature below.
drop function if exists public.add_couple_guest(text, text, text, text, boolean, text, text);
drop function if exists public.add_couple_guest(text, text, text, text, boolean, text, text, text, boolean);

create or replace function public.add_couple_guest(
  p_token         text,
  p_first_name    text,
  p_last_name     text    default '',
  p_email         text    default '',
  p_phone         text    default '',
  p_plus_one      boolean default false,
  p_plus_one_name text    default '',
  p_household_id  uuid    default null,
  p_dietary       text    default '',
  p_is_child      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id      uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;
  if trim(coalesce(p_first_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'first_name_required');
  end if;

  if p_household_id is not null and not exists (
    select 1 from public.couple_households
    where id = p_household_id and client_id = v_session.client_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_household');
  end if;

  insert into public.couple_guests
    (venue_id, client_id, first_name, last_name, email, phone,
     plus_one, plus_one_name, household_id, dietary_restrictions, is_child)
  values
    (v_session.venue_id, v_session.client_id,
     trim(p_first_name),
     nullif(trim(coalesce(p_last_name, '')), ''),
     nullif(trim(coalesce(p_email, '')), ''),
     nullif(trim(coalesce(p_phone, '')), ''),
     coalesce(p_plus_one, false),
     nullif(trim(coalesce(p_plus_one_name, '')), ''),
     p_household_id,
     nullif(trim(coalesce(p_dietary, '')), ''),
     coalesce(p_is_child, false))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'guestId', v_id);
end;
$$;

grant execute on function public.add_couple_guest(text,text,text,text,text,boolean,text,uuid,text,boolean)
  to anon, authenticated;

-- update_couple_guest — Basic Editing (Requirement 4). Did not exist before
-- this migration: a guest could only ever be added, deleted, or have its
-- rsvpStatus flipped — never corrected once created.
create or replace function public.update_couple_guest(
  p_token         text,
  p_guest_id      uuid,
  p_first_name    text,
  p_last_name     text    default '',
  p_email         text    default '',
  p_phone         text    default '',
  p_plus_one      boolean default false,
  p_plus_one_name text    default '',
  p_household_id  uuid    default null,
  p_dietary       text    default '',
  p_is_child      boolean default false,
  p_notes         text    default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;
  if trim(coalesce(p_first_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'first_name_required');
  end if;

  if p_household_id is not null and not exists (
    select 1 from public.couple_households
    where id = p_household_id and client_id = v_session.client_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_household');
  end if;

  update public.couple_guests
  set first_name           = trim(p_first_name),
      last_name            = nullif(trim(coalesce(p_last_name, '')), ''),
      email                = nullif(trim(coalesce(p_email, '')), ''),
      phone                = nullif(trim(coalesce(p_phone, '')), ''),
      plus_one             = coalesce(p_plus_one, false),
      plus_one_name        = nullif(trim(coalesce(p_plus_one_name, '')), ''),
      household_id         = p_household_id,
      dietary_restrictions = nullif(trim(coalesce(p_dietary, '')), ''),
      is_child             = coalesce(p_is_child, false),
      notes                = nullif(trim(coalesce(p_notes, '')), ''),
      updated_at           = now()
  where id = p_guest_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'guest_not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_couple_guest(text,uuid,text,text,text,text,boolean,text,uuid,text,boolean,text)
  to anon, authenticated;

-- batch_add_couple_guests — CSV import, extended to resolve-or-create a
-- household by name per row instead of writing group_label, so an imported
-- guest is structurally identical to a manually-added one (Requirement 3).
create or replace function public.batch_add_couple_guests(
  p_token  text,
  p_guests jsonb  -- array of { firstName, lastName, email, household }
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_guest          jsonb;
  v_count          integer := 0;
  v_household_name text;
  v_household_id   uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  for v_guest in select * from jsonb_array_elements(p_guests)
  loop
    v_household_id := null;
    v_household_name := nullif(trim(coalesce(v_guest->>'household', '')), '');

    if v_household_name is not null then
      select id into v_household_id
      from public.couple_households
      where client_id = v_session.client_id and lower(name) = lower(v_household_name)
      limit 1;

      if v_household_id is null then
        insert into public.couple_households (venue_id, client_id, name)
        values (v_session.venue_id, v_session.client_id, v_household_name)
        returning id into v_household_id;
      end if;
    end if;

    insert into public.couple_guests
      (venue_id, client_id, first_name, last_name, email, household_id)
    values (
      v_session.venue_id,
      v_session.client_id,
      trim(v_guest->>'firstName'),
      nullif(trim(coalesce(v_guest->>'lastName', '')), ''),
      nullif(trim(coalesce(v_guest->>'email', '')), ''),
      v_household_id
    );
    v_count := v_count + 1;
  end loop;

  insert into public.couple_portal_events (venue_id, client_id, session_id, event_type, event_data)
  values (v_session.venue_id, v_session.client_id, v_session.id,
          'csv_imported', jsonb_build_object('count', v_count));

  return jsonb_build_object('ok', true, 'imported', v_count);
end;
$$;

-- get_couple_guests — same signature (create or replace keeps its existing
-- grant); returns the complete field set both creation paths now share,
-- plus householdId/householdName so the couple's own workspace can group by
-- household instead of a re-typed label.
create or replace function public.get_couple_guests(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'guests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',            g.id,
          'firstName',     g.first_name,
          'lastName',      g.last_name,
          'email',         g.email,
          'phone',         g.phone,
          'isChild',       g.is_child,
          'plusOne',       g.plus_one,
          'plusOneName',   g.plus_one_name,
          'plusOneMeal',   g.plus_one_meal,
          'rsvpStatus',    g.rsvp_status,
          'rsvpNote',      g.rsvp_note,
          'dietary',       g.dietary_restrictions,
          'mealChoice',    g.meal_choice,
          'householdId',   g.household_id,
          'householdName', h.name,
          'notes',         g.notes,
          'rsvpToken',     g.rsvp_token,
          'rsvpSentAt',    g.rsvp_sent_at
        ) order by h.name nulls last, g.sort_order, g.first_name
      )
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      where g.client_id = v_session.client_id
        and g.venue_id  = v_session.venue_id
    ), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'total',        count(*),
        'attending',    count(*) filter (where rsvp_status = 'attending'),
        'declined',     count(*) filter (where rsvp_status = 'declined'),
        'pending',      count(*) filter (where rsvp_status = 'pending'),
        'children',     count(*) filter (where is_child = true),
        'withPlusOnes', count(*) filter (where plus_one = true and rsvp_status = 'attending')
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
    )
  );
end;
$$;

-- ── 5. Household RPCs ─────────────────────────────────────────────────────────

create or replace function public.get_couple_households(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'households', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', h.id, 'name', h.name, 'notes', h.notes,
          'memberCount', (select count(*) from public.couple_guests g where g.household_id = h.id)
        ) order by h.name
      )
      from public.couple_households h
      where h.client_id = v_session.client_id and h.venue_id = v_session.venue_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_couple_households(text) to anon, authenticated;

create or replace function public.upsert_couple_household(
  p_token text,
  p_id    uuid default null,
  p_name  text default '',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id      uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;
  if trim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;

  if p_id is null then
    insert into public.couple_households (venue_id, client_id, name, notes)
    values (v_session.venue_id, v_session.client_id, trim(p_name), nullif(trim(coalesce(p_notes, '')), ''))
    returning id into v_id;
  else
    update public.couple_households
    set name = trim(p_name), notes = nullif(trim(coalesce(p_notes, '')), '')
    where id = p_id and client_id = v_session.client_id
    returning id into v_id;

    if v_id is null then
      return jsonb_build_object('ok', false, 'error', 'household_not_found');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'householdId', v_id);
end;
$$;

grant execute on function public.upsert_couple_household(text,uuid,text,text) to anon, authenticated;

create or replace function public.delete_couple_household(p_token text, p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  -- Members are not deleted — household_id is set null via the FK, same
  -- "orphan, don't cascade-delete real records" stance used elsewhere.
  delete from public.couple_households
  where id = p_household_id and client_id = v_session.client_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_couple_household(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
