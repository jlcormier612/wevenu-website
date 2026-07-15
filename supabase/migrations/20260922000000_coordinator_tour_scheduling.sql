-- Coordinator Tour Scheduling — the last missing piece of the Sales
-- Operating System, per the Sales → Booking Journey walkthrough's one
-- Release Blocker: a coordinator had no way to schedule a tour for an
-- existing Lead. tour_appointments (the canonical tour-tracking table)
-- had exactly one write path, book_tour(), built entirely for the public
-- self-service widget — it always creates a brand-new Lead and has no
-- authenticated equivalent.
--
-- Guiding principle carried over unchanged: the scheduling engine
-- (business hours, conflict detection, tour_appointments) is the single
-- source of truth. Calendar remains a read-only consumer. This migration
-- adds coordinator-facing RPCs that reuse the exact same conflict-
-- detection logic the public widget already uses — refactored into one
-- shared internal function so there is only ever one implementation of
-- "is this slot available," not two that could drift apart.
--
-- Also fixes a real, found-while-building gap: get_tour_slots never
-- checked calendar_blocks for a manually-blocked "closed" date at all —
-- only tour_appointments and events. Folding that check into the shared
-- function fixes it for the public widget too, not just the new
-- coordinator path — otherwise "reuse venue closures" would just mean
-- reusing a check that doesn't actually happen yet.

-- ---- 1. RLS fix: tour_appointments predates the multi-staff model -----------
--
-- Written in Sprint 45, before current_user_venue_id() (Sprint 107) existed
-- — "owner_user_id = auth.uid()" means any coordinator who is not literally
-- the account owner is silently blocked from tour_appointments entirely.
-- Every other table touched by this migration already uses the modern
-- helper; this brings tour_appointments in line with it.

drop policy if exists "venue owner manages tour appointments" on public.tour_appointments;

create policy "venue staff manage tour appointments"
  on public.tour_appointments for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- ---- 2. cancellation_reason ---------------------------------------------------

alter table public.tour_appointments add column if not exists cancellation_reason text;

