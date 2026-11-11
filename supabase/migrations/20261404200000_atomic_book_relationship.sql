-- Atomic Booked transition and client-scoped planning.
--
-- One function, one transaction:
--   lock the client, validate, insert or restore the Booked Event
--   (the events_enforce_availability trigger takes the venue/date
--   advisory lock and applies the canonical availability rules inside
--   this same transaction), move the relationship to Booked, stamp
--   the historical booked timestamps, attach pre-booking planning rows,
--   then commit. Any failure rolls the whole transaction back.
--   Nothing in this function cancels an event to compensate.
--
-- Create Event audit:
--   The only UI is /events/new. With a client, that action is the
--   venue's Booked decision and must call this function. Without a
--   client it must not insert an occupying event. There is no third
--   booking pathway. Commercial milestone code does not call this.
--
-- Canonical Booked writers (all call book_relationship):
--   confirmPipelineBookedMove, returnLeadToBooked, returnClientToBooked,
--   explicit already-booked import, and Create Event when a client is chosen.
--
-- Planning ownership (do not null every event_id):
--   A client-scoped before Booked, edited from the client workspace, attached here without duplicating:
--     event_tasks, event_playbook_applications, timeline_entries,
--     timeline_sections, floor_plans, event_orders, event_vendor_assignments.
--     guest_seat_assignments have no event_id; they follow the floor plan.
--   Sharing a floor plan with the couple, marking it operational, and vendor
--   "selected for an event" notices wait until this attachment, because those
--   describe the booked occasion.
--   B the Event row and date occupancy. Created only by this decision.
--   C unavailable until Booked, because they describe the booked occasion:
--     event_questionnaires (final details),
--     timeline_submissions (the commitment snapshot),
--     couple_seating_arrangements (retired; seating is the floor plan).

-- ---- A. Client ownership for pre-booking planning ---------------------------

alter table public.event_tasks
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.event_tasks alter column event_id drop not null;
alter table public.event_tasks drop constraint if exists event_tasks_owner_check;
alter table public.event_tasks
  add constraint event_tasks_owner_check
  check (event_id is not null or client_id is not null);
update public.event_tasks t
  set client_id = e.client_id
  from public.events e
  where t.event_id = e.id and t.client_id is null and e.client_id is not null;
create index if not exists event_tasks_client_unbooked
  on public.event_tasks (venue_id, client_id) where event_id is null;

alter table public.event_playbook_applications
  add column if not exists id uuid default gen_random_uuid();
update public.event_playbook_applications set id = gen_random_uuid() where id is null;
alter table public.event_playbook_applications alter column id set not null;
alter table public.event_playbook_applications drop constraint if exists event_playbook_applications_pkey;
alter table public.event_playbook_applications
  add constraint event_playbook_applications_pkey primary key (id);
alter table public.event_playbook_applications alter column event_id drop not null;
alter table public.event_playbook_applications
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.event_playbook_applications drop constraint if exists event_playbook_applications_owner_check;
alter table public.event_playbook_applications
  add constraint event_playbook_applications_owner_check
  check (event_id is not null or client_id is not null);
update public.event_playbook_applications a
  set client_id = e.client_id
  from public.events e
  where a.event_id = e.id and a.client_id is null and e.client_id is not null;
create unique index if not exists event_playbook_applications_event_kind
  on public.event_playbook_applications (event_id, kind) where event_id is not null;
create unique index if not exists event_playbook_applications_client_kind_unbooked
  on public.event_playbook_applications (client_id, kind) where event_id is null and client_id is not null;

alter table public.timeline_entries
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.timeline_entries alter column event_id drop not null;
alter table public.timeline_entries drop constraint if exists timeline_entries_owner_check;
alter table public.timeline_entries
  add constraint timeline_entries_owner_check
  check (event_id is not null or client_id is not null);
update public.timeline_entries t
  set client_id = e.client_id
  from public.events e
  where t.event_id = e.id and t.client_id is null and e.client_id is not null;

