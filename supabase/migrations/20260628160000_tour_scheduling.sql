-- ============================================================================
-- Sprint 45: Public Tour Scheduling
--
-- "Website → Schedule Tour → Become Lead → Enter Wevenu"
-- The strongest front-door experience we can offer venues.
--
-- Design:
--   /book/{tour_embed_key} — public tour scheduling page (no auth)
--   Available slots derived from venue_business_hours
--   Slot conflicts checked against existing events + tour_appointments
--   Booking creates a lead + tour_appointment atomically
--
-- Two-path concept: couples choose "Request Info" (existing inquiry form)
--   or "Schedule a Tour" (this flow). Both become leads. Tours have an
--   immediate scheduled action date that Luv surfaces for coordinators.
-- ============================================================================

-- ── Tour settings (stored on venues table as additive columns) ───────────────

alter table public.venues
  add column tour_scheduling_enabled boolean not null default false,
  add column tour_embed_key text unique default encode(gen_random_bytes(16), 'hex'),
  add column tour_duration_minutes  integer not null default 60
    check (tour_duration_minutes > 0 and tour_duration_minutes <= 480),
  add column tour_min_notice_hours  integer not null default 24
    check (tour_min_notice_hours >= 0),
  add column tour_max_advance_days  integer not null default 90
    check (tour_max_advance_days > 0),
  add column tour_buffer_minutes    integer not null default 30
    check (tour_buffer_minutes >= 0),
  -- Optional message shown at top of booking page (e.g., "Tours run Tue–Sat 10am–4pm")
  add column tour_page_headline     text,
  add column tour_page_description  text;

-- ── Tour appointments ────────────────────────────────────────────────────────

