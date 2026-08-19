-- ============================================================================
-- Notification Preferences — email correction pass.
--
-- Product correction: the venue-facing "Notification Preferences" screen
-- was mislabeled as controlling in-app notifications; it's meant to be an
-- optional EMAIL escalation layer, and RSVP received (routine, per-guest,
-- high-volume) should never have been a venue-level toggle in the first
-- place. This migration only extends the existing framework from
-- 20260708115000_sprint86_notification_preferences.sql — no new tables,
-- no second preference system, no changes to any existing trigger's
-- control flow (create_venue_notification's own EXCEPTION-swallowing
-- behavior is unchanged).
--
-- New preference columns below gate EXISTING notification types that
-- already fire via create_venue_notification() and previously had no
-- preference column at all (questionnaire_submitted, contract_signed) —
-- adding a CASE branch here is the only change needed; the call sites in
-- earlier migrations are untouched.
--
-- Two of the new columns (pref_payment_overdue, pref_contract_requires_
-- attention) are reserved: the venue-facing screen must show them per
-- product decision, but no discrete backend event exists yet to fire
-- either (payment overdue is a lazily-computed status, not an event;
-- contract-expiry is computed client-side only). They store real
-- preference state for forward compatibility but are not wired into any
-- CASE branch below since nothing will ever pass those type strings today.
-- See the implementation report for the full explanation — this is not
-- an oversight.
--
-- RSVP received keeps its column, trigger, and gate untouched — only the
-- venue-facing screen stops showing it. Task completed likewise keeps its
-- column/trigger/gate untouched — it stops being shown on the redesigned
-- screen because routine task completions belong in-app (Tasks/Activity),
-- not as a venue email option, but the underlying preference and trigger
-- remain fully intact for any code that already depends on them.
-- ============================================================================

-- ── 1. New preference columns ────────────────────────────────────────────────
-- Defaults follow the governing rule: meaningful/actionable/time-sensitive
-- events default on; routine or "good news, no action needed" events
-- default off. Documented per-column since none of these had an
-- established prior default.

alter table public.venue_notification_preferences
  add column if not exists pref_client_submitted_info        boolean not null default false, -- informational, not urgent
  add column if not exists pref_payment_failed                boolean not null default true,  -- actionable, time-sensitive
  add column if not exists pref_payment_overdue                boolean not null default true,  -- actionable, time-sensitive (reserved — see header)
  add column if not exists pref_payment_received               boolean not null default false, -- good news; venue may not want an email per successful payment
  add column if not exists pref_contract_requires_attention   boolean not null default true,  -- actionable, time-sensitive (reserved — see header)
  add column if not exists pref_contract_signed                boolean not null default false, -- good news, not urgent
  add column if not exists pref_final_guest_count_submitted   boolean not null default false; -- planning milestone, already surfaced on the event/guest area

comment on column public.venue_notification_preferences.pref_payment_overdue is
  'Reserved: no discrete "became overdue" event exists yet (status is computed lazily on read by mark_overdue_payments). Preference is stored and shown per product decision but is not currently wired to any notification.';
comment on column public.venue_notification_preferences.pref_contract_requires_attention is
  'Reserved: contract expiry/attention state is computed client-side only (components/contracts/contract-detail.tsx). Preference is stored and shown per product decision but is not currently wired to any notification.';


-- ── 2. create_venue_notification — extend the type→column gate ──────────────
-- Same function, same EXCEPTION-swallowing, same "no prefs row = enabled"
-- fallback. Only the CASE statement gains branches for types that already
-- fire elsewhere in the codebase and previously had no gate (always-on).

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
  v_enabled boolean := true;
begin
  select case p_type
    when 'new_lead'                    then pref_new_lead
    when 'rsvp_received'               then pref_rsvp_received
    when 'task_completed_couple'       then pref_task_completed
    when 'task_completed_vendor'       then pref_task_completed
    when 'vendor_checked_in'           then pref_vendor_checked_in
    when 'feedback_received'           then pref_feedback_received
    when 'referral_received'           then pref_referral_received
    when 'message_received'            then pref_message_received
    when 'questionnaire_submitted'     then pref_client_submitted_info
    when 'contract_signed'             then pref_contract_signed
    when 'final_guest_count_submitted' then pref_final_guest_count_submitted
    when 'payment_failed'              then pref_payment_failed
    when 'payment_received'            then pref_payment_received
    else true
  end into v_enabled
  from public.venue_notification_preferences
  where venue_id = p_venue_id;

  if not found then v_enabled := true; end if;
  if not v_enabled then return; end if;

  insert into public.venue_notifications (venue_id, event_id, type, title, body, link, emoji)
  values (p_venue_id, p_event_id, p_type, p_title, p_body, p_link, p_emoji);
