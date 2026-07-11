-- ============================================================================
-- Guest Experience — Phase 3: Meals, Dietary & Guest Details
--
-- Implements docs/guest-experience-implementation-plan.md's Phase 3, on top
-- of Phase 1 (Guest & Household Foundation) and Phase 2 (Invitations &
-- Responses). Scope: complete the Guest record as the single source of
-- truth for meal selection, dietary, accessibility, plus ones, children,
-- and vendor meals. Does not touch Seating, Calendar, Website, or the
-- Venue Operational View.
--
-- 1. Meal Selection — reconciled to one model. couple_guests.meal_choice /
--    plus_one_meal (already the write target of submit_rsvp, unchanged)
--    remain the single authoritative field per guest. What changes is the
--    *catalog* of options a guest picks from: it used to be smuggled into
--    the generic rsvp_questions/rsvp_answers system via a magic
--    question_key = 'meal_choice' convention (a real Guest Experience
--    audit finding — two representations of the same fact). That catalog
--    now lives in its own couple_meal_options table; the generic question
--    system is freed up for what it's actually for (song requests, shuttle
--    needs, etc.) and no longer has a special-cased key.
--
-- 2/3. Dietary & Accessibility — modeled as fixed-vocabulary tag arrays
--    (native Postgres array + check constraint) rather than a join table:
--    a guest has a small set of tags from a short known list, not an
--    independent entity of its own, so a table+RLS+RPC set for each would
--    be needless machinery. `dietary_restrictions` (pre-existing) is kept
--    as the free-text "anything not covered by the standard tags" field
--    rather than adding yet another notes column.
--
-- 4. Plus Ones — plus_one_of_guest_id makes a plus-one a real couple_guests
--    row (its own id, rsvp_status, meal_choice, dietary/accessibility —
--    everything a guest has). plus_one_name/plus_one_meal on the primary
--    guest are kept, not duplicated-away: they're the guest's own
--    self-reported staging values from submit_rsvp (unchanged, still the
--    guest-facing RSVP mechanism) until the couple explicitly converts
--    that name into its own real guest record. Before conversion, "the
--    plus-one" is a name on the primary's row; after, it's its own row —
--    never both at once claiming to be authoritative.
--
-- 5. Children — age/high_chair_required/child_notes alongside the
--    existing is_child flag. Deliberately no separate "kids meal" field:
--    a kids' meal is just an ordinary entry in the same meal catalog
--    Requirement 1 established — a second field would be exactly the
--    duplicate meal-tracking mechanism this phase exists to remove.
--
-- 6. Guest Notes — already exists (couple_guests.notes, private, zero
--    venue RLS since Phase 1). Nothing to build.
--
-- 7. Vendor Meals — is_vendor_meal marks an ordinary couple_guests row as
--    a vendor's meal rather than a social guest. Same table, same
--    meal_choice column — no second meal-tracking system. Excluded from
--    guest-facing stats/invitation progress (a caterer doesn't RSVP) but
--    fully queryable for meal counts whenever that reporting is built.
-- ============================================================================

-- ── 1. Meal options catalog ───────────────────────────────────────────────────

create table public.couple_meal_options (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,

  name        text not null check (char_length(trim(name)) > 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (client_id, name)
);

create index couple_meal_options_client on public.couple_meal_options (client_id, sort_order);

alter table public.couple_meal_options enable row level security;
-- No policy: Client-Owned, same as couple_households — access only through
-- the SECURITY DEFINER portal functions below.

create trigger couple_meal_options_updated_at
  before update on public.couple_meal_options
  for each row execute function public.set_updated_at();

-- Backfill: any existing meal_choice question's options become real catalog
-- entries, then the question itself is retired (rsvp_answers for it cascade
-- with it — those answers already have their real home in
-- couple_guests.meal_choice via submit_rsvp, so nothing is lost).
insert into public.couple_meal_options (venue_id, client_id, name, sort_order)
select q.venue_id, q.client_id, opt.value, opt.ordinality - 1
from public.rsvp_questions q
cross join lateral jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb)) with ordinality as opt(value, ordinality)
where q.question_key = 'meal_choice'
on conflict (client_id, name) do nothing;

delete from public.rsvp_questions where question_key = 'meal_choice';

-- ── 2/3. Dietary & Accessibility tags ─────────────────────────────────────────

alter table public.couple_guests
  add column dietary_tags text[] not null default '{}'
    check (dietary_tags <@ array[
      'vegetarian','vegan','gluten_free','dairy_free',
      'nut_allergy','shellfish_allergy','kosher','halal'
    ]::text[]),
  add column accessibility_tags text[] not null default '{}'
    check (accessibility_tags <@ array[
      'wheelchair','limited_mobility','hearing_assistance',
      'vision_assistance','service_animal','special_seating'
    ]::text[]),
  add column accessibility_notes text;

comment on column public.couple_guests.dietary_restrictions is
  'Free-text dietary notes beyond the standard dietary_tags — custom restrictions, allergy severity, etc.';

