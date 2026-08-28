-- ============================================================================
-- Authoritative Sales Pipeline (seven fixed stages).
--
-- - leads.sales_stage is the single lifecycle truth for sales.
-- - leads.status is deprecated (nullable, no longer written by app/RPCs).
-- - Standard Sales Pipeline is provisioned for library identification only;
--   live Board/List use the fixed seven stages, not pipeline_templates.
-- - message_sequences.trigger_stage uses sales_stage keys.
-- - update_pipeline_on_enroll defaults false (including backfill).
-- ============================================================================

-- ---- 1. sales_stage on leads ------------------------------------------------

alter table public.leads
  add column if not exists sales_stage text;

update public.leads l
set sales_stage = case
  when l.status = 'new' then 'new_inquiry'
  when l.status = 'contacted' then 'outreach_sent'
  when l.status = 'qualified' and exists (
    select 1 from public.tour_appointments ta
    where ta.lead_id = l.id
      and ta.venue_id = l.venue_id
      and ta.status not in ('cancelled')
  ) then 'tour_scheduled'
  when l.status = 'qualified' then 'outreach_sent'
  when l.status = 'proposal_sent' then 'proposal_sent'
  when l.status = 'won' then 'booked'
  when l.status in ('lost', 'cancelled') then 'lost'
  else 'new_inquiry'
end
where l.sales_stage is null;

alter table public.leads
  alter column sales_stage set default 'new_inquiry';

update public.leads set sales_stage = 'new_inquiry' where sales_stage is null;

alter table public.leads
  alter column sales_stage set not null;

alter table public.leads
  drop constraint if exists leads_sales_stage_check;

alter table public.leads
  add constraint leads_sales_stage_check
  check (sales_stage in (
    'new_inquiry',
    'outreach_sent',
    'enrolled_in_sequence',
    'tour_scheduled',
    'proposal_sent',
    'booked',
    'lost'
  ));

create index if not exists leads_venue_sales_stage
  on public.leads (venue_id, sales_stage);

-- Deprecate leads.status as a competing lifecycle field (keep column for rollback window).
alter table public.leads alter column status drop not null;
alter table public.leads alter column status drop default;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'leads_status_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads drop constraint leads_status_check;
  end if;
exception when others then
  -- inline check constraints from create-table may be named differently
  null;
end $$;

-- Drop anonymous check on status if present (foundation migration used inline check).
alter table public.leads drop constraint if exists leads_status_check;

comment on column public.leads.sales_stage is
  'Authoritative Sales Pipeline stage. Fixed vocabulary of seven stages.';
comment on column public.leads.status is
  'DEPRECATED — historical lifecycle field. Do not write. Use sales_stage.';

-- ---- 2. Sequence: update pipeline on enroll (default OFF) -------------------

alter table public.message_sequences
  add column if not exists update_pipeline_on_enroll boolean not null default false;

update public.message_sequences
set update_pipeline_on_enroll = false
where update_pipeline_on_enroll is distinct from false;

comment on column public.message_sequences.update_pipeline_on_enroll is
  'When true, successful enrollment may move the lead to enrolled_in_sequence (forward-only). Defaults false.';

-- Retarget trigger_stage check to sales_stage keys.
alter table public.message_sequences
  drop constraint if exists message_sequences_trigger_stage_check;

alter table public.message_sequences
  add constraint message_sequences_trigger_stage_check
  check (
    trigger_stage is null
    or trigger_stage in (
      'new_inquiry',
      'outreach_sent',
      'enrolled_in_sequence',
      'tour_scheduled',
      'proposal_sent',
      'booked',
      'lost'
    )
  );

-- Migrate existing trigger_stage values from LeadStatus → sales_stage keys.
update public.message_sequences
set trigger_stage = case trigger_stage
  when 'new' then 'new_inquiry'
  when 'contacted' then 'outreach_sent'
  when 'qualified' then 'tour_scheduled'
  when 'proposal_sent' then 'proposal_sent'
  when 'won' then 'booked'
  when 'lost' then 'lost'
  when 'cancelled' then 'lost'
  else trigger_stage
end
where trigger_stage is not null;

