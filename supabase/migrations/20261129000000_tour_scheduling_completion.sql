-- ============================================================================
-- Tour Scheduling Completion — Sprint 3, Item 1.
--
-- Replaces "tour hours are inferred from the venue's one general
-- venue_business_hours row" with a real, tour-specific weekly recurring
-- schedule (multiple windows per day) plus date-range exceptions
-- (blocked dates / holidays / venue closures).
--
-- Also introduces one canonical closure/conflict check
-- (_is_tour_slot_blocked) used by every write path that used to duplicate
-- this logic independently and — found live while building this —
-- inconsistently: _generate_tour_slots only treated calendar_blocks rows
-- of type='blocked_time' as a closure, while book_tour's own write-time
-- re-check blocked on ANY calendar_blocks row regardless of type. A date
-- with e.g. a 'personal_appointment' calendar entry could show as
-- available in the public slot list and then fail at booking time with
-- "date_blocked" — the exact kind of two-implementations-can-drift bug
-- "one canonical availability calculation" exists to prevent.
--
-- Per the approved scope: a public tour must never be offered during
-- another scheduled tour, a booked event, a manually blocked calendar
-- placeholder (blocked_time, and the wedding_event_booking/private_event
-- "booked, no Lead yet" placeholders — a real gap found during
-- assessment, since those are invisible to the old slot generator despite
-- the double-booking-protection migration's own stated principle that a
-- manual venue closure means zero public availability), or a tour-
-- specific exception (this migration's new table). Purely personal/staff
-- calendar entries (consultation, client_meeting, tasting, etc.) are
-- deliberately NOT treated as venue-wide tour closures — one coordinator's
-- personal appointment isn't a reason to hide every tour slot from every
-- visitor.
-- ============================================================================

-- ---- 1. Weekly recurring availability ---------------------------------------

create table public.tour_availability_windows (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  day_of_week smallint not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tour_availability_windows_venue_day on public.tour_availability_windows (venue_id, day_of_week);

create trigger tour_availability_windows_updated_at
  before update on public.tour_availability_windows
  for each row execute function public.set_updated_at();

alter table public.tour_availability_windows enable row level security;

create policy tour_availability_windows_all on public.tour_availability_windows
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.tour_availability_windows to authenticated;

-- ---- 2. Exceptions: blocked dates, holidays, venue closures -----------------
--
-- Date-range shape (not a single date) so a multi-day closure is one row.
-- Whole-day-range closures only in this pass — no partial-day exceptions,
-- no recurring-annual holidays yet; the shape (a range + a label, no
-- baked-in weekly-recurrence assumption) supports adding either later
-- without a redesign.

create table public.tour_availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  start_date date not null,
  end_date   date not null check (end_date >= start_date),
  label      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tour_availability_exceptions_venue_range on public.tour_availability_exceptions (venue_id, start_date, end_date);

create trigger tour_availability_exceptions_updated_at
  before update on public.tour_availability_exceptions
  for each row execute function public.set_updated_at();

alter table public.tour_availability_exceptions enable row level security;

create policy tour_availability_exceptions_all on public.tour_availability_exceptions
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.tour_availability_exceptions to authenticated;

-- ---- 3. Backfill — every existing venue keeps working, unchanged, on deploy --
--
-- One window per currently-open day, copied straight from that venue's
-- current venue_business_hours. One-time backfill, not an ongoing sync —
-- after this, venue_business_hours and tour_availability_windows are
-- fully independent; editing one does not affect the other.

insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
select venue_id, day_of_week, open_time, close_time
from public.venue_business_hours
where is_open = true
  and open_time is not null
  and close_time is not null
  and close_time > open_time;

-- ---- 4. One canonical "is this slot blocked" check ---------------------------

create or replace function public._is_tour_slot_blocked(
  p_venue_id                uuid,
  p_slot_start              timestamptz,
  p_slot_end                timestamptz,
  p_exclude_appointment_id  uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocked boolean;
begin
  -- Another scheduled tour.
  select exists(
    select 1 from public.tour_appointments ta
    where ta.venue_id = p_venue_id
      and ta.status not in ('cancelled')
      and (p_exclude_appointment_id is null or ta.id != p_exclude_appointment_id)
      and ta.scheduled_at < p_slot_end
      and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start
  ) into v_blocked;
  if v_blocked then return true; end if;

  -- A booked event that day.
  select exists(
    select 1 from public.events e
    where e.venue_id = p_venue_id
      and e.event_date = p_slot_start::date
      and e.status not in ('cancelled')
  ) into v_blocked;
  if v_blocked then return true; end if;

  -- A manually blocked calendar placeholder — real closures
  -- (blocked_time) and "booked, no Lead/Event row yet" placeholders
  -- (wedding_event_booking, private_event). Deliberately not every
  -- calendar_blocks type: a coordinator's own personal_appointment/
  -- consultation/tasting/etc. entry isn't a venue-wide tour closure.
  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id = p_venue_id
      and cb.type in ('blocked_time', 'wedding_event_booking', 'private_event')
      and cb.start_date <= p_slot_start::date
      and cb.end_date   >= p_slot_start::date
  ) into v_blocked;
  if v_blocked then return true; end if;

  -- A tour-specific exception (blocked date, holiday, venue closure).
  select exists(
    select 1 from public.tour_availability_exceptions tae
    where tae.venue_id = p_venue_id
      and tae.start_date <= p_slot_start::date
      and tae.end_date   >= p_slot_start::date
  ) into v_blocked;
  return v_blocked;
end;
$$;

-- ---- 5. _generate_tour_slots — now reads tour_availability_windows ----------
--
-- Same name/signature as every existing caller expects (get_tour_slots,
-- get_coordinator_tour_slots) — no caller changes needed. Internals: step
-- through EACH configured window independently (this is how "multiple
-- windows per day" becomes multiple runs of slots with a gap between
-- them), and use the one canonical closure check above instead of
-- duplicating conflict logic inline.

create or replace function public._generate_tour_slots(
  p_venue_id                uuid,
  p_start_date               date,
  p_end_date                 date,
  p_exclude_appointment_id   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_slots        jsonb := '[]'::jsonb;
  v_cursor_date  date;
  v_dow          smallint;
  v_window       record;
  v_slot_start   timestamptz;
  v_slot_end     timestamptz;
  v_now          timestamptz := now();
  v_min_start    timestamptz;
  v_max_start    timestamptz;
  v_step         interval;
begin
  select * into v_venue from public.venues where id = p_venue_id;
  if not found then
    return jsonb_build_object('error', 'invalid_venue');
  end if;

  v_min_start := v_now + (v_venue.tour_min_notice_hours || ' hours')::interval;
  v_max_start := v_now + (v_venue.tour_max_advance_days || ' days')::interval;
  v_step      := ((v_venue.tour_duration_minutes + v_venue.tour_buffer_minutes) || ' minutes')::interval;

  if p_start_date::timestamptz < v_min_start then
    v_cursor_date := v_min_start::date;
  else
    v_cursor_date := p_start_date;
  end if;

  while v_cursor_date <= p_end_date
    and v_cursor_date::timestamptz <= v_max_start
  loop
    v_dow := extract(dow from v_cursor_date)::smallint;

    for v_window in
      select start_time, end_time
      from public.tour_availability_windows
      where venue_id = p_venue_id
        and day_of_week = v_dow
      order by sort_order, start_time
    loop
      v_slot_start := (v_cursor_date::text || ' ' || v_window.start_time::text || ' UTC')::timestamptz;

      while v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval
              <= (v_cursor_date::text || ' ' || v_window.end_time::text || ' UTC')::timestamptz
      loop
        v_slot_end := v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

        if v_slot_start >= v_min_start and v_slot_start <= v_max_start
           and not public._is_tour_slot_blocked(p_venue_id, v_slot_start, v_slot_end, p_exclude_appointment_id)
        then
          v_slots := v_slots || jsonb_build_object(
            'start', v_slot_start,
            'end',   v_slot_end,
            'date',  v_cursor_date,
            'time',  to_char(v_slot_start at time zone 'UTC', 'HH12:MI AM')
          );
        end if;

        v_slot_start := v_slot_start + v_step;
      end loop;
    end loop;

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

-- ---- 6. Write-time re-checks — now call the same canonical function ---------
--
-- book_tour previously blocked on ANY calendar_blocks row regardless of
-- type (a stricter, drifted-from-display check — found live while
-- building this). book_tour_for_lead/reschedule_tour previously only
-- checked type='blocked_time'. All three now call
-- _is_tour_slot_blocked(), so there is exactly one implementation of
-- "is this slot available," not three that could each drift differently.

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
  v_result       jsonb;
  v_lead_id      uuid;
  v_appt_id      uuid;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  if public._is_tour_slot_blocked(v_venue.id, p_slot_start, v_slot_end) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  v_result := public.ingest_lead(
    v_venue.id,
    'tour_scheduling',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'partnerFirstName', p_partner_name,
      'email', p_email, 'phone', p_phone,
      'eventType', p_event_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'sourceData', jsonb_build_object('booked_at', now(), 'slot', p_slot_start)
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  v_lead_id := (v_result ->> 'leadId')::uuid;

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
    'ok', true,
    'appointmentId', v_appt_id,
    'leadId', v_lead_id,
    'relationshipId', v_result ->> 'relationshipId',
    'scheduledAt', p_slot_start,
    'venueName', v_venue.name,
    'venueId', v_venue.id,
    'duration', v_venue.tour_duration_minutes,
    'contactName', trim(p_first_name || ' ' || p_last_name),
    'contactEmail', p_email,
    'contactPhone', p_phone
  );
end;
$$;

create or replace function public.book_tour_for_lead(
  p_lead_id     uuid,
  p_slot_start  timestamptz,
  p_notes       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id  uuid := public.current_user_venue_id();
  v_venue     public.venues%rowtype;
  v_lead      public.leads%rowtype;
  v_slot_end  timestamptz;
  v_appt_id   uuid;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_venue from public.venues where id = v_venue_id;
  select * into v_lead from public.leads where id = p_lead_id and venue_id = v_venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'lead_not_found');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  if public._is_tour_slot_blocked(v_venue_id, p_slot_start, v_slot_end) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  insert into public.tour_appointments (
    venue_id, lead_id, scheduled_at, duration_minutes, status,
    contact_name, contact_email, contact_phone,
    event_type, event_date, guest_count, notes
  )
  values (
    v_venue_id, p_lead_id, p_slot_start, v_venue.tour_duration_minutes, 'scheduled',
    trim(v_lead.first_name || ' ' || v_lead.last_name), v_lead.email, v_lead.phone,
    v_lead.event_type, v_lead.event_date::text, v_lead.guest_count, p_notes
  )
  returning id into v_appt_id;

  return jsonb_build_object(
    'ok', true,
    'appointmentId', v_appt_id,
    'leadId', p_lead_id,
    'relationshipId', v_lead.relationship_id,
    'scheduledAt', p_slot_start,
    'venueName', v_venue.name,
    'venueId', v_venue_id,
    'duration', v_venue.tour_duration_minutes,
    'contactName', trim(v_lead.first_name || ' ' || v_lead.last_name),
    'contactEmail', v_lead.email,
    'contactPhone', v_lead.phone
  );
end;
$$;

create or replace function public.reschedule_tour(
  p_appointment_id  uuid,
  p_new_slot_start  timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id   uuid := public.current_user_venue_id();
  v_venue      public.venues%rowtype;
  v_appt       public.tour_appointments%rowtype;
  v_slot_end   timestamptz;
  v_old_start  timestamptz;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_appt from public.tour_appointments where id = p_appointment_id and venue_id = v_venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_appt.status in ('cancelled', 'completed', 'no_show') then
    return jsonb_build_object('ok', false, 'error', 'not_reschedulable');
  end if;

  select * into v_venue from public.venues where id = v_venue_id;

  if p_new_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_new_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_new_slot_start + (v_appt.duration_minutes || ' minutes')::interval;

  if public._is_tour_slot_blocked(v_venue_id, p_new_slot_start, v_slot_end, p_appointment_id) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  v_old_start := v_appt.scheduled_at;

  update public.tour_appointments
    set scheduled_at = p_new_slot_start, status = 'scheduled', confirmed_at = null, updated_at = now()
    where id = p_appointment_id;

  return jsonb_build_object(
    'ok', true, 'appointmentId', p_appointment_id, 'leadId', v_appt.lead_id,
    'oldScheduledAt', v_old_start, 'scheduledAt', p_new_slot_start,
    'venueName', v_venue.name, 'venueId', v_venue_id, 'duration', v_appt.duration_minutes,
    'contactName', v_appt.contact_name, 'contactEmail', v_appt.contact_email, 'contactPhone', v_appt.contact_phone
  );
end;
$$;

notify pgrst, 'reload schema';
