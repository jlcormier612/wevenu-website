-- ============================================================================
-- Lead Acquisition & Intake — unified architecture (Work Stream A).
--
-- Replaces three independently-written lead-creation implementations
-- (create_public_lead, book_tour, create_lead_atomic) with thin, source-
-- specific wrappers around one shared core: ingest_lead(). Every current
-- and future source (website form, tour widget, manual entry, CSV import,
-- email-parsed leads, and later Facebook/Instagram/QR) funnels through the
-- same relationship-resolution, lead-creation, and activity-logging logic.
--
-- Two real, previously-drifted bugs fixed here:
--   1. find_or_create_relationship's no-email exact-name fallback existed
--      only as an inline, independently-written copy inside
--      create_lead_atomic — the shared function itself never had it. Now
--      it's fixed in the one shared function, and the inline copy is gone.
--   2. create_public_lead / book_tour used find_lead_by_email to silently
--      REUSE an existing lead — including a won/lost/cancelled one — for
--      any repeat inquiry by the same email. Product decision: Relationships
--      persist forever; Opportunities (Leads) never silently reopen. Every
--      new inquiry now always creates a new Lead, linked to the existing
--      Relationship when one resolves. find_lead_by_email is dropped —
--      leaving it in place would invite reintroducing the exact bug this
--      migration fixes.
-- ============================================================================

-- ── 1. Source registry — leads.source becomes a real, extensible vocabulary ───
-- A reference table, not a CHECK-constraint enum: a future integration adds
-- a row here (a migration, not a code change), and every field beyond
-- key/display_name exists for future use (routing, health-panel grouping,
-- disabling a source without losing history) even though only some are
-- read today.

create table public.lead_sources (
  key             text primary key,
  display_name    text not null,
  category        text not null check (category in ('direct','marketplace','social','referral','import','other')),
  connection_type text not null check (connection_type in ('form','manual_label','email_forward','webhook','api')),
  is_external     boolean not null default false,
  is_enabled      boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Read-only reference data from the API surface — only migrations (running
-- as the table owner) ever insert/update a row; every other write in this
-- migration happens through the SECURITY DEFINER functions below, which
-- read this table internally regardless of RLS.
alter table public.lead_sources enable row level security;

create policy lead_sources_read on public.lead_sources
  for select using (true);

grant select on public.lead_sources to anon, authenticated;

insert into public.lead_sources (key, display_name, category, connection_type, is_external) values
  ('website',             'Website Inquiry Form', 'direct',      'form',          false),
  ('tour_scheduling',     'Tour Request',         'direct',      'form',          false),
  ('referral',            'Referral',             'referral',    'manual_label',  false),
  ('the_knot',            'The Knot',             'marketplace', 'manual_label',  true),
  ('wedding_wire',        'WeddingWire',          'marketplace', 'manual_label',  true),
  ('instagram',           'Instagram',            'social',      'manual_label',  true),
  ('facebook',            'Facebook',             'social',      'manual_label',  true),
  ('google',              'Google',               'marketplace', 'manual_label',  true),
  ('email',               'Email',                'direct',      'manual_label',  false),
  ('phone',               'Phone',                'direct',      'manual_label',  false),
  ('walk_in',             'Walk-in',              'direct',      'manual_label',  false),
  ('other',               'Other',                'other',       'manual_label',  false),
  ('email_parsed_generic','Email (auto-detected)','direct',      'email_forward', true);

-- ── 2. leads.source enforcement + leads.intake_confidence ─────────────────────

alter table public.leads
  add column intake_confidence smallint
    check (intake_confidence is null or (intake_confidence >= 0 and intake_confidence <= 100));

-- Backfill any historical free-text values that aren't in the registry yet,
-- so the new constraint below doesn't reject existing rows.
insert into public.lead_sources (key, display_name, category, connection_type, is_external)
select distinct source, initcap(replace(source, '_', ' ')), 'other', 'manual_label', false
from public.leads
where source is not null
  and source not in (select key from public.lead_sources)
on conflict (key) do nothing;

alter table public.leads
  add constraint leads_source_fkey foreign key (source) references public.lead_sources(key);

-- ── 3. lead_intake_attempts — the audit trail, not just an abuse gate ──────────
-- Written first, before any business logic, for every attempt (including
-- rejected ones). This is what makes rate-limiting possible without new
-- infrastructure, what a future webhook source uses for idempotent retries
-- (external_ref), and what answers "what came in, from where, was it
-- accepted, why not, which lead/relationship, how long did it take, what
-- fired" — on its own, without joining anything else.

create table public.lead_intake_attempts (
  id                     uuid primary key default gen_random_uuid(),
  venue_id               uuid references public.venues(id) on delete set null,
  source                 text references public.lead_sources(key),
  trust_tier             text not null check (trust_tier in ('direct','webhook','email_parsed','import','manual')),
  raw_payload            jsonb,
  normalized_payload      jsonb,
  confidence_score       smallint check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  status                 text not null default 'received'
                           check (status in ('received','accepted','rejected_duplicate_batch',
                                              'rejected_rate_limited','rejected_invalid','error')),
  error_message          text,
  relationship_id        uuid references public.venue_customer_relationships(id) on delete set null,
  lead_id                uuid references public.leads(id) on delete set null,
  sequence_enrollment_id uuid references public.sequence_enrollments(id) on delete set null,
  notification_status    text check (notification_status is null or notification_status in ('sent','failed','skipped')),
  ip_address             text,
  external_ref           text,
  started_at             timestamptz not null default now(),
  completed_at           timestamptz,
  created_at             timestamptz not null default now()
);

create index lead_intake_attempts_venue on public.lead_intake_attempts (venue_id, created_at desc);
create index lead_intake_attempts_ip_venue on public.lead_intake_attempts (ip_address, venue_id, created_at desc)
  where ip_address is not null;
-- Idempotency lookup for future webhook sources (Meta Lead Ads etc.) —
-- retried deliveries carry the same external_ref and should be a no-op.
create unique index lead_intake_attempts_external_ref on public.lead_intake_attempts (source, external_ref)
  where external_ref is not null;

alter table public.lead_intake_attempts enable row level security;

-- Reads are venue-scoped (a coordinator only sees their own venue's intake
-- health). Writes are permissive by design: this is an append-mostly
-- operational log, written before a lead's legitimacy is even known (an
-- anon caller must be able to log a rejected/failed attempt too), and never
-- read back by anyone but the RPCs/service code that just wrote it and the
-- venue-scoped read policy above — a write-only client gains nothing from
-- being able to insert/update a row it can't itself read.
create policy lead_intake_attempts_venue_read on public.lead_intake_attempts
  for select using (venue_id = public.current_user_venue_id());