-- ---- 3. ingest_lead writes sales_stage only (not status) --------------------

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
  -- Preserved from 20261301000000_historical_import_quiet_mode.sql — that
  -- feature shipped after this branch's original ingest_lead was written and
  -- must not regress when this migration reconciles onto current main.
  v_is_historical   boolean := coalesce((p_input ->> 'isHistoricalImport')::boolean, false);
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
    venue_id, sales_stage, source, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count, estimated_budget,
    inquiry_message, inquiry_date, source_data, relationship_id, intake_confidence,
    is_historical_import
  ) values (
    p_venue_id, 'new_inquiry', p_source, v_first, v_last,
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

-- ---- 4. Standard Sales Pipeline provisioning (library identity only) --------

create or replace function public.ensure_standard_sales_pipeline(p_venue_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_existing uuid;
begin
  select id into v_existing
  from public.pipeline_templates
  where venue_id = p_venue_id
    and name = 'Standard Sales Pipeline'
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Only auto-create when the venue has no pipeline templates at all.
  if exists (select 1 from public.pipeline_templates where venue_id = p_venue_id) then
    return null;
  end if;

  insert into public.pipeline_templates (venue_id, name, description, is_active)
  values (
    p_venue_id,
    'Standard Sales Pipeline',
    'Default venue sales pipeline. Live Board and List use these seven stages directly; this template is the starter/library record.',
    true
  )
  returning id into v_template_id;

  insert into public.pipeline_stages (
    venue_id, pipeline_template_id, name, color, sort_order, canonical_stage, probability
  ) values
    (p_venue_id, v_template_id, 'New Inquiry', '#5D6F5D', 0, 'inquiry', 10),
    (p_venue_id, v_template_id, 'Outreach Sent', '#6B7F6B', 1, 'inquiry', 20),
    (p_venue_id, v_template_id, 'Enrolled in Sequence/Workflow', '#7A8F7A', 2, 'inquiry', 30),
    (p_venue_id, v_template_id, 'Tour Scheduled', '#8B9F5D', 3, 'tour', 50),
    (p_venue_id, v_template_id, 'Proposal Sent', '#A08B5D', 4, 'proposal', 70),
    (p_venue_id, v_template_id, 'Booked', '#4F7A5D', 5, 'booked', 100),
    (p_venue_id, v_template_id, 'Lost', '#8A6A6A', 6, 'lost', 0);

  return v_template_id;
end;
$$;

grant execute on function public.ensure_standard_sales_pipeline(uuid) to authenticated, service_role;

-- Backfill Standard Sales Pipeline for venues with zero templates.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.venues loop
    perform public.ensure_standard_sales_pipeline(v_id);
  end loop;
end $$;

-- ---- 5. Activity log on sales_stage changes ---------------------------------

create or replace function public.log_lead_sales_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.sales_stage is distinct from new.sales_stage then
    insert into public.lead_activities (venue_id, lead_id, type, title)
    values (
      new.venue_id,
      new.id,
      'sales_stage_changed',
      'Stage changed to ' || initcap(replace(new.sales_stage, '_', ' '))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists leads_after_sales_stage_update on public.leads;
create trigger leads_after_sales_stage_update
  after update of sales_stage on public.leads
  for each row execute function public.log_lead_sales_stage_changed();

-- ---- 6. Tour scheduled → forward-only tour_scheduled stage ------------------

create or replace function public._advance_lead_on_tour_scheduled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'scheduled' and NEW.lead_id is not null then
    update public.leads
    set sales_stage = 'tour_scheduled'
    where id = NEW.lead_id
      and venue_id = NEW.venue_id
      and sales_stage in ('new_inquiry', 'outreach_sent', 'enrolled_in_sequence');
  end if;
  return NEW;
exception when others then
  raise warning '_advance_lead_on_tour_scheduled failed for appointment %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists advance_lead_on_tour_scheduled on public.tour_appointments;
create trigger advance_lead_on_tour_scheduled
  after insert on public.tour_appointments
  for each row execute function public._advance_lead_on_tour_scheduled();

notify pgrst, 'reload schema';
