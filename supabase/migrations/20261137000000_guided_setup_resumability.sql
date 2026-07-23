-- ============================================================================
-- Hospitality Success Platform — Guided Setup Phase 1: resumable venue setup
-- + onboarding persona.
--
-- Two additions, both extending complete_venue_setup() rather than
-- redesigning it:
--
-- 1. onboarding_persona — captured once, right alongside the venue name, in
--    a new micro-question before "venue information." Drives which of three
--    scripts Luv/Guided Setup narrate with (brand-new / switching from
--    another system / former Weven customer) — see
--    docs/hospitality-success-platform-implementation-plan.md §1.2a.
--
-- 2. Resumable setup — today complete_venue_setup() always sets
--    setup_completed = true, both on first insert and on every later call.
--    That's correct for the one caller that existed until now (the final
--    "Create venue" submit), but wrong the moment the wizard also calls
--    this same RPC after every earlier step to save progress: an in-
--    progress save must NOT flip setup_completed to true, or app/(app)/
--    layout.tsx's gate would treat a half-filled-in venue as done.
--    setup_completed is now read from the payload (defaulting to true,
--    preserving the one existing caller's behavior exactly) instead of
--    hardcoded, and setup_completed_at only stamps the first time it
--    actually transitions to true.
--
-- Preserves the exact RLS-safe shape documented in
-- 20260927000000_fix_venue_setup_rls_self_reference.sql: select-then-branch,
-- no RETURNING anywhere in this function. Nothing about that hard-won fix
-- is touched here.
-- ============================================================================

alter table public.venues
  add column onboarding_persona text
    check (onboarding_persona in ('new', 'switching', 'weven_returning'));

-- setup_last_step — the furthest wizard step this venue has actually
-- completed, set on every progress save. Resuming reads this (not "first
-- step that fails validation") because most steps' fields are optional
-- with real defaults (timezone, brand colors, currency all pre-filled) —
-- "first invalid step" would skip straight past Venue Details/Hours/Brand
-- to Owner (the first unconditionally-required blank field), since those
-- earlier steps validate successfully without ever having been visited.
alter table public.venues
  add column setup_last_step text;

create or replace function public.complete_venue_setup(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  v_id uuid;
  hour jsonb;
  v_completed boolean := coalesce((payload ->> 'setup_completed')::boolean, true);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_id from public.venues where owner_user_id = uid;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into public.venues (
      id, owner_user_id, name, business_name, email, phone, website,
      address_line1, address_line2, city, state_region, postal_code, country,
      venue_type, capacity, timezone,
      logo_url, primary_color, secondary_color, accent_color, neutral_color,
      currency, week_starts_on,
      stripe_onboarding_status,
      onboarding_persona, setup_last_step,
      setup_completed, setup_completed_at
    ) values (
      v_id,
      uid,
      payload ->> 'name',
      nullif(payload ->> 'business_name', ''),
      nullif(payload ->> 'email', ''),
      nullif(payload ->> 'phone', ''),
      nullif(payload ->> 'website', ''),
      nullif(payload ->> 'address_line1', ''),
      nullif(payload ->> 'address_line2', ''),
      nullif(payload ->> 'city', ''),
      nullif(payload ->> 'state_region', ''),
      nullif(payload ->> 'postal_code', ''),
      nullif(payload ->> 'country', ''),
      nullif(payload ->> 'venue_type', ''),
      nullif(payload ->> 'capacity', '')::integer,
      coalesce(nullif(payload ->> 'timezone', ''), 'America/New_York'),
      nullif(payload ->> 'logo_url', ''),
      coalesce(nullif(payload ->> 'primary_color', ''), '#5D6F5D'),
      coalesce(nullif(payload ->> 'secondary_color', ''), '#4F5F4F'),
      coalesce(nullif(payload ->> 'accent_color', ''), '#B8AEA1'),
      coalesce(nullif(payload ->> 'neutral_color', ''), '#F7F5F1'),
      coalesce(nullif(payload ->> 'currency', ''), 'USD'),
      coalesce((payload ->> 'week_starts_on')::smallint, 0),
      coalesce(
        nullif(payload ->> 'stripe_onboarding_status', '')::text,
        'not_started'
      ),
      nullif(payload ->> 'onboarding_persona', ''),
      nullif(payload ->> 'setup_last_step', ''),
      v_completed,
      case when v_completed then now() else null end
    );
  else
    update public.venues set
      name                     = payload ->> 'name',
      business_name            = nullif(payload ->> 'business_name', ''),
      email                    = nullif(payload ->> 'email', ''),
      phone                    = nullif(payload ->> 'phone', ''),
      website                  = nullif(payload ->> 'website', ''),
      address_line1            = nullif(payload ->> 'address_line1', ''),
      address_line2            = nullif(payload ->> 'address_line2', ''),
      city                     = nullif(payload ->> 'city', ''),
      state_region             = nullif(payload ->> 'state_region', ''),
      postal_code              = nullif(payload ->> 'postal_code', ''),
      country                  = nullif(payload ->> 'country', ''),
      venue_type               = nullif(payload ->> 'venue_type', ''),
      capacity                 = nullif(payload ->> 'capacity', '')::integer,
      timezone                 = coalesce(nullif(payload ->> 'timezone', ''), 'America/New_York'),
      logo_url                 = nullif(payload ->> 'logo_url', ''),
      primary_color            = coalesce(nullif(payload ->> 'primary_color', ''), '#5D6F5D'),
      secondary_color          = coalesce(nullif(payload ->> 'secondary_color', ''), '#4F5F4F'),
      accent_color             = coalesce(nullif(payload ->> 'accent_color', ''), '#B8AEA1'),
      neutral_color            = coalesce(nullif(payload ->> 'neutral_color', ''), '#F7F5F1'),
      currency                 = coalesce(nullif(payload ->> 'currency', ''), 'USD'),
      week_starts_on           = coalesce((payload ->> 'week_starts_on')::smallint, 0),
      stripe_onboarding_status = coalesce(
                                    nullif(payload ->> 'stripe_onboarding_status', '')::text,
                                    'not_started'
                                  ),
      onboarding_persona       = coalesce(nullif(payload ->> 'onboarding_persona', ''), public.venues.onboarding_persona),
      setup_last_step          = coalesce(nullif(payload ->> 'setup_last_step', ''), public.venues.setup_last_step),
      -- Sticky once true: a stale in-flight progress-save (setup_completed:
      -- false) racing behind the real final submit must never un-complete
      -- an already-finished venue.
      setup_completed          = public.venues.setup_completed or v_completed,
      setup_completed_at       = case
                                    when (public.venues.setup_completed or v_completed) and public.venues.setup_completed_at is null then now()
                                    else public.venues.setup_completed_at
                                  end,
      updated_at               = now()
    where id = v_id;
  end if;

  -- Upsert owner staff record
  insert into public.venue_staff (venue_id, user_id, full_name, email, title, role, is_owner)
  values (
    v_id, uid,
    coalesce(nullif(payload -> 'owner' ->> 'full_name', ''), 'Owner'),
    nullif(payload -> 'owner' ->> 'email', ''),
    nullif(payload -> 'owner' ->> 'title', ''),
    'owner', true
  )
  on conflict (venue_id) where is_owner do update set
    full_name  = excluded.full_name,
    email      = excluded.email,
    title      = excluded.title
  where public.venue_staff.venue_id = v_id;

  -- Upsert business hours
  for hour in select * from jsonb_array_elements(payload -> 'business_hours')
  loop
    insert into public.venue_business_hours (venue_id, day_of_week, is_open, open_time, close_time)
    values (
      v_id,
      (hour ->> 'day_of_week')::smallint,
      (hour ->> 'is_open')::boolean,
      nullif(hour ->> 'open_time', '')::time,
      nullif(hour ->> 'close_time', '')::time
    )
    on conflict (venue_id, day_of_week) do update set
      is_open    = excluded.is_open,
      open_time  = excluded.open_time,
      close_time = excluded.close_time;
  end loop;

  notify pgrst, 'reload schema';
  return v_id;
end;
$$;

notify pgrst, 'reload schema';