create policy lead_intake_attempts_insert on public.lead_intake_attempts
  for insert with check (true);

create policy lead_intake_attempts_update on public.lead_intake_attempts
  for update using (true) with check (true);

grant select, insert, update on public.lead_intake_attempts to anon, authenticated;

-- ── 4. find_or_create_relationship — the one, fixed, canonical resolver ───────

create or replace function public.find_or_create_relationship(
  p_venue_id   uuid,
  p_email      text,
  p_first_name text,
  p_last_name  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_email text := nullif(trim(p_email), '');
  v_first text := nullif(trim(p_first_name), '');
  v_last  text := nullif(trim(p_last_name), '');
begin
  if v_email is not null then
    select id into v_id
    from public.venue_customer_relationships
    where venue_id = p_venue_id and lower(email) = lower(v_email)
    limit 1;
  elsif v_first is not null and v_last is not null then
    -- No email given: fall back to an exact name match among other
    -- blank-email relationships only, so a re-submitted phone inquiry
    -- doesn't fork into a second customer identity. Never applied when an
    -- email is present — email stays the one real identity key. (Was
    -- previously only implemented inline inside create_lead_atomic; now
    -- the one shared resolver every caller goes through.)
    select id into v_id
    from public.venue_customer_relationships
    where venue_id = p_venue_id and email is null
      and lower(first_name) = lower(v_first) and lower(last_name) = lower(v_last)
    limit 1;
  end if;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (p_venue_id, v_email, v_first, v_last)
  returning id into v_id;

  return v_id;
end;
$$;

-- ── 5. ingest_lead — the one core RPC every source funnels through ────────────
-- Resolves the Relationship (via the shared resolver above) and always
-- creates a new Lead (Relationships persist; Opportunities don't). Activity
-- logging is handled generically by the existing leads_after_insert trigger
-- (log_lead_created) — no duplicate manual insert needed here.

create or replace function public.ingest_lead(
  p_venue_id uuid,
  p_source   text,
  p_input    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email           text := nullif(trim(p_input ->> 'email'), '');
  v_first           text := nullif(trim(p_input ->> 'firstName'), '');
  v_last            text := nullif(trim(p_input ->> 'lastName'), '');
  v_relationship_id uuid;
  v_was_existing    boolean;
  v_lead_id         uuid;
begin
  if p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_venue');
  end if;
  if v_first is null or v_last is null then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;
  if p_source is not null and not exists (
    select 1 from public.lead_sources where key = p_source and is_enabled
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  select exists(
    select 1 from public.venue_customer_relationships
    where venue_id = p_venue_id
      and (
        (v_email is not null and lower(email) = lower(v_email))
        or (v_email is null and email is null and lower(first_name) = lower(v_first) and lower(last_name) = lower(v_last))
      )
  ) into v_was_existing;

  v_relationship_id := public.find_or_create_relationship(p_venue_id, v_email, v_first, v_last);

  insert into public.leads (
    venue_id, status, source, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count, estimated_budget,
    inquiry_message, inquiry_date, source_data, relationship_id, intake_confidence
  ) values (
    p_venue_id, 'new', p_source, v_first, v_last,
    v_email, nullif(trim(p_input ->> 'phone'), ''),
    nullif(trim(p_input ->> 'partnerFirstName'), ''),
    nullif(trim(p_input ->> 'partnerLastName'), ''),
    nullif(trim(p_input ->> 'partnerEmail'), ''),
    nullif(p_input ->> 'eventType', ''),
    nullif(p_input ->> 'eventDate', '')::date,
    nullif(p_input ->> 'endDate', '')::date,
    nullif(regexp_replace(coalesce(p_input ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    nullif(regexp_replace(coalesce(p_input ->> 'estimatedBudget', ''), '[^0-9.]', '', 'g'), '')::numeric,
    nullif(trim(p_input ->> 'inquiryMessage'), ''),
    coalesce(nullif(p_input ->> 'inquiryDate', '')::date, current_date),
    coalesce(p_input -> 'sourceData', '{}'::jsonb),
    v_relationship_id,
    nullif(p_input ->> 'confidenceScore', '')::smallint
  )
  returning id into v_lead_id;

  return jsonb_build_object(
    'ok', true,
    'leadId', v_lead_id,
    'relationshipId', v_relationship_id,
    'isReturningRelationship', v_was_existing
  );
end;
$$;

grant execute on function public.ingest_lead(uuid, text, jsonb) to anon, authenticated;

-- ── 6. create_public_lead — thin wrapper: embed_key validation only ───────────

create or replace function public.create_public_lead(
  p_embed_key        text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_partner_first    text,
  p_partner_last     text,
  p_partner_email    text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_estimated_budget numeric,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_result   jsonb;
  v_ref      text;
begin
  select id into v_venue_id from public.venues where embed_key = p_embed_key;
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  v_result := public.ingest_lead(
    v_venue_id,
    'website',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'email', p_email, 'phone', p_phone,
      'partnerFirstName', p_partner_first, 'partnerLastName', p_partner_last, 'partnerEmail', p_partner_email,
      'eventType', p_event_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'estimatedBudget', case when p_estimated_budget > 0 then p_estimated_budget else null end,
      'inquiryMessage', p_message,
      'sourceData', coalesce(p_source_data, '{}'::jsonb) || jsonb_build_object('submitted_at', now())
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  v_ref := upper(left(replace((v_result ->> 'leadId'), '-', ''), 8));

  return jsonb_build_object('ok', true, 'lead_id', v_result ->> 'leadId', 'reference_code', v_ref);
end;
$$;

-- ── 7. book_tour — thin wrapper: slot validation + tour_appointments only ─────

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

  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id  = v_venue.id
      and cb.start_date <= p_slot_start::date
      and cb.end_date   >= p_slot_start::date
  ) into v_has_conflict;
  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'date_blocked');
  end if;

  select exists(
    select 1 from public.events e
    where e.venue_id   = v_venue.id
      and e.event_date = p_slot_start::date
      and e.status not in ('cancelled')
  ) into v_has_conflict;
  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'date_booked');
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
    'ok',            true,
    'leadId',        v_lead_id,
    'appointmentId', v_appt_id,
    'scheduledAt',   p_slot_start,
    'venueName',     v_venue.name,
    'duration',      v_venue.tour_duration_minutes
  );
end;
$$;

grant execute on function public.create_public_lead(text, text, text, text, text, text, text, text, text, date, integer, numeric, text, jsonb) to anon, authenticated;
grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text) to anon, authenticated;

-- ── 8. create_lead_atomic — thin wrapper: auth/venue resolution only ──────────
-- Same signature and return type as before (uuid) — no TS caller changes
-- needed. No longer reimplements relationship matching inline; calls the
-- one shared resolver via ingest_lead like every other source.

create or replace function public.create_lead_atomic(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_result   jsonb;
begin
  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if nullif(trim(payload ->> 'firstName'), '') is null or nullif(trim(payload ->> 'lastName'), '') is null then
    raise exception 'first and last name are required';
  end if;

  v_result := public.ingest_lead(v_venue_id, nullif(payload ->> 'source', ''), payload);

  if not (v_result ->> 'ok')::boolean then
    raise exception '%', v_result ->> 'error';
  end if;

  return (v_result ->> 'leadId')::uuid;
end;
$$;

grant execute on function public.create_lead_atomic(jsonb) to authenticated;

-- ── 9. Retire find_lead_by_email — the "reuse an existing lead" mechanism ─────
-- This function's only purpose was reactivating an existing lead by email
-- match, including won/lost/cancelled ones (the bug this migration fixes).
-- Dropped, not left dormant — its continued existence would invite
-- reintroducing the exact behavior just removed.

drop function if exists public.find_lead_by_email(uuid, text);

notify pgrst, 'reload schema';