-- ── 4. Plus Ones as real Guest records ───────────────────────────────────────

alter table public.couple_guests
  add column plus_one_of_guest_id uuid references public.couple_guests(id) on delete cascade;

create index couple_guests_plus_one_of on public.couple_guests (plus_one_of_guest_id) where plus_one_of_guest_id is not null;

-- ── 5. Children ───────────────────────────────────────────────────────────────

alter table public.couple_guests
  add column age integer check (age is null or (age >= 0 and age <= 120)),
  add column high_chair_required boolean not null default false,
  add column child_notes text;

-- ── 7. Vendor Meals ───────────────────────────────────────────────────────────

alter table public.couple_guests
  add column is_vendor_meal boolean not null default false;

-- ============================================================================
-- RPCs
-- ============================================================================

-- ── Meal options ──────────────────────────────────────────────────────────────

create or replace function public.get_couple_meal_options(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'mealOptions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name, 'isActive', m.is_active
      ) order by m.sort_order, m.name)
      from public.couple_meal_options m
      where m.client_id = v_session.client_id and m.venue_id = v_session.venue_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_couple_meal_options(text) to anon, authenticated;

create or replace function public.upsert_couple_meal_option(
  p_token text, p_id uuid default null, p_name text default '', p_sort_order integer default 0
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
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;
  if trim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;

  if p_id is null then
    insert into public.couple_meal_options (venue_id, client_id, name, sort_order)
    values (v_session.venue_id, v_session.client_id, trim(p_name), p_sort_order)
    returning id into v_id;
  else
    update public.couple_meal_options
    set name = trim(p_name), sort_order = p_sort_order
    where id = p_id and client_id = v_session.client_id
    returning id into v_id;

    if v_id is null then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'mealOptionId', v_id);
end;
$$;

grant execute on function public.upsert_couple_meal_option(text, uuid, text, integer) to anon, authenticated;

create or replace function public.delete_couple_meal_option(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  delete from public.couple_meal_options where id = p_id and client_id = v_session.client_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_couple_meal_option(text, uuid) to anon, authenticated;

-- ── Guest creation/editing — extended field set ──────────────────────────────
-- Both drop cleanly to one signature each rather than leave a second,
-- narrower overload dangling (same cleanup Phase 1 and 2 already did).

drop function if exists public.add_couple_guest(text,text,text,text,text,boolean,text,uuid,text,boolean);
drop function if exists public.update_couple_guest(text,uuid,text,text,text,text,boolean,text,uuid,text,boolean,text);

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
  p_is_vendor_meal      boolean default false
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
     age, high_chair_required, child_notes, is_vendor_meal,
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
     case when p_is_vendor_meal then 'attending' else 'pending' end)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'guestId', v_id);
end;
$$;

grant execute on function public.add_couple_guest(
  text,text,text,text,text,boolean,text,uuid,text,boolean,text,text[],text[],text,integer,boolean,text,boolean
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
  p_is_vendor_meal      boolean default false
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
  text,uuid,text,text,text,text,boolean,text,uuid,text,boolean,text,text,text[],text[],text,integer,boolean,text,boolean
) to anon, authenticated;

-- ── Plus One lifecycle ────────────────────────────────────────────────────────

-- Creates a brand-new plus-one guest record from scratch (the couple
-- proactively assigning one before any RSVP happens). Always a real Guest
-- record from the moment it exists — never a text field.
create or replace function public.assign_plus_one(
  p_token text, p_primary_guest_id uuid, p_name text default 'Guest'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_primary public.couple_guests%rowtype;
  v_new_id  uuid;
  v_name    text;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  select * into v_primary from public.couple_guests
  where id = p_primary_guest_id and client_id = v_session.client_id and venue_id = v_session.venue_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'guest_not_found'); end if;

  if exists (select 1 from public.couple_guests where plus_one_of_guest_id = p_primary_guest_id) then
    return jsonb_build_object('ok', false, 'error', 'plus_one_already_exists');
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then v_name := 'Guest of ' || v_primary.first_name; end if;

  insert into public.couple_guests
    (venue_id, client_id, first_name, household_id, plus_one_of_guest_id)
  values
    (v_session.venue_id, v_session.client_id, v_name, v_primary.household_id, p_primary_guest_id)
  returning id into v_new_id;

  update public.couple_guests set plus_one = true, updated_at = now() where id = p_primary_guest_id;

  return jsonb_build_object('ok', true, 'guestId', v_new_id);
end;
$$;

grant execute on function public.assign_plus_one(text, uuid, text) to anon, authenticated;