-- ---- 3. Shared slot-generation, closure-aware ---------------------------------

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
  v_bh           record;
  v_slot_start   timestamptz;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_is_closed    boolean;
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

    -- Venue closure — a manually-blocked date (maintenance, holiday,
    -- private event, etc.) takes the whole day off the table before even
    -- looking at business hours. Previously never checked at all.
    select exists(
      select 1 from public.calendar_blocks cb
      where cb.venue_id = p_venue_id
        and cb.type = 'blocked_time'
        and cb.start_date <= v_cursor_date
        and cb.end_date >= v_cursor_date
    ) into v_is_closed;

    if not v_is_closed then
      select * into v_bh
      from public.venue_business_hours
      where venue_id = p_venue_id
        and day_of_week = v_dow
        and is_open = true;

      if found then
        v_slot_start := (v_cursor_date::text || ' ' || v_bh.open_time::text || ' UTC')::timestamptz;

        while v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval
                <= (v_cursor_date::text || ' ' || v_bh.close_time::text || ' UTC')::timestamptz
        loop
          v_slot_end := v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

          if v_slot_start >= v_min_start and v_slot_start <= v_max_start then
            select exists(
              select 1 from public.tour_appointments ta
              where ta.venue_id = p_venue_id
                and ta.status not in ('cancelled')
                and (p_exclude_appointment_id is null or ta.id != p_exclude_appointment_id)
                and ta.scheduled_at < v_slot_end
                and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > v_slot_start
            ) into v_has_conflict;

            if not v_has_conflict then
              select exists(
                select 1 from public.events e
                where e.venue_id = p_venue_id
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

-- get_tour_slots (public widget) now delegates to the shared function —
-- same signature, same behavior, now closure-aware too.
create or replace function public.get_tour_slots(
  p_embed_key text,
  p_start_date date,
  p_end_date   date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if v_venue_id is null then
    return jsonb_build_object('error', 'invalid_key');
  end if;
  return public._generate_tour_slots(v_venue_id, p_start_date, p_end_date);
end;
$$;

-- ---- 4. Coordinator (authenticated) slot lookup --------------------------------
-- Deliberately NOT gated on tour_scheduling_enabled — that flag controls
-- whether the *public* self-service page is live, a separate question
-- from whether a signed-in coordinator can schedule a tour for a Lead
-- they're already talking to. Every venue has sensible defaults for
-- duration/notice/buffer from the column defaults set in Sprint 45.

create or replace function public.get_coordinator_tour_slots(
  p_start_date date,
  p_end_date   date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  return public._generate_tour_slots(v_venue_id, p_start_date, p_end_date);
end;
$$;

grant execute on function public.get_coordinator_tour_slots(date, date) to authenticated;

-- ---- 5. Schedule a tour for an existing Lead ------------------------------------
-- The coordinator equivalent of book_tour() — same conflict/notice/advance
-- validation, but resolves an existing Lead instead of creating one, and
-- populates contact fields from that Lead rather than a submitted form.

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
  v_venue_id     uuid := public.current_user_venue_id();
  v_venue        public.venues%rowtype;
  v_lead         public.leads%rowtype;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_appt_id      uuid;
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

  select exists(
    select 1 from public.tour_appointments ta
    where ta.venue_id = v_venue_id
      and ta.status not in ('cancelled')
      and ta.scheduled_at < v_slot_end
      and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start
  ) into v_has_conflict;
  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id = v_venue_id
      and cb.type = 'blocked_time'
      and cb.start_date <= p_slot_start::date
      and cb.end_date >= p_slot_start::date
  ) into v_has_conflict;
  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'venue_closed');
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

grant execute on function public.book_tour_for_lead(uuid, timestamptz, text) to authenticated;

-- ---- 6. Reschedule — same row, no delete/recreate -------------------------------

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
  v_venue_id     uuid := public.current_user_venue_id();
  v_venue        public.venues%rowtype;
  v_appt         public.tour_appointments%rowtype;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_old_start    timestamptz;
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

  select exists(
    select 1 from public.tour_appointments ta
    where ta.venue_id = v_venue_id
      and ta.id != p_appointment_id
      and ta.status not in ('cancelled')
      and ta.scheduled_at < v_slot_end
      and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_new_slot_start
  ) into v_has_conflict;
  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id = v_venue_id
      and cb.type = 'blocked_time'
      and cb.start_date <= p_new_slot_start::date
      and cb.end_date >= p_new_slot_start::date
  ) into v_has_conflict;
  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'venue_closed');
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

grant execute on function public.reschedule_tour(uuid, timestamptz) to authenticated;

-- ---- 7. Confirm / Complete / No-show / Cancel — already built, reused as-is -----
--
-- Found while building this, not assumed: PATCH /api/tours/status already
-- handles all five statuses, including cancellation, and already carries
-- real side effects this migration must not duplicate or race against —
-- runPostTourAutomation() and lead_signal_events tracking on
-- completed/no_show/cancelled, and cancelling pending task_reminders on
-- cancel/no_show. The Tours page's own status dropdown already calls it.
-- No new RPC needed here — cancellation_reason (added above) is read and
-- written directly by that route (see app/api/tours/status/route.ts),
-- extended in this pass to accept it, not reimplemented.

-- ---- 8. Notification — a tour was scheduled (any staff member, not just the one who booked it) --

create or replace function public._trigger_tour_scheduled_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'scheduled' and NEW.lead_id is not null then
    perform public.create_venue_notification(
      NEW.venue_id,
      null,
      'tour_scheduled',
      'Tour scheduled' || case when NEW.contact_name is not null then ' with ' || NEW.contact_name else '' end,
      to_char(NEW.scheduled_at at time zone 'UTC', 'Mon DD, YYYY "at" HH12:MI AM'),
      '/leads/' || NEW.lead_id::text,
      '🗓️'
    );
  end if;
  return NEW;
exception when others then
  raise warning '_trigger_tour_scheduled_notification failed for appointment %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_tour_scheduled on public.tour_appointments;
create trigger notify_tour_scheduled
  after insert on public.tour_appointments
  for each row execute function public._trigger_tour_scheduled_notification();

notify pgrst, 'reload schema';
