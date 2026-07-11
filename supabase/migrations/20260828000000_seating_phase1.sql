-- ============================================================================
-- Seating Experience — Phase 1: Foundation & Floor Plan Integration
--
-- Traced before writing anything: a Seating feature already existed
-- (couple_seating_arrangements / seating_tables / guest_seat_assignments,
-- Sprint 74) with its own 1200x800 canvas and its own table_type vocabulary
-- (round/rectangular/head/sweetheart/cocktail) — completely disconnected
-- from floor_plans/floor_plan_objects, exactly the "second seating canvas,
-- second table model" this task's architecture forbids. It also carried
-- venue_rw_* RLS policies granting venue staff full read/write over the
-- couple's seating — the same "Client-Owned in name only" bug Guest
-- Foundation Phase 1 found and fixed on couple_guests. Confirmed zero real
-- rows exist in any of the three tables (a Docker query, not an assumption)
-- before dropping them — this is a correction, not data loss.
--
-- Replaced with the smallest possible relationship layer:
--
--   - Tables are floor_plan_objects rows. Nothing about a table's geometry,
--     shape, label, or capacity is duplicated — Seating only ever reads
--     x/y/width/height/rotation/display_shape/label/capacity live off the
--     real Floor Plan. Move a table in the Floor Plan editor and Seating
--     reflects it on its next load; there is no cached copy to go stale.
--
--   - guest_seat_assignments is the one new table, and it is pure
--     relationship: guest_id + table_object_id, nothing else. A table's
--     "assigned guests" is this table filtered by table_object_id, not a
--     column anywhere. This is the one place a new table was actually
--     required — a table has many assigned guests, a guest has one table;
--     that many-to-one shape has no home on either existing row without
--     duplicating data onto one side or the other.
--
--   - floor_plans.client_access (added by Client Identity Foundation,
--     documented ever since as "reserved and unbuilt") is what Seating
--     resolves against to find which Floor Plan the venue has prepared for
--     the couple — no new column needed. A floor plan with client_access
--     != 'hidden' is available to Seating; the venue turns this on when
--     the room is ready, same spirit as the architecture's "the venue
--     prepares the room, the couple prepares the seating."
--
--   - Table deletion rule (floor-plan-seating-architecture.md §5.3 left
--     this an open question "before Seating is built" — resolved here):
--     table_object_id is ON DELETE SET NULL, not CASCADE. Deleting a table
--     from the Floor Plan never deletes a guest's seating decision — the
--     assignment row survives with table_object_id = null, surfaced to the
--     couple as "needs a new table" (get_seating_data's needsReassignment),
--     distinct from a guest who was simply never assigned. The Floor Plan
--     editor's own editing is never blocked by Seating's state, matching
--     the Venue-Owned/Client-Owned boundary already established.
--
--   - is_wedding_party is one new boolean on couple_guests. Requirement 4
--     asks for a "Wedding Party" filter alongside Household/Children/Vendor
--     Meals; no existing column captures it, and reusing Households for it
--     would conflate two different, real groupings (who lives together vs.
--     who's in the ceremony). A single flag, same shape as is_child and
--     is_vendor_meal, extends the one Guest model rather than starting a
--     second one.
-- ============================================================================

-- ── 1. Retire the disconnected seating system ────────────────────────────────

drop function if exists public.get_seating_data(text);
drop function if exists public.upsert_seating_table(text, uuid, text, text, integer, numeric, numeric, integer);
drop function if exists public.delete_seating_table(text, uuid);
drop function if exists public.assign_guest_to_table(text, uuid, uuid);
drop function if exists public.remove_guest_assignment(text, uuid);
drop function if exists public.get_seating_suggestions(text);

drop table if exists public.guest_seat_assignments;
drop table if exists public.seating_tables;
drop table if exists public.couple_seating_arrangements;

-- ── 2. Guest model: one new flag ─────────────────────────────────────────────

alter table public.couple_guests
  add column is_wedding_party boolean not null default false;

-- ── 3. The one new table: pure Guest <-> Floor-Plan-Object relationship ─────

create table public.guest_seat_assignments (
  id              uuid primary key default gen_random_uuid(),
  guest_id        uuid not null references public.couple_guests(id) on delete cascade,
  table_object_id uuid references public.floor_plan_objects(id) on delete set null,
  assigned_at     timestamptz not null default now(),
  unique (guest_id)
);

create index guest_seat_assignments_table on public.guest_seat_assignments (table_object_id);

alter table public.guest_seat_assignments enable row level security;
-- No policy: Client-Owned, same as couple_households / couple_meal_options —
-- who sits where is the couple's own planning decision (Requirement 7).
-- Access only through the SECURITY DEFINER portal functions below.

-- ============================================================================
-- RPCs — same names/signatures the portal API routes already call where
-- possible, so the Sprint 74 UI's interaction shape (visual canvas, drag to
-- seat, household-aware suggestions) can be reused rather than rebuilt.
-- ============================================================================

create or replace function public.get_seating_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids        record;
  v_floor_plan record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0));
  end if;

  -- The Floor Plan the venue has prepared and shared. If more than one is
  -- shared, the most recently updated wins — a rare case, and simpler than
  -- asking the couple to disambiguate which room they're seating.
  select fp.id, fp.name, fp.room_width_ft, fp.room_depth_ft,
         fp.background_image_url, fp.background_image_opacity
  into v_floor_plan
  from public.floor_plans fp
  where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
  order by fp.updated_at desc
  limit 1;

  if v_floor_plan.id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb, 'needsReassignment', '[]'::jsonb,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0)
    );
  end if;

  return jsonb_build_object(
    'floorPlan', jsonb_build_object(
      'id', v_floor_plan.id, 'name', v_floor_plan.name,
      'roomWidthFt', v_floor_plan.room_width_ft, 'roomDepthFt', v_floor_plan.room_depth_ft,
      'backgroundImageUrl', v_floor_plan.background_image_url,
      'backgroundImageOpacity', v_floor_plan.background_image_opacity
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label, 'capacity', o.capacity,
        'x', o.x, 'y', o.y, 'width', o.width, 'height', o.height, 'rotation', o.rotation,
        'displayShape', o.display_shape,
        'guests', coalesce((
          select jsonb_agg(jsonb_build_object(
            'guestId',           g.id,
            'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
            'mealChoice',        g.meal_choice,
            'dietaryTags',       to_jsonb(g.dietary_tags),
            'accessibilityTags', to_jsonb(g.accessibility_tags),
            'isChild',           g.is_child,
            'isVendorMeal',      g.is_vendor_meal,
            'isWeddingParty',    g.is_wedding_party,
            'householdId',       g.household_id,
            'householdName',     h.name,
            'plusOneOfGuestId',  g.plus_one_of_guest_id
          ) order by g.first_name)
          from public.guest_seat_assignments gsa
          join public.couple_guests g on g.id = gsa.guest_id
          left join public.couple_households h on h.id = g.household_id
          where gsa.table_object_id = o.id
        ), '[]'::jsonb)
      ) order by o.sort_order, o.label)
      from public.floor_plan_objects o
      where o.floor_plan_id = v_floor_plan.id
        and o.object_type in ('table_round', 'table_rect', 'table_oval')
    ), '[]'::jsonb),
    'unassignedGuests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guestId',           g.id,
        'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'mealChoice',        g.meal_choice,
        'dietaryTags',       to_jsonb(g.dietary_tags),
        'accessibilityTags', to_jsonb(g.accessibility_tags),
        'isChild',           g.is_child,
        'isVendorMeal',      g.is_vendor_meal,
        'isWeddingParty',    g.is_wedding_party,
        'householdId',       g.household_id,
        'householdName',     h.name,
        'plusOneOfGuestId',  g.plus_one_of_guest_id
      ) order by g.first_name)
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      left join public.guest_seat_assignments gsa on gsa.guest_id = g.id
      where g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
        and g.rsvp_status = 'attending'
        and gsa.id is null
    ), '[]'::jsonb),
    -- Guests whose table was deleted out from under them in the Floor Plan
    -- editor — a real assignment still exists, it just points nowhere now.
    'needsReassignment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guestId',           g.id,
        'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'mealChoice',        g.meal_choice,
        'dietaryTags',       to_jsonb(g.dietary_tags),
        'accessibilityTags', to_jsonb(g.accessibility_tags),
        'isChild',           g.is_child,
        'isVendorMeal',      g.is_vendor_meal,
        'isWeddingParty',    g.is_wedding_party,
        'householdId',       g.household_id,
        'householdName',     h.name,
        'plusOneOfGuestId',  g.plus_one_of_guest_id
      ) order by g.first_name)
      from public.guest_seat_assignments gsa
      join public.couple_guests g on g.id = gsa.guest_id
      left join public.couple_households h on h.id = g.household_id
      where gsa.table_object_id is null
        and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'totalAttending', (
        select count(*) from public.couple_guests
        where client_id = v_ids.client_id and venue_id = v_ids.venue_id and rsvp_status = 'attending'
      ),
      'totalAssigned', (
        select count(*) from public.guest_seat_assignments gsa
        join public.couple_guests g on g.id = gsa.guest_id
        where gsa.table_object_id is not null and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
      ),
      'tableCount', (
        select count(*) from public.floor_plan_objects
        where floor_plan_id = v_floor_plan.id and object_type in ('table_round', 'table_rect', 'table_oval')
      ),
      'totalCapacity', (
        select coalesce(sum(capacity), 0) from public.floor_plan_objects
        where floor_plan_id = v_floor_plan.id and object_type in ('table_round', 'table_rect', 'table_oval')
      )
    )
  );
