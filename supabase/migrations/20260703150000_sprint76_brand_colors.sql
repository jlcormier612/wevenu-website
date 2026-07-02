-- ============================================================================
-- Sprint 76 — Brand Colors Expansion
-- Adds accent_color and neutral_color to venues.
-- Updates complete_venue_setup RPC to persist all four brand colors.
-- ============================================================================

alter table public.venues
  add column if not exists accent_color  text not null default '#B8AEA1',
  add column if not exists neutral_color text not null default '#F7F5F1';

-- Replace the setup RPC to include the new brand color columns.
-- (This is a DROP + CREATE because the function body references the INSERT
--  column list explicitly — a CREATE OR REPLACE with new columns is the
--  cleanest pattern here.)
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

  insert into public.venues (
    owner_user_id, name, business_name, email, phone, website,
    address_line1, address_line2, city, state_region, postal_code, country,
    venue_type, capacity, timezone,
    logo_url, primary_color, secondary_color, accent_color, neutral_color,
    currency, week_starts_on,
    stripe_onboarding_status,
    setup_completed, setup_completed_at
  ) values (
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
  )
  on conflict (owner_user_id) do update set
    name                     = excluded.name,
    business_name            = excluded.business_name,
    email                    = excluded.email,
    phone                    = excluded.phone,
    website                  = excluded.website,
    address_line1            = excluded.address_line1,
    address_line2            = excluded.address_line2,
    city                     = excluded.city,
    state_region             = excluded.state_region,
    postal_code              = excluded.postal_code,
    country                  = excluded.country,
    venue_type               = excluded.venue_type,
    capacity                 = excluded.capacity,
    timezone                 = excluded.timezone,
    logo_url                 = excluded.logo_url,
    primary_color            = excluded.primary_color,
    secondary_color          = excluded.secondary_color,
    accent_color             = excluded.accent_color,
    neutral_color            = excluded.neutral_color,
    currency                 = excluded.currency,
    week_starts_on           = excluded.week_starts_on,
    stripe_onboarding_status = excluded.stripe_onboarding_status,
    setup_completed          = true,
    setup_completed_at       = coalesce(public.venues.setup_completed_at, now()),
    updated_at               = now()
  returning id into v_id;

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
    title      = excluded.title,
    updated_at = now()
  where public.venue_staff.venue_id = v_id;

  -- Upsert business hours
  for hour in select * from jsonb_array_elements(payload -> 'business_hours')
  loop
    insert into public.venue_business_hours (venue_id, day_of_week, is_open, open_time, close_time)
    values (
      v_id,
      (hour ->> 'day_of_week')::smallint,
      (hour ->> 'is_open')::boolean,
      nullif(hour ->> 'open_time', ''),
      nullif(hour ->> 'close_time', '')
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
