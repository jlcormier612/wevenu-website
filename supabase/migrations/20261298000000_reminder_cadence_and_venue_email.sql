-- ============================================================================
-- Reminder cadence + venue email dispatch.
--
-- Two extensions to the EXISTING engine (task_reminders + engine.ts +
-- create_venue_notification), not a second system:
--
-- 1. Client-facing reminders gain two things they never had: a payment/
--    contract source (alongside the existing task/tour sources) and real
--    recurrence (a stale doc comment in engine.ts described this back in
--    Sprint 44; the column it referred to was never built — this is that
--    column). Recurrence is opt-in per-row via after_due_recur_interval_days:
--    when the processing engine sends a row with this set and the
--    underlying obligation is still outstanding, it schedules the next
--    occurrence at +N days, carrying the same interval forward. Rows
--    without it behave exactly as they always have (single-fire).
--
-- 2. Venue-facing notifications gain a real email path. create_venue_
--    notification() already gates every in-app insert by the venue's
--    per-type preference (venue_notification_preferences) — this adds
--    needs_email/emailed_at to venue_notifications and sets needs_email
--    from that SAME preference check, so a dispatcher can pick up exactly
--    the rows the venue already asked for. No second preference system,
--    no separate template layer — title/body/link/emoji already stored on
--    the row become the email content directly.
-- ============================================================================


-- ── 1. task_reminders — new sources + recurrence ─────────────────────────────

alter table public.task_reminders
  add column if not exists payment_line_item_id       uuid references public.payment_line_items(id) on delete cascade,
  add column if not exists contract_id                 uuid references public.contracts(id) on delete cascade,
  add column if not exists after_due_recur_interval_days integer;

comment on column public.task_reminders.after_due_recur_interval_days is
  'When set, a successful send of this (overdue-phase) reminder schedules the next occurrence at +N days, carrying this same interval forward, as long as the underlying obligation is still outstanding. Null = single-fire, the original behavior.';

-- Replace the task/tour-only source check with a four-way exactly-one check.
alter table public.task_reminders drop constraint if exists task_reminders_source_check;
alter table public.task_reminders add constraint task_reminders_source_check check (
  (case when event_task_id       is not null then 1 else 0 end) +
  (case when tour_appointment_id is not null then 1 else 0 end) +
  (case when payment_line_item_id is not null then 1 else 0 end) +
  (case when contract_id          is not null then 1 else 0 end) = 1
);

create index if not exists task_reminders_by_payment_line_item
  on public.task_reminders (payment_line_item_id, status) where payment_line_item_id is not null;
create index if not exists task_reminders_by_contract
  on public.task_reminders (contract_id, status) where contract_id is not null;


-- ── 2. venue_reminder_cadence — venue-configurable, selectable presets ──────
-- Not an arbitrary automation builder: a small fixed set of named cadence
-- presets per obligation type, same "no row = sensible defaults" pattern
-- as venue_notification_preferences.

create table if not exists public.venue_reminder_cadence (
  venue_id uuid primary key references public.venues(id) on delete cascade,

  payment_before_due_cadence  text not null default 'weekly'
    check (payment_before_due_cadence  in ('weekly', 'none')),
  payment_after_due_cadence   text not null default 'daily'
    check (payment_after_due_cadence   in ('daily', 'every_3_days', 'weekly', 'none')),

  contract_before_due_cadence text not null default 'weekly'
    check (contract_before_due_cadence in ('weekly', 'none')),

  task_after_due_cadence      text not null default 'every_3_days'
    check (task_after_due_cadence      in ('daily', 'every_3_days', 'weekly', 'none')),

  updated_at timestamptz not null default now()
);

alter table public.venue_reminder_cadence enable row level security;

create policy "venue owner reads own cadence"
  on public.venue_reminder_cadence for select
  using (exists (select 1 from public.venues where id = venue_reminder_cadence.venue_id and owner_user_id = auth.uid()));

create policy "venue owner updates own cadence"
  on public.venue_reminder_cadence for update
  using (exists (select 1 from public.venues where id = venue_reminder_cadence.venue_id and owner_user_id = auth.uid()));

grant select, update on public.venue_reminder_cadence to authenticated;

create or replace function public.get_reminder_cadence()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_row      public.venue_reminder_cadence%rowtype;
begin
  select id into v_venue_id from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_row from public.venue_reminder_cadence where venue_id = v_venue_id;
  if not found then
    return jsonb_build_object(
      'paymentBeforeDueCadence',  'weekly',
      'paymentAfterDueCadence',   'daily',
      'contractBeforeDueCadence', 'weekly',
      'taskAfterDueCadence',      'every_3_days'
    );
  end if;

  return jsonb_build_object(
    'paymentBeforeDueCadence',  v_row.payment_before_due_cadence,
    'paymentAfterDueCadence',   v_row.payment_after_due_cadence,
    'contractBeforeDueCadence', v_row.contract_before_due_cadence,
    'taskAfterDueCadence',      v_row.task_after_due_cadence
  );