end;
$$;

grant execute on function public.get_seating_data(text) to anon, authenticated;

create or replace function public.assign_guest_to_table(p_token text, p_guest_id uuid, p_table_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  -- The table must be a real table object on a Floor Plan the venue has
  -- shared for this booking — never an object from someone else's plan,
  -- never a non-table object (a Stage, a Bar).
  if not exists (
    select 1 from public.floor_plan_objects o
    join public.floor_plans fp on fp.id = o.floor_plan_id
    where o.id = p_table_id
      and fp.event_id = v_ids.event_id
      and fp.client_access != 'hidden'
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, table_object_id)
  values (p_guest_id, p_table_id)
  on conflict (guest_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;

grant execute on function public.assign_guest_to_table(text, uuid, uuid) to anon, authenticated;

-- Explicit removal (the couple unseating someone) always deletes the row
-- entirely — distinct from a table being deleted out from under an
-- assignment, which keeps the row so it surfaces in needsReassignment.
create or replace function public.remove_guest_assignment(p_token text, p_guest_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  delete from public.guest_seat_assignments where guest_id = p_guest_id;
  return true;
end;
$$;

grant execute on function public.remove_guest_assignment(text, uuid) to anon, authenticated;

create or replace function public.get_seating_suggestions(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('households', '[]'::jsonb); end if;

  return jsonb_build_object(
    'households', coalesce((
      select jsonb_agg(jsonb_build_object(
        'householdKey', sub.household_key,
        'guestIds',     to_jsonb(sub.guest_ids),
        'names',        to_jsonb(sub.names),
        'size',         array_length(sub.guest_ids, 1)
      ))
      from (
        select coalesce(g.household_id::text, g.id::text) as household_key,
               array_agg(g.id)                                                    as guest_ids,
               array_agg(trim(g.first_name || ' ' || coalesce(g.last_name, ''))) as names
        from public.couple_guests g
        left join public.guest_seat_assignments gsa on gsa.guest_id = g.id
        where g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
          and g.rsvp_status = 'attending'
          and (gsa.id is null or gsa.table_object_id is null)
        group by coalesce(g.household_id::text, g.id::text)
      ) sub
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_seating_suggestions(text) to anon, authenticated;

-- ── 4. Wire is_wedding_party through the existing guest RPCs ────────────────

drop function if exists public.add_couple_guest(text,text,text,text,text,boolean,text,uuid,text,boolean,text,text[],text[],text,integer,boolean,text,boolean);
drop function if exists public.update_couple_guest(text,uuid,text,text,text,text,boolean,text,uuid,text,boolean,text,text,text[],text[],text,integer,boolean,text,boolean);

create or replace function public.add_couple_guest(
  p_token               text,
  p_first_name          text,
  p_last_name           text    default '',
  p_email               text    default '',
  p_phone               text    default '',
  p_plus_one            boolean default false,
  p_plus_one_name       text    default '',
  p_household_id        uuid    default null,
  p_dietary             text    default '',
  p_is_child            boolean default false,
  p_meal_choice         text    default '',
  p_dietary_tags        text[]  default '{}',
  p_accessibility_tags  text[]  default '{}',
  p_accessibility_notes text    default '',
  p_age                 integer default null,
  p_high_chair_required boolean default false,
  p_child_notes         text    default '',
  p_is_vendor_meal      boolean default false,
  p_is_wedding_party    boolean default false
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
     plus_one, plus_one_name, household_id, dietary_restrictions, is_child,
     meal_choice, dietary_tags, accessibility_tags, accessibility_notes,
     age, high_chair_required, child_notes, is_vendor_meal, is_wedding_party,
     rsvp_status)
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
     coalesce(p_is_child, false),
     nullif(trim(coalesce(p_meal_choice, '')), ''),
     coalesce(p_dietary_tags, '{}'),
     coalesce(p_accessibility_tags, '{}'),
     nullif(trim(coalesce(p_accessibility_notes, '')), ''),
     p_age,
     coalesce(p_high_chair_required, false),
     nullif(trim(coalesce(p_child_notes, '')), ''),
     coalesce(p_is_vendor_meal, false),
     coalesce(p_is_wedding_party, false),
     case when p_is_vendor_meal then 'attending' else 'pending' end)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'guestId', v_id);
end;
$$;

grant execute on function public.add_couple_guest(
  text,text,text,text,text,boolean,text,uuid,text,boolean,text,text[],text[],text,integer,boolean,text,boolean,boolean
) to anon, authenticated;

create or replace function public.update_couple_guest(
  p_token               text,
  p_guest_id            uuid,
  p_first_name          text,
  p_last_name           text    default '',
  p_email               text    default '',
  p_phone               text    default '',
  p_plus_one            boolean default false,
  p_plus_one_name       text    default '',
  p_household_id        uuid    default null,
  p_dietary             text    default '',
  p_is_child            boolean default false,
  p_notes               text    default '',
  p_meal_choice         text    default '',
  p_dietary_tags        text[]  default '{}',
  p_accessibility_tags  text[]  default '{}',
  p_accessibility_notes text    default '',
  p_age                 integer default null,
  p_high_chair_required boolean default false,
  p_child_notes         text    default '',
  p_is_vendor_meal      boolean default false,
  p_is_wedding_party    boolean default false
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
      meal_choice          = nullif(trim(coalesce(p_meal_choice, '')), ''),
      dietary_tags         = coalesce(p_dietary_tags, '{}'),
      accessibility_tags   = coalesce(p_accessibility_tags, '{}'),
      accessibility_notes  = nullif(trim(coalesce(p_accessibility_notes, '')), ''),
      age                  = p_age,
      high_chair_required  = coalesce(p_high_chair_required, false),
      child_notes          = nullif(trim(coalesce(p_child_notes, '')), ''),
      is_vendor_meal       = coalesce(p_is_vendor_meal, false),
      is_wedding_party     = coalesce(p_is_wedding_party, false),
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

grant execute on function public.update_couple_guest(
  text,uuid,text,text,text,text,boolean,text,uuid,text,boolean,text,text,text[],text[],text,integer,boolean,text,boolean,boolean
) to anon, authenticated;

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
          'plusOneOfGuestId', g.plus_one_of_guest_id,
          'rsvpStatus',    g.rsvp_status,
          'rsvpNote',      g.rsvp_note,
          'dietary',       g.dietary_restrictions,
          'dietaryTags',       coalesce(to_jsonb(g.dietary_tags), '[]'::jsonb),
          'accessibilityTags', coalesce(to_jsonb(g.accessibility_tags), '[]'::jsonb),
          'accessibilityNotes', g.accessibility_notes,
          'mealChoice',    g.meal_choice,
          'householdId',   g.household_id,
          'householdName', h.name,
          'notes',         g.notes,
          'rsvpToken',     g.rsvp_token,
          'rsvpSentAt',    g.rsvp_sent_at,
          'invitationStatus', g.invitation_status,
          'age',               g.age,
          'highChairRequired', g.high_chair_required,
          'childNotes',        g.child_notes,
          'isVendorMeal',      g.is_vendor_meal,
          'isWeddingParty',    g.is_wedding_party
        ) order by h.name nulls last, g.sort_order, g.first_name
      )
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      where g.client_id = v_session.client_id
        and g.venue_id  = v_session.venue_id
    ), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'total',        count(*) filter (where not is_vendor_meal),
        'attending',    count(*) filter (where not is_vendor_meal and rsvp_status = 'attending'),
        'declined',     count(*) filter (where not is_vendor_meal and rsvp_status = 'declined'),
        'pending',      count(*) filter (where not is_vendor_meal and rsvp_status = 'pending'),
        'children',     count(*) filter (where not is_vendor_meal and is_child = true),
        'withPlusOnes', count(*) filter (where not is_vendor_meal and plus_one = true and rsvp_status = 'attending'),
        'vendorMeals',  count(*) filter (where is_vendor_meal)
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
    )
  );
end;
$$;

notify pgrst, 'reload schema';
