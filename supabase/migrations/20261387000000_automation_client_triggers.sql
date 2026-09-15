-- Automations Workstream #15 — Client relationship triggers via Platform Events.
-- Extends message_sequences trigger vocabulary; emits Contract/Questionnaire/
-- GuestCount platform events from domain writes; claims table for idempotent
-- enrollment; retires the Settings-only Event.Completed nudge rule in favor of
-- the venue-facing Automations list (SEQ-04 Post-Event Thank You).

-- ── 1. Expand trigger_type vocabulary ────────────────────────────────────────
alter table public.message_sequences
  drop constraint if exists message_sequences_trigger_type_check;

alter table public.message_sequences
  add constraint message_sequences_trigger_type_check
  check (trigger_type is null or trigger_type in (
    'lead_created',
    'lead_stage_changed',
    'tour_completed',
    'contract_signed',
    'payment_received',
    'questionnaire_submitted',
    'guest_count_submitted',
    'event_completed'
  ));

-- ── 2. Idempotent enrollment claims + scan ledger ────────────────────────────
create table if not exists public.sequence_platform_event_claims (
  platform_event_id uuid not null references public.platform_events (id) on delete cascade,
  sequence_id       uuid not null references public.message_sequences (id) on delete cascade,
  enrollment_id     uuid references public.sequence_enrollments (id) on delete set null,
  created_at        timestamptz not null default now(),
  primary key (platform_event_id, sequence_id)
);

create index if not exists sequence_platform_event_claims_sequence
  on public.sequence_platform_event_claims (sequence_id);

alter table public.sequence_platform_event_claims enable row level security;
grant select, insert, update on public.sequence_platform_event_claims to service_role;

-- Marks a Platform Event as fully considered for Automation enrollment so the
-- cron does not rescan forever when no Automations matched.
create table if not exists public.platform_event_automation_scans (
  platform_event_id uuid primary key references public.platform_events (id) on delete cascade,
  scanned_at        timestamptz not null default now()
);

alter table public.platform_event_automation_scans enable row level security;
grant select, insert on public.platform_event_automation_scans to service_role;

-- Unscanned Automation-relevant Platform Events for the enrollment cron.
create or replace function public.list_unscanned_automation_platform_events(p_limit int default 50)
returns setof public.platform_events
language sql
stable
security definer
set search_path to 'public'
as $$
  select pe.*
  from public.platform_events pe
  where pe.event_type in (
    'Contract.Signed',
    'Payment.Received',
    'Questionnaire.Submitted',
    'GuestCount.Submitted',
    'Event.Completed'
  )
  and not exists (
    select 1 from public.platform_event_automation_scans s
    where s.platform_event_id = pe.id
  )
  order by pe.occurred_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.list_unscanned_automation_platform_events(int) to service_role;

-- ── 3. Contract.Signed when a contract first becomes fully signed ────────────
create or replace function public.emit_contract_signed_platform_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    perform public.emit_platform_event(
      'Contract.Signed',
      'contracts',
      'contract',
      new.id,
      new.venue_id,
      new.client_id,
      'client',
      null,
      null,
      jsonb_build_object('eventId', new.event_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_emit_signed_platform_event on public.contracts;
create trigger contracts_emit_signed_platform_event
  after update of status on public.contracts
  for each row
  execute function public.emit_contract_signed_platform_event();

-- ── 4. Questionnaire.Submitted on first transition to submitted ──────────────
create or replace function public.emit_questionnaire_submitted_platform_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_client_id uuid;
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    select e.client_id into v_client_id
    from public.events e
    where e.id = new.event_id;

    perform public.emit_platform_event(
      'Questionnaire.Submitted',
      'questionnaires',
      'questionnaire',
      new.id,
      new.venue_id,
      v_client_id,
      'client',
      null,
      null,
      jsonb_build_object('eventId', new.event_id, 'kind', new.kind)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists event_questionnaires_emit_submitted_platform_event on public.event_questionnaires;
create trigger event_questionnaires_emit_submitted_platform_event
  after update of status on public.event_questionnaires
  for each row
  execute function public.emit_questionnaire_submitted_platform_event();

-- ── 5. GuestCount.Submitted once per client (first celebration insert) ───────
create or replace function public.emit_guest_count_submitted_platform_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.celebration_type = 'guest_list_submitted' then
    perform public.emit_platform_event(
      'GuestCount.Submitted',
      'guests',
      'guest_count_submission',
      new.entity_id,
      new.venue_id,
      new.client_id,
      'client',
      null,
      null,
      jsonb_build_object('eventId', new.event_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists luv_celebrations_emit_guest_count_platform_event on public.luv_celebrations;
create trigger luv_celebrations_emit_guest_count_platform_event
  after insert on public.luv_celebrations
  for each row
  execute function public.emit_guest_count_submitted_platform_event();

-- ── 6. Retire Settings-only Event.Completed nudge (moved to Automations) ─────
update public.automation_rules
set enabled = false,
    updated_at = now()
where trigger_event_type = 'Event.Completed'
  and action_type = 'schedule_relationship_message'
  and enabled = true;

notify pgrst, 'reload schema';