alter table public.timeline_sections
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.timeline_sections alter column event_id drop not null;
alter table public.timeline_sections drop constraint if exists timeline_sections_owner_check;
alter table public.timeline_sections
  add constraint timeline_sections_owner_check
  check (event_id is not null or client_id is not null);
update public.timeline_sections t
  set client_id = e.client_id
  from public.events e
  where t.event_id = e.id and t.client_id is null and e.client_id is not null;

alter table public.floor_plans
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.floor_plans alter column event_id drop not null;
alter table public.floor_plans drop constraint if exists floor_plans_owner_check;
alter table public.floor_plans
  add constraint floor_plans_owner_check
  check (event_id is not null or client_id is not null);
update public.floor_plans t
  set client_id = e.client_id
  from public.events e
  where t.event_id = e.id and t.client_id is null and e.client_id is not null;

alter table public.event_orders
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.event_orders alter column event_id drop not null;
alter table public.event_orders drop constraint if exists event_orders_owner_check;
alter table public.event_orders
  add constraint event_orders_owner_check
  check (event_id is not null or client_id is not null);
update public.event_orders t
  set client_id = e.client_id
  from public.events e
  where t.event_id = e.id and t.client_id is null and e.client_id is not null;
create unique index if not exists event_orders_client_unbooked
  on public.event_orders (client_id) where event_id is null and client_id is not null;

alter table public.event_vendor_assignments
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
alter table public.event_vendor_assignments alter column event_id drop not null;
alter table public.event_vendor_assignments drop constraint if exists event_vendor_assignments_owner_check;
alter table public.event_vendor_assignments
  add constraint event_vendor_assignments_owner_check
  check (event_id is not null or client_id is not null);
update public.event_vendor_assignments t
  set client_id = e.client_id
  from public.events e
  where t.event_id = e.id and t.client_id is null and e.client_id is not null;
drop index if exists public.eva_event_vendor;
create unique index if not exists eva_event_vendor
  on public.event_vendor_assignments (event_id, vendor_id) where event_id is not null;
create unique index if not exists eva_client_vendor_unbooked
  on public.event_vendor_assignments (client_id, vendor_id) where event_id is null and client_id is not null;

-- ---- B. The Booked transaction ----------------------------------------------