exception when others then
  null;
end;
$$;


-- ── 3. get_notification_preferences — return the new keys ───────────────────

create or replace function public.get_notification_preferences()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_prefs    public.venue_notification_preferences%rowtype;
begin
  select id into v_venue_id
  from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_prefs
  from public.venue_notification_preferences
  where venue_id = v_venue_id;

  if not found then
    return jsonb_build_object(
      'prefNewLead',                   true,
      'prefRsvpReceived',              true,
      'prefTaskCompleted',             true,
      'prefVendorCheckedIn',           true,
      'prefFeedbackReceived',          true,
      'prefReferralReceived',          true,
      'prefMessageReceived',           true,
      'prefClientSubmittedInfo',       false,
      'prefPaymentFailed',             true,
      'prefPaymentOverdue',            true,
      'prefPaymentReceived',           false,
      'prefContractRequiresAttention', true,
      'prefContractSigned',            false,
      'prefFinalGuestCountSubmitted',  false,
      'channelEmail',                  false,
      'channelSms',                    false,
      'channelPush',                   false
    );
  end if;

  return jsonb_build_object(
    'prefNewLead',                   v_prefs.pref_new_lead,
    'prefRsvpReceived',              v_prefs.pref_rsvp_received,
    'prefTaskCompleted',             v_prefs.pref_task_completed,
    'prefVendorCheckedIn',           v_prefs.pref_vendor_checked_in,
    'prefFeedbackReceived',          v_prefs.pref_feedback_received,
    'prefReferralReceived',          v_prefs.pref_referral_received,
    'prefMessageReceived',           v_prefs.pref_message_received,
    'prefClientSubmittedInfo',       v_prefs.pref_client_submitted_info,
    'prefPaymentFailed',             v_prefs.pref_payment_failed,
    'prefPaymentOverdue',            v_prefs.pref_payment_overdue,
    'prefPaymentReceived',           v_prefs.pref_payment_received,
    'prefContractRequiresAttention', v_prefs.pref_contract_requires_attention,
    'prefContractSigned',            v_prefs.pref_contract_signed,
    'prefFinalGuestCountSubmitted',  v_prefs.pref_final_guest_count_submitted,
    'channelEmail',                  v_prefs.channel_email,
    'channelSms',                    v_prefs.channel_sms,
    'channelPush',                   v_prefs.channel_push
  );
end;
$$;


-- ── 4. update_notification_preferences — accept the new keys ────────────────
-- Existing params unchanged (RSVP/task-completed stay writable for any
-- caller that still depends on them); new params follow the same
-- coalesce-on-conflict pattern.

