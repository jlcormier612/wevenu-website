-- ============================================================================
-- Migration Center — Historical Import Mode (docs/migration-cutover-
-- architecture.md §B, "quiet/historical commit mode").
--
-- A migrated record needs to retain enough information to understand
-- whether it was historical/backfilled data, and that same signal is what
-- suppresses the one DB-trigger-level customer/venue-facing side effect a
-- TS-layer option alone can't reach: the notify_new_lead trigger's "New
-- inquiry from X" venue notification fires unconditionally on INSERT,
-- regardless of what the calling TypeScript code intended.
--
-- One persisted column serves both jobs at once: a permanent provenance
-- marker ("was this backfilled") and the trigger's own source of truth for
-- whether to suppress the notification — deliberately not a transient
-- session-local flag, which would be fragile under pooled connections.
--
-- The other two customer-facing side effects for historical imports
-- (portal-invite email, message-sequence automation enrollment) are
-- TS-layer only (lib/clients/service.ts, lib/lead-intake/pipeline.ts) and
-- don't need a DB change — handled in the same application-layer change
-- that threads `isHistoricalImport` into these RPCs' payload.
-- ============================================================================

alter table public.leads
  add column if not exists is_historical_import boolean not null default false;
alter table public.clients
  add column if not exists is_historical_import boolean not null default false;

comment on column public.leads.is_historical_import is
  'True for a Lead created by Migration Center as backfilled historical data, not a real new inquiry. Suppresses the notify_new_lead venue notification (see the trigger below) and is set only via ingest_lead()''s p_input.isHistoricalImport key.';
comment on column public.clients.is_historical_import is
  'True for a Client created by Migration Center as backfilled historical data. Provenance only here (Clients have no "new client" notification to suppress) — kept symmetric with leads.is_historical_import for one consistent migration-provenance signal across entities.';

create index if not exists leads_is_historical_import on public.leads (venue_id) where is_historical_import;
create index if not exists clients_is_historical_import on public.clients (venue_id) where is_historical_import;


-- ── ingest_lead — same signature, reads one more key from p_input ─────────

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
  v_email               text := nullif(trim(p_input ->> 'email'), '');
  v_first               text := nullif(trim(p_input ->> 'firstName'), '');
  v_last                text := nullif(trim(p_input ->> 'lastName'), '');
  v_relationship_id     uuid;
  v_was_existing        boolean;
  v_lead_id             uuid;
  v_is_historical       boolean := coalesce((p_input ->> 'isHistoricalImport')::boolean, false);
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
    inquiry_message, inquiry_date, source_data, relationship_id, intake_confidence,
    is_historical_import
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
    nullif(p_input ->> 'confidenceScore', '')::smallint,
    v_is_historical
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
grant execute on function public.ingest_lead(uuid, text, jsonb) to service_role;


-- ── create_client_atomic — same signature, reads one more key from payload ─

create or replace function public.create_client_atomic(payload jsonb, p_venue_id_override uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id     uuid;
  v_lead_id      uuid := nullif(payload ->> 'leadId', '')::uuid;
  v_email        text := nullif(trim(payload ->> 'email'), '');
  v_first        text := trim(payload ->> 'firstName');
  v_last         text := trim(payload ->> 'lastName');
  v_rel_id       uuid;
  v_client_id    uuid;
  v_is_historical boolean := coalesce((payload ->> 'isHistoricalImport')::boolean, false);
begin
  v_venue_id := case
    when p_venue_id_override is not null and auth.role() = 'service_role' then p_venue_id_override
    else public.current_user_venue_id()
  end;

  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'first and last name are required';
  end if;

  if v_lead_id is not null then
    select relationship_id into v_rel_id
    from public.leads
    where id = v_lead_id and venue_id = v_venue_id;
  end if;

  if v_rel_id is null and v_email is not null then
    select id into v_rel_id
    from public.venue_customer_relationships
    where venue_id = v_venue_id and lower(email) = lower(v_email)
    limit 1;
  elsif v_rel_id is null then
    select id into v_rel_id
    from public.venue_customer_relationships
    where venue_id = v_venue_id and email is null
      and lower(first_name) = lower(v_first)
      and lower(last_name)  = lower(v_last)
    limit 1;
  end if;

  if v_rel_id is null then
    insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
    values (v_venue_id, v_email, v_first, v_last)
    returning id into v_rel_id;
  end if;

  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count,
    ceremony_time, reception_time, rehearsal_date, internal_notes,
    relationship_id, is_historical_import
  ) values (
    v_venue_id, v_lead_id,
    v_first, v_last,
    v_email,
    nullif(trim(payload ->> 'phone'), ''),
    nullif(trim(payload ->> 'partnerFirstName'), ''),
    nullif(trim(payload ->> 'partnerLastName'), ''),
    nullif(trim(payload ->> 'partnerEmail'), ''),
    nullif(payload ->> 'eventType', ''),
    nullif(payload ->> 'eventDate', '')::date,
    nullif(payload ->> 'endDate', '')::date,
    nullif(regexp_replace(coalesce(payload ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    nullif(payload ->> 'ceremonyTime', '')::time,
    nullif(payload ->> 'receptionTime', '')::time,
    nullif(payload ->> 'rehearsalDate', '')::date,
    nullif(trim(payload ->> 'internalNotes'), ''),
    v_rel_id,
    v_is_historical
  )
  returning id into v_client_id;

  return v_client_id;
end;
$$;

grant execute on function public.create_client_atomic(jsonb, uuid) to authenticated;
grant execute on function public.create_client_atomic(jsonb, uuid) to service_role;


-- ── notify_new_lead trigger — suppress for historical imports ──────────────

create or replace function public._trigger_new_lead_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_historical_import then
    return NEW;
  end if;

  perform public.create_venue_notification(
    NEW.venue_id,
    null,
    'new_lead',
    'New inquiry from ' || NEW.first_name || coalesce(' ' || NEW.last_name, ''),
    coalesce(NEW.event_type, 'Event inquiry')
      || case when NEW.event_date is not null
              then ' · ' || to_char(NEW.event_date, 'Mon DD, YYYY')
              else '' end,
    '/leads/' || NEW.id::text,
    '✨'
  );
  return NEW;
end;
$$;

notify pgrst, 'reload schema';