create or replace function public.book_relationship(
  p_venue_id uuid,
  p_client_id uuid,
  p_space_id uuid default null,
  p_pipeline_stage_id uuid default null,
  p_name text default null,
  p_event_type text default null,
  p_event_date date default null,
  p_event_end_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_setup_time time default null,
  p_teardown_time time default null,
  p_guest_count integer default null,
  p_lifecycle_origin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_lead_id uuid;
  v_previous_stage text;
  v_event_id uuid;
  v_existing_booked_at date;
  v_existing_date date;
  v_event_date date;
  v_event_end date;
  v_name text;
  v_primary text;
  v_partner text;
  v_newly boolean := false;
  v_origin text;
  v_booked_on date;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  select * into v_client
  from public.clients
  where id = p_client_id and venue_id = p_venue_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Client not found.');
  end if;

  v_lead_id := v_client.lead_id;
  if v_lead_id is not null then
    select sales_stage into v_previous_stage
    from public.leads
    where id = v_lead_id and venue_id = p_venue_id
    for update;
  end if;

  select e.id, e.booked_at, e.event_date
    into v_event_id, v_existing_booked_at, v_existing_date
  from public.events e
  where e.venue_id = p_venue_id
    and e.client_id = p_client_id
    and e.status <> 'cancelled'
  order by (e.booked_at is null), e.created_at
  limit 1
  for update;

  v_event_date := coalesce(p_event_date, v_client.event_date);
  if v_event_id is not null and v_existing_booked_at is not null
     and p_event_date is not null and p_event_date is distinct from v_existing_date then
    return jsonb_build_object(
      'ok', false,
      'message', 'This relationship is already Booked.'
    );
  end if;

  -- A brand-new event needs a date. Restoring a cancelled event can keep its own date.
  if v_event_id is not null and v_existing_booked_at is null and v_event_date is null then
    return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
  end if;

  v_primary := trim(both ' ' from concat_ws(' ', v_client.first_name, v_client.last_name));
  v_partner := trim(both ' ' from concat_ws(' ', nullif(v_client.partner_first_name, ''), nullif(v_client.partner_last_name, '')));
  v_name := case
    when p_name is not null and length(trim(p_name)) > 0 then trim(p_name)
    when v_partner <> '' then v_primary || ' & ' || v_partner
    else v_primary
  end;
  if v_name is null or v_name = '' then
    v_name := 'Event';
  end if;
  v_event_end := coalesce(p_event_end_date, v_client.end_date);
  if v_event_end is not distinct from v_event_date then
    v_event_end := null;
  end if;
  v_booked_on := (timezone(public._venue_scheduling_timezone(p_venue_id), now()))::date;
  v_origin := coalesce(
    p_lifecycle_origin,
    case when v_lead_id is not null then 'pipeline' else 'direct' end
  );

  if v_event_id is not null and v_existing_booked_at is not null then
    v_newly := false;
  elsif v_event_id is not null and v_existing_booked_at is null then
    update public.events
      set status = 'confirmed',
          booked_at = v_booked_on,
          name = v_name,
          event_type = coalesce(nullif(p_event_type, ''), v_client.event_type),
          event_date = v_event_date,
          event_end_date = v_event_end,
          start_time = coalesce(p_start_time, v_client.ceremony_time, start_time),
          end_time = coalesce(p_end_time, v_client.reception_time, end_time),
          setup_time = coalesce(p_setup_time, setup_time),
          teardown_time = coalesce(p_teardown_time, teardown_time),
          guest_count = coalesce(p_guest_count, v_client.guest_count),
          space_id = coalesce(p_space_id, space_id),
          booking_celebration_pending = true
    where id = v_event_id and venue_id = p_venue_id;
    v_newly := true;
  else
    select e.id into v_event_id
    from public.events e
    where e.venue_id = p_venue_id
      and e.client_id = p_client_id
      and e.status = 'cancelled'
      and e.booked_at is not null
    order by e.created_at desc
    limit 1
    for update;

    if v_event_id is not null then
      if v_event_date is null then
        select event_date into v_event_date from public.events where id = v_event_id;
      end if;
      update public.events
        set status = 'confirmed',
            name = coalesce(nullif(trim(p_name), ''), name),
            event_type = coalesce(nullif(p_event_type, ''), event_type),
            event_date = coalesce(p_event_date, event_date),
            event_end_date = coalesce(p_event_end_date, event_end_date),
            start_time = coalesce(p_start_time, start_time),
            end_time = coalesce(p_end_time, end_time),
            setup_time = coalesce(p_setup_time, setup_time),
            teardown_time = coalesce(p_teardown_time, teardown_time),
            guest_count = coalesce(p_guest_count, guest_count),
            space_id = coalesce(p_space_id, space_id)
      where id = v_event_id and venue_id = p_venue_id;
      v_newly := false;
    else
      if v_event_date is null then
        return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
      end if;
      insert into public.events (
        venue_id, client_id, space_id, status, name, event_type,
        event_date, event_end_date, start_time, end_time, setup_time, teardown_time,
        guest_count, booked_at, booking_celebration_pending
      ) values (
        p_venue_id, p_client_id, p_space_id, 'confirmed', v_name,
        coalesce(nullif(p_event_type, ''), v_client.event_type),
        v_event_date, v_event_end,
        coalesce(p_start_time, v_client.ceremony_time),
        coalesce(p_end_time, v_client.reception_time),
        p_setup_time, p_teardown_time,
        coalesce(p_guest_count, v_client.guest_count),
        v_booked_on, true
      )
      returning id into v_event_id;
      v_newly := true;
    end if;
  end if;

  update public.clients
    set status = 'confirmed',
        lifecycle_booked_at = coalesce(lifecycle_booked_at, now()),
        lifecycle_booking_origin = coalesce(lifecycle_booking_origin, v_origin)
  where id = p_client_id and venue_id = p_venue_id;
  if not found then
    raise exception 'Client not found.';
  end if;

  if v_lead_id is not null then
    update public.leads
      set sales_stage = 'booked',
          pipeline_stage_id = coalesce(p_pipeline_stage_id, pipeline_stage_id),
          lost_reason = null,
          lost_reason_detail = null,
          lost_at = null,
          first_booked_at = coalesce(first_booked_at, now())
    where id = v_lead_id and venue_id = p_venue_id;
    if not found then
      raise exception 'Lead not found for this client.';
    end if;
  end if;

  -- Attach existing preparation. Do not insert a second copy.
  update public.event_tasks
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.event_playbook_applications a
    set event_id = v_event_id
  where a.venue_id = p_venue_id and a.client_id = p_client_id and a.event_id is null
    and not exists (
      select 1 from public.event_playbook_applications x
      where x.event_id = v_event_id and x.kind = a.kind
    );

  update public.timeline_sections
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.timeline_entries
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.floor_plans
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.event_orders o
    set event_id = v_event_id
  where o.venue_id = p_venue_id and o.client_id = p_client_id and o.event_id is null
    and not exists (
      select 1 from public.event_orders x where x.event_id = v_event_id
    );

  update public.event_vendor_assignments a
    set event_id = v_event_id
  where a.venue_id = p_venue_id and a.client_id = p_client_id and a.event_id is null
    and not exists (
      select 1 from public.event_vendor_assignments x
      where x.event_id = v_event_id and x.vendor_id = a.vendor_id
    );

  return jsonb_build_object(
    'ok', true,
    'newly_booked', v_newly,
    'event_id', v_event_id,
    'client_id', p_client_id,
    'lead_id', v_lead_id,
    'previous_sales_stage', v_previous_stage
  );
end;
$$;

revoke all on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text) from public;
grant execute on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text) to authenticated, service_role;