-- Converts a guest's self-reported plus_one_name (from their own RSVP,
-- submit_rsvp — unchanged) into its own real guest record, then clears the
-- staging fields on the primary so there is exactly one place the name
-- lives going forward.
create or replace function public.convert_plus_one_placeholder(p_token text, p_primary_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_primary public.couple_guests%rowtype;
  v_new_id  uuid;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  select * into v_primary from public.couple_guests
  where id = p_primary_guest_id and client_id = v_session.client_id and venue_id = v_session.venue_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'guest_not_found'); end if;

  if v_primary.plus_one_name is null then
    return jsonb_build_object('ok', false, 'error', 'no_plus_one_name');
  end if;
  if exists (select 1 from public.couple_guests where plus_one_of_guest_id = p_primary_guest_id) then
    return jsonb_build_object('ok', false, 'error', 'plus_one_already_exists');
  end if;

  insert into public.couple_guests
    (venue_id, client_id, first_name, household_id, plus_one_of_guest_id,
     meal_choice, rsvp_status)
  values
    (v_session.venue_id, v_session.client_id, v_primary.plus_one_name, v_primary.household_id, p_primary_guest_id,
     v_primary.plus_one_meal, v_primary.rsvp_status)
  returning id into v_new_id;

  update public.couple_guests
  set plus_one_name = null, plus_one_meal = null, updated_at = now()
  where id = p_primary_guest_id;

  return jsonb_build_object('ok', true, 'guestId', v_new_id);
end;
$$;

grant execute on function public.convert_plus_one_placeholder(text, uuid) to anon, authenticated;

create or replace function public.remove_plus_one(p_token text, p_primary_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  delete from public.couple_guests
  where plus_one_of_guest_id = p_primary_guest_id
    and client_id = v_session.client_id and venue_id = v_session.venue_id;

  update public.couple_guests
  set plus_one = false, plus_one_name = null, plus_one_meal = null, updated_at = now()
  where id = p_primary_guest_id and client_id = v_session.client_id and venue_id = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.remove_plus_one(text, uuid) to anon, authenticated;

-- ── get_couple_guests — full field set, vendor meals excluded from stats ─────

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
          'id',                 g.id,
          'firstName',          g.first_name,
          'lastName',           g.last_name,
          'email',              g.email,
          'phone',              g.phone,
          'isChild',            g.is_child,
          'plusOne',            g.plus_one,
          'plusOneName',        g.plus_one_name,
          'plusOneMeal',        g.plus_one_meal,
          'plusOneOfGuestId',   g.plus_one_of_guest_id,
          'rsvpStatus',         g.rsvp_status,
          'rsvpNote',           g.rsvp_note,
          'dietary',            g.dietary_restrictions,
          'dietaryTags',        coalesce(to_jsonb(g.dietary_tags), '[]'::jsonb),
          'accessibilityTags',  coalesce(to_jsonb(g.accessibility_tags), '[]'::jsonb),
          'accessibilityNotes', g.accessibility_notes,
          'mealChoice',         g.meal_choice,
          'householdId',        g.household_id,
          'householdName',      h.name,
          'notes',              g.notes,
          'rsvpToken',          g.rsvp_token,
          'rsvpSentAt',         g.rsvp_sent_at,
          'invitationStatus',   g.invitation_status,
          'age',                g.age,
          'highChairRequired',  g.high_chair_required,
          'childNotes',         g.child_notes,
          'isVendorMeal',       g.is_vendor_meal
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

-- get_invitation_progress — exclude vendor meals from every count; a
-- caterer's meal doesn't need an invitation or an RSVP chased down.

create or replace function public.get_invitation_progress(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'invitationStats', (
      select jsonb_build_object(
        'draft',     count(*) filter (where invitation_status = 'draft'),
        'ready',     count(*) filter (where invitation_status = 'ready'),
        'sent',      count(*) filter (where invitation_status = 'sent'),
        'delivered', count(*) filter (where invitation_status = 'delivered'),
        'opened',    count(*) filter (where invitation_status = 'opened'),
        'responded', count(*) filter (where invitation_status = 'responded'),
        'declined',  count(*) filter (where invitation_status = 'declined')
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id and not is_vendor_meal
    ),
    'pendingCount', (
      select count(*) from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
        and not is_vendor_meal
        and invitation_status in ('sent', 'delivered', 'opened')
        and rsvp_status = 'pending'
    ),
    'outstandingHouseholds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'name', h.name,
        'totalMembers', member_counts.total,
        'respondedMembers', member_counts.responded
      ) order by h.name)
      from public.couple_households h
      join lateral (
        select count(*) as total,
               count(*) filter (where g.rsvp_status != 'pending') as responded
        from public.couple_guests g
        where g.household_id = h.id and g.invitation_status != 'declined' and not g.is_vendor_meal
      ) member_counts on true
      where h.client_id = v_session.client_id and h.venue_id = v_session.venue_id
        and member_counts.total > 0
        and member_counts.responded < member_counts.total
    ), '[]'::jsonb),
    'recentlyResponded', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'rsvpStatus', g.rsvp_status,
        'respondedAt', g.rsvp_responded_at,
        'householdName', h.name
      ) order by g.rsvp_responded_at desc)
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      where g.client_id = v_session.client_id and g.venue_id = v_session.venue_id
        and g.rsvp_responded_at is not null and not g.is_vendor_meal
      limit 8
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