create table public.tour_appointments (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  lead_id         uuid references public.leads(id) on delete set null,
  scheduled_at    timestamptz not null,
  duration_minutes integer not null default 60,
  status          text not null default 'scheduled' check (status in (
    'scheduled',   -- booked, awaiting confirmation
    'confirmed',   -- coordinator confirmed
    'completed',   -- tour happened
    'cancelled',   -- cancelled by either party
    'no_show'      -- couple did not arrive
  )),
  -- Couple's info at booking time (denormalized for fast display)
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  event_type      text,
  event_date      text,      -- ISO date string, may be approximate
  guest_count     integer,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.tour_appointments enable row level security;

create policy "venue owner manages tour appointments"
  on public.tour_appointments for all
  using (exists (
    select 1 from public.venues
    where id = tour_appointments.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.tour_appointments to authenticated;

-- Index for calendar queries
create index tour_appointments_venue_date
  on public.tour_appointments (venue_id, scheduled_at)
  where status not in ('cancelled');

-- ── SECURITY DEFINER: get available tour slots ────────────────────────────────
-- Returns array of available slot timestamps for a given venue and date range.
-- Derives availability from venue_business_hours, filters conflicts.

create or replace function public.get_tour_slots(
  p_embed_key text,
  p_start_date date,   -- search from this date (inclusive)
  p_end_date   date    -- search to this date (inclusive)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue       public.venues%rowtype;
  v_slots       jsonb := '[]'::jsonb;
  v_cursor_date date;
  v_dow         smallint;
  v_bh          record;
  v_slot_start  timestamptz;
  v_slot_end    timestamptz;
  v_has_conflict boolean;
  v_now         timestamptz := now();
  v_min_start   timestamptz;
  v_max_start   timestamptz;
  v_step        interval;
begin
  -- Validate embed key and tour scheduling is enabled
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('error', 'invalid_key');
  end if;

  v_min_start := v_now + (v_venue.tour_min_notice_hours || ' hours')::interval;
  v_max_start := v_now + (v_venue.tour_max_advance_days || ' days')::interval;
  v_step      := ((v_venue.tour_duration_minutes + v_venue.tour_buffer_minutes) || ' minutes')::interval;

  -- Clamp date range to max_advance
  if p_start_date::timestamptz < v_min_start then
    v_cursor_date := v_min_start::date;
  else
    v_cursor_date := p_start_date;
  end if;

  -- Iterate each day in the range
  while v_cursor_date <= p_end_date
    and v_cursor_date::timestamptz <= v_max_start
  loop
    v_dow := extract(dow from v_cursor_date)::smallint;  -- 0=Sun, 6=Sat

    -- Find business hours for this day of week
    select * into v_bh
    from public.venue_business_hours
    where venue_id = v_venue.id
      and day_of_week = v_dow
      and is_open = true;

    if found then
      -- Generate slots within business hours
      v_slot_start := (v_cursor_date::text || ' ' || v_bh.open_time::text || ' UTC')::timestamptz;

      while v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval
              <= (v_cursor_date::text || ' ' || v_bh.close_time::text || ' UTC')::timestamptz
      loop
        v_slot_end := v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

        -- Skip slots before the min notice window
        if v_slot_start >= v_min_start and v_slot_start <= v_max_start then

          -- Check conflict: existing tour appointments
          select exists(
            select 1 from public.tour_appointments ta
            where ta.venue_id = v_venue.id
              and ta.status not in ('cancelled')
              and ta.scheduled_at < v_slot_end
              and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > v_slot_start
          ) into v_has_conflict;

          if not v_has_conflict then
            -- Check conflict: existing events on this date
            select exists(
              select 1 from public.events e
              where e.venue_id = v_venue.id
                and e.event_date = v_cursor_date
                and e.status not in ('cancelled')
            ) into v_has_conflict;
          end if;

          if not v_has_conflict then
            v_slots := v_slots || jsonb_build_object(
              'start', v_slot_start,
              'end',   v_slot_end,
              'date',  v_cursor_date,
              'time',  to_char(v_slot_start at time zone 'UTC', 'HH12:MI AM')
            );
          end if;
        end if;

        v_slot_start := v_slot_start + v_step;
      end loop;
    end if;

    v_cursor_date := v_cursor_date + 1;
  end loop;

  return jsonb_build_object(
    'slots', v_slots,
    'venue', jsonb_build_object(
      'name',        v_venue.name,
      'headline',    v_venue.tour_page_headline,
      'description', v_venue.tour_page_description,
      'duration',    v_venue.tour_duration_minutes
    )
  );
end;
$$;

-- ── SECURITY DEFINER: book a tour slot ───────────────────────────────────────
-- Creates a tour_appointment + lead atomically.

create or replace function public.book_tour(
  p_embed_key    text,
  p_slot_start   timestamptz,
  p_first_name   text,
  p_last_name    text,
  p_partner_name text,
  p_email        text,
  p_phone        text,
  p_event_type   text,
  p_event_date   text,
  p_guest_count  integer,
  p_notes        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_lead_id      uuid;
  v_appt_id      uuid;
begin
  -- Validate key and enabled
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  -- Validate slot is still in the future + within notice window
  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  -- Double-check slot availability (race condition guard)
  select exists(
    select 1 from public.tour_appointments ta
    where ta.venue_id = v_venue.id
      and ta.status not in ('cancelled')
      and ta.scheduled_at < v_slot_end
      and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  -- Create lead
  insert into public.leads (
    venue_id, first_name, last_name, partner_first_name,
    email, phone, event_type, event_date, guest_count,
    status, source, source_data
  )
  values (
    v_venue.id, p_first_name, p_last_name, nullif(p_partner_name, ''),
    p_email, nullif(p_phone, ''), nullif(p_event_type, ''),
    nullif(p_event_date, '')::date, p_guest_count,
    'new', 'tour_scheduling', jsonb_build_object('booked_at', now(), 'slot', p_slot_start)
  )
  returning id into v_lead_id;

  -- Create tour appointment
  insert into public.tour_appointments (
    venue_id, lead_id, scheduled_at, duration_minutes, status,
    contact_name, contact_email, contact_phone,
    event_type, event_date, guest_count, notes
  )
  values (
    v_venue.id, v_lead_id, p_slot_start, v_venue.tour_duration_minutes, 'scheduled',
    trim(p_first_name || ' ' || p_last_name), p_email, p_phone,
    p_event_type, p_event_date, p_guest_count, p_notes
  )
  returning id into v_appt_id;

  return jsonb_build_object(
    'ok',          true,
    'leadId',      v_lead_id,
    'appointmentId', v_appt_id,
    'scheduledAt', p_slot_start,
    'venueName',   v_venue.name,
    'duration',    v_venue.tour_duration_minutes
  );
end;
$$;

grant execute on function public.get_tour_slots(text, date, date) to anon, authenticated;
grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text) to anon, authenticated;

-- ── Get venue info by tour embed key (for public page header) ────────────────
create or replace function public.get_venue_by_tour_key(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_venue public.venues%rowtype;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_key
    and tour_scheduling_enabled = true;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  return jsonb_build_object(
    'name',        v_venue.name,
    'headline',    coalesce(v_venue.tour_page_headline, 'Schedule a Tour'),
    'description', v_venue.tour_page_description,
    'duration',    v_venue.tour_duration_minutes
  );
end;
$$;

grant execute on function public.get_venue_by_tour_key(text) to anon, authenticated;

notify pgrst, 'reload schema';