comment on function public.book_relationship is
  'The only Booked transition. One transaction: lock, availability via the event trigger, create or restore the Event, move the relationship to Booked, stamp booked timestamps, attach pre-booking planning. Rolls back entirely on failure.';

-- A vendor assigned during preparation is not told an event is booked.
-- The existing insert trigger notifies only once the assignment has an event.
create or replace function public._trigger_vendor_assigned_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_name  text;
  v_venue_name  text;
  v_couple      text;
begin
  if NEW.event_id is null then
    return NEW;
  end if;

  select e.name,
         v.name,
         case
           when c.partner_first_name is not null and c.partner_first_name <> ''
             then c.first_name || ' & ' || c.partner_first_name
           else nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')
         end
  into v_event_name, v_venue_name, v_couple
  from public.events e
  join public.venues v on v.id = e.venue_id
  left join public.clients c on c.id = e.client_id
  where e.id = NEW.event_id;

  perform public.create_vendor_notification(
    NEW.vendor_id,
    NEW.event_id,
    NEW.id,
    'assigned_to_event',
    'You''ve been selected for an event',
    coalesce(v_couple, v_event_name, 'Upcoming event')
      || coalesce(' · ' || v_venue_name, ''),
    '/vendor/events/' || NEW.id::text,
    '🎉'
  );

  return NEW;
exception when others then
  raise warning '_trigger_vendor_assigned_notification failed for assignment %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_vendor_assigned_on_book on public.event_vendor_assignments;
create trigger notify_vendor_assigned_on_book
  after update of event_id on public.event_vendor_assignments
  for each row
  when (OLD.event_id is null and NEW.event_id is not null)
  execute function public._trigger_vendor_assigned_notification();

notify pgrst, 'reload schema';
