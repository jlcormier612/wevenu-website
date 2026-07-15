-- ============================================================================
-- Fix: complete_venue_setup fails RLS when re-run for an existing venue
-- ============================================================================
-- Bug: `insert into public.venues (...) on conflict (owner_user_id) do update
-- ...` fails with "new row violates row-level security policy for table
-- venues" whenever a venue for this owner already exists (e.g. retrying the
-- setup wizard after an earlier incomplete attempt).
--
-- Root cause: the UPDATE arm of ON CONFLICT DO UPDATE requires the existing
-- row to satisfy venues' SELECT policy (`id = current_user_venue_id()`).
-- `current_user_venue_id()` itself queries `public.venues` — and that
-- self-reference, evaluated *during* the same INSERT/ON CONFLICT statement
-- against `venues`, does not resolve correctly. Confirmed empirically: the
-- exact same operation succeeds once split into a separate SELECT followed by
-- a plain INSERT or a plain UPDATE (each executed as their own statement),
-- with the original RLS policies completely unchanged. A plain UPDATE alone
-- was already proven to work; it is specifically the combined
-- INSERT-with-ON-CONFLICT-DO-UPDATE form that breaks self-referencing SELECT
-- policies. No policy changed here — only how complete_venue_setup writes to
-- venues.
--
-- Platform principle: **a self-referencing RLS policy (a policy on table T
-- that queries T, even indirectly through a SECURITY DEFINER helper) is not
-- safe to combine with INSERT ... ON CONFLICT DO UPDATE against T.** Prefer
-- an explicit `select ... ; if found then update else insert end if;` in any
-- future upsert-style RPC that writes to a table with this kind of policy.
--
-- Second, independent bug fixed in the same pass: the owner-staff upsert's
-- ON CONFLICT DO UPDATE set `updated_at = now()`, but `venue_staff` has no
-- `updated_at` column (never added in any migration) — this was always
-- broken, just unreachable until the RLS bug above was fixed, since every
-- retry attempt failed on the venues insert first.
--
-- Third, independent, and most severe bug fixed here: the business-hours
-- upsert loop lost its `::time` casts on `open_time`/`close_time` when this
-- function was rewritten by 20260703150000_sprint76_brand_colors.sql (the
-- original 20260626090000_venue_foundation.sql version had them). Those
-- columns are `time without time zone`; a bare `nullif(hour ->> 'open_time',
-- '')` is `text`, and Postgres does not implicitly cast a `text`-typed
-- expression to `time`. This broke *every* venue setup — first-time
-- creation included, not just retries — the moment sprint76 shipped; it
-- surfaced now only because fixing the RLS bug above let execution reach
-- this loop for the first time in a retry scenario.
--
-- One correction to the root-cause note above: the self-reference problem is
-- not specific to ON CONFLICT DO UPDATE. It is any `RETURNING` clause on a
-- DML statement against `venues` — confirmed empirically that even a brand
-- new, non-conflicting `insert ... returning id` fails the same way, while
-- the identical insert without `returning` succeeds. Postgres evaluates the
-- SELECT policy against a RETURNING row using a context in which
-- `current_user_venue_id()`'s self-referencing subquery cannot resolve. The
-- fix therefore avoids `returning` entirely: the id is generated in PL/pgSQL
-- before the insert and passed in explicitly.
-- ============================================================================

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
      true,
      now()
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
      setup_completed          = true,
      setup_completed_at       = coalesce(public.venues.setup_completed_at, now()),
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