end;
$$;

grant execute on function public.get_reminder_cadence() to authenticated;

create or replace function public.update_reminder_cadence(
  p_payment_before_due_cadence  text default null,
  p_payment_after_due_cadence   text default null,
  p_contract_before_due_cadence text default null,
  p_task_after_due_cadence      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;

  insert into public.venue_reminder_cadence (
    venue_id, payment_before_due_cadence, payment_after_due_cadence,
    contract_before_due_cadence, task_after_due_cadence, updated_at
  ) values (
    v_venue_id,
    coalesce(p_payment_before_due_cadence,  'weekly'),
    coalesce(p_payment_after_due_cadence,   'daily'),
    coalesce(p_contract_before_due_cadence, 'weekly'),
    coalesce(p_task_after_due_cadence,      'every_3_days'),
    now()
  )
  on conflict (venue_id) do update set
    payment_before_due_cadence  = coalesce(p_payment_before_due_cadence,  venue_reminder_cadence.payment_before_due_cadence),
    payment_after_due_cadence   = coalesce(p_payment_after_due_cadence,   venue_reminder_cadence.payment_after_due_cadence),
    contract_before_due_cadence = coalesce(p_contract_before_due_cadence, venue_reminder_cadence.contract_before_due_cadence),
    task_after_due_cadence      = coalesce(p_task_after_due_cadence,      venue_reminder_cadence.task_after_due_cadence),
    updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_reminder_cadence(text, text, text, text) to authenticated;


-- ── 3. venue_notifications — email dispatch flags ────────────────────────────

alter table public.venue_notifications
  add column if not exists needs_email boolean not null default false,
  add column if not exists emailed_at  timestamptz;

create index if not exists venue_notifications_needs_email
  on public.venue_notifications (needs_email) where needs_email and emailed_at is null;


-- ── 4. create_venue_notification — set needs_email from the SAME per-type gate,
--    and extend the CASE with the two new detector-driven types ─────────────

create or replace function public.create_venue_notification(
  p_venue_id uuid,
  p_event_id uuid,
  p_type     text,
  p_title    text,
  p_body     text,
  p_link     text,
  p_emoji    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
begin
  select case p_type
    when 'new_lead'                     then pref_new_lead
    when 'rsvp_received'                then pref_rsvp_received
    when 'task_completed_couple'        then pref_task_completed
    when 'task_completed_vendor'        then pref_task_completed
    when 'vendor_checked_in'            then pref_vendor_checked_in
    when 'feedback_received'            then pref_feedback_received
    when 'referral_received'            then pref_referral_received
    when 'message_received'             then pref_message_received
    when 'questionnaire_submitted'      then pref_client_submitted_info
    when 'contract_signed'              then pref_contract_signed
    when 'final_guest_count_submitted'  then pref_final_guest_count_submitted
    when 'payment_failed'               then pref_payment_failed
    when 'payment_received'             then pref_payment_received
    when 'payment_overdue'              then pref_payment_overdue
    when 'contract_requires_attention'  then pref_contract_requires_attention
    else true
  end into v_enabled
  from public.venue_notification_preferences
  where venue_id = p_venue_id;

  -- No prefs row yet (brand-new venue) — this now gates real email, not
  -- just the in-app bell, so "not found" must fall back to each type's own
  -- intended default (the same ones update_notification_preferences()
  -- inserts), not a blanket true. A fresh venue must never get emailed for
  -- payment_received/contract_signed/final_guest_count_submitted/
  -- questionnaire_submitted before they've ever opened Settings.
  if not found then
    v_enabled := case p_type
      when 'questionnaire_submitted'     then false
      when 'payment_received'            then false
      when 'contract_signed'             then false
      when 'final_guest_count_submitted' then false
      else true
    end;
  end if;
  if not v_enabled then return; end if;

  insert into public.venue_notifications (venue_id, event_id, type, title, body, link, emoji, needs_email)
  values (p_venue_id, p_event_id, p_type, p_title, p_body, p_link, p_emoji, v_enabled);
exception when others then
  null;
end;
$$;


-- ── 5. contracts — idempotency stamp for the attention detector ─────────────

alter table public.contracts
  add column if not exists attention_notified_at timestamptz;

comment on column public.contracts.attention_notified_at is
  'Set once when the contract first crosses into "requires attention" (sent, unsigned, expires within 3 days or already expired). Makes the detection sweep idempotent — never re-fires for the same contract.';