create or replace function public.update_notification_preferences(
  p_pref_new_lead                    boolean default null,
  p_pref_rsvp_received                boolean default null,
  p_pref_task_completed               boolean default null,
  p_pref_vendor_checked_in            boolean default null,
  p_pref_feedback_received            boolean default null,
  p_pref_referral_received            boolean default null,
  p_pref_message_received             boolean default null,
  p_pref_client_submitted_info        boolean default null,
  p_pref_payment_failed               boolean default null,
  p_pref_payment_overdue              boolean default null,
  p_pref_payment_received             boolean default null,
  p_pref_contract_requires_attention boolean default null,
  p_pref_contract_signed              boolean default null,
  p_pref_final_guest_count_submitted boolean default null
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
  from public.venues where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;

  insert into public.venue_notification_preferences (
    venue_id,
    pref_new_lead, pref_rsvp_received, pref_task_completed,
    pref_vendor_checked_in, pref_feedback_received,
    pref_referral_received, pref_message_received,
    pref_client_submitted_info, pref_payment_failed, pref_payment_overdue,
    pref_payment_received, pref_contract_requires_attention,
    pref_contract_signed, pref_final_guest_count_submitted,
    updated_at
  ) values (
    v_venue_id,
    coalesce(p_pref_new_lead,                    true),
    coalesce(p_pref_rsvp_received,               true),
    coalesce(p_pref_task_completed,               true),
    coalesce(p_pref_vendor_checked_in,            true),
    coalesce(p_pref_feedback_received,            true),
    coalesce(p_pref_referral_received,            true),
    coalesce(p_pref_message_received,             true),
    coalesce(p_pref_client_submitted_info,        false),
    coalesce(p_pref_payment_failed,               true),
    coalesce(p_pref_payment_overdue,              true),
    coalesce(p_pref_payment_received,             false),
    coalesce(p_pref_contract_requires_attention, true),
    coalesce(p_pref_contract_signed,              false),
    coalesce(p_pref_final_guest_count_submitted, false),
    now()
  )
  on conflict (venue_id) do update set
    pref_new_lead                    = coalesce(p_pref_new_lead,                    venue_notification_preferences.pref_new_lead),
    pref_rsvp_received               = coalesce(p_pref_rsvp_received,               venue_notification_preferences.pref_rsvp_received),
    pref_task_completed              = coalesce(p_pref_task_completed,              venue_notification_preferences.pref_task_completed),
    pref_vendor_checked_in           = coalesce(p_pref_vendor_checked_in,           venue_notification_preferences.pref_vendor_checked_in),
    pref_feedback_received           = coalesce(p_pref_feedback_received,           venue_notification_preferences.pref_feedback_received),
    pref_referral_received           = coalesce(p_pref_referral_received,           venue_notification_preferences.pref_referral_received),
    pref_message_received            = coalesce(p_pref_message_received,            venue_notification_preferences.pref_message_received),
    pref_client_submitted_info       = coalesce(p_pref_client_submitted_info,       venue_notification_preferences.pref_client_submitted_info),
    pref_payment_failed              = coalesce(p_pref_payment_failed,              venue_notification_preferences.pref_payment_failed),
    pref_payment_overdue             = coalesce(p_pref_payment_overdue,             venue_notification_preferences.pref_payment_overdue),
    pref_payment_received            = coalesce(p_pref_payment_received,            venue_notification_preferences.pref_payment_received),
    pref_contract_requires_attention = coalesce(p_pref_contract_requires_attention, venue_notification_preferences.pref_contract_requires_attention),
    pref_contract_signed             = coalesce(p_pref_contract_signed,             venue_notification_preferences.pref_contract_signed),
    pref_final_guest_count_submitted = coalesce(p_pref_final_guest_count_submitted, venue_notification_preferences.pref_final_guest_count_submitted),
    updated_at                       = now();

  return jsonb_build_object('ok', true);
end;
$$;


-- ── 5. submit_guest_count — fire final_guest_count_submitted ────────────────
-- Identical body to the definition in 20261102000000_luv_celebrations.sql;
-- one new create_venue_notification call added after the luv_celebrations
-- insert, matching the exact pattern already used by submit_questionnaire_
-- as_couple for questionnaire_submitted (20261253000000). This is the
-- meaningful venue-level milestone RSVP received was replaced with —
-- individual per-guest RSVPs stay ungated by any email preference.

create or replace function public.submit_guest_count(p_token text, p_count integer, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_event     public.events%rowtype;
  v_submission_id uuid;
  v_completed_task_id uuid;
  v_celebrated boolean := false;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if p_count is null or p_count < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into v_event
  from public.events
  where client_id = v_session.client_id and venue_id = v_session.venue_id
    and status not in ('cancelled', 'complete')
  order by event_date asc limit 1;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  insert into public.guest_count_submissions (client_id, venue_id, event_id, submitted_count, note)
  values (v_session.client_id, v_session.venue_id, v_event.id, p_count, nullif(trim(p_note), ''))
  returning id into v_submission_id;

  update public.events
  set guest_count = p_count, updated_at = now()
  where id = v_event.id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session.venue_id and event_id = v_event.id
      and auto_complete_trigger = 'guest_count_finalized'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id
      and status = 'blocked' and venue_id = v_session.venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_session.venue_id, v_session.client_id, v_event.id, 'guest_list_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  perform public.create_venue_notification(
    v_session.venue_id, v_event.id, 'final_guest_count_submitted',
    'Final guest count submitted',
    coalesce(v_event.name, 'A couple') || ' submitted their final guest count: ' || p_count::text || '.',
    '/events/' || v_event.id::text,
    '🔢'
  );

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'count', p_count, 'celebrated', coalesce(v_celebrated, false));
end;
$$;
