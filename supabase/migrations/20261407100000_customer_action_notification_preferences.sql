-- ============================================================================
-- Customer-action email notification preferences:
--   tour_scheduled · tour_confirmed · proposal_accepted
--
-- Extends the existing venue_notification_preferences +
-- create_venue_notification gate (202612980). Does not introduce a second
-- notification framework.
--
-- tour_scheduled already fires from AFTER INSERT on tour_appointments
-- (202609220). This migration only gates it and improves subject/body.
--
-- tour_confirmed did not notify the venue. Wire it to the canonical
-- scheduled → confirmed status transition (covers prospect_link via
-- confirm_tour_by_token AND staff manual confirm via updateTourStatus).
-- Confirmation request send does NOT change status — so it cannot fire this.
--
-- proposal_accepted already fires from accept_commercial_selection and
-- approve_commercial_proposal on the offered/sent → accepted transition.
-- Idempotent: second accept returns before the notification write.
-- This migration only adds the preference gate + subject wording.
-- ============================================================================

-- ── 1. Preference columns ────────────────────────────────────────────────────
-- Defaults: actionable customer-action events → ON (same convention as
-- new_inquiry / new message).

alter table public.venue_notification_preferences
  add column if not exists pref_tour_scheduled    boolean not null default true,
  add column if not exists pref_tour_confirmed    boolean not null default true,
  add column if not exists pref_proposal_accepted boolean not null default true;

comment on column public.venue_notification_preferences.pref_tour_scheduled is
  'Email when a tour appointment is created/scheduled (including public Schedule a Tour).';
comment on column public.venue_notification_preferences.pref_tour_confirmed is
  'Email when a tour transitions to confirmed (prospect link or staff mark). Not fired by confirmation-request send.';
comment on column public.venue_notification_preferences.pref_proposal_accepted is
  'Email when a client accepts a proposal via the canonical Accept action.';

-- ── 2. create_venue_notification — extend type→pref CASE ─────────────────────
-- Body matches 202612980 (needs_email + fresh-venue defaults), plus the three
-- new branches. Unknown types still default ON.

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
    when 'tour_scheduled'               then pref_tour_scheduled
    when 'tour_confirmed'               then pref_tour_confirmed
    when 'proposal_accepted'            then pref_proposal_accepted
    else true
  end into v_enabled
  from public.venue_notification_preferences
  where venue_id = p_venue_id;

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

-- ── 3. get_notification_preferences ──────────────────────────────────────────

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
      'prefTourScheduled',             true,
      'prefTourConfirmed',             true,
      'prefProposalAccepted',          true,
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
    'prefTourScheduled',             v_prefs.pref_tour_scheduled,
    'prefTourConfirmed',             v_prefs.pref_tour_confirmed,
    'prefProposalAccepted',          v_prefs.pref_proposal_accepted,
    'channelEmail',                  v_prefs.channel_email,
    'channelSms',                    v_prefs.channel_sms,
    'channelPush',                   v_prefs.channel_push
  );
end;
$$;

-- ── 4. update_notification_preferences ───────────────────────────────────────

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
  p_pref_contract_requires_attention  boolean default null,
  p_pref_contract_signed              boolean default null,
  p_pref_final_guest_count_submitted  boolean default null,
  p_pref_tour_scheduled               boolean default null,
  p_pref_tour_confirmed               boolean default null,
  p_pref_proposal_accepted            boolean default null
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
    pref_tour_scheduled, pref_tour_confirmed, pref_proposal_accepted,
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
    coalesce(p_pref_contract_requires_attention,  true),
    coalesce(p_pref_contract_signed,              false),
    coalesce(p_pref_final_guest_count_submitted,  false),
    coalesce(p_pref_tour_scheduled,               true),
    coalesce(p_pref_tour_confirmed,               true),
    coalesce(p_pref_proposal_accepted,            true),
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
    pref_tour_scheduled              = coalesce(p_pref_tour_scheduled,              venue_notification_preferences.pref_tour_scheduled),
    pref_tour_confirmed              = coalesce(p_pref_tour_confirmed,              venue_notification_preferences.pref_tour_confirmed),
    pref_proposal_accepted           = coalesce(p_pref_proposal_accepted,           venue_notification_preferences.pref_proposal_accepted),
    updated_at                       = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 5. Tour scheduled — subject/body polish (still AFTER INSERT only) ────────

create or replace function public._trigger_tour_scheduled_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz     text;
  v_when   text;
  v_body   text;
  v_name   text;
  v_link   text;
  v_dur    text;
begin
  if NEW.status <> 'scheduled' then
    return NEW;
  end if;

  select coalesce(nullif(trim(timezone), ''), 'America/New_York')
  into v_tz
  from public.venues
  where id = NEW.venue_id;

  v_name := coalesce(nullif(trim(NEW.contact_name), ''), 'a client');
  v_when := to_char(NEW.scheduled_at at time zone v_tz, 'Mon DD, YYYY "at" HH12:MI AM');
  v_dur := case
    when NEW.duration_minutes is not null and NEW.duration_minutes > 0
      then NEW.duration_minutes::text || ' min'
    else null
  end;

  v_body := v_when;
  if v_dur is not null then
    v_body := v_body || ' · ' || v_dur;
  end if;
  if NEW.event_type is not null and length(trim(NEW.event_type)) > 0 then
    v_body := v_body || ' · ' || trim(NEW.event_type);
  end if;

  if NEW.lead_id is not null then
    v_link := '/leads/' || NEW.lead_id::text;
  else
    v_link := '/tours';
  end if;

  perform public.create_venue_notification(
    NEW.venue_id,
    null,
    'tour_scheduled',
    'New tour scheduled — ' || v_name,
    v_body,
    v_link,
    '🗓️'
  );

  return NEW;
exception when others then
  raise warning '_trigger_tour_scheduled_notification failed for appointment %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

-- Trigger already exists from 202609220 — recreate to bind the updated function.
drop trigger if exists notify_tour_scheduled on public.tour_appointments;
create trigger notify_tour_scheduled
  after insert on public.tour_appointments
  for each row execute function public._trigger_tour_scheduled_notification();

-- ── 6. Tour confirmed — fire once on scheduled → confirmed ───────────────────

create or replace function public._trigger_tour_confirmed_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz   text;
  v_when text;
  v_name text;
  v_link text;
  v_body text;
begin
  if OLD.status = 'confirmed' or NEW.status <> 'confirmed' then
    return NEW;
  end if;

  select coalesce(nullif(trim(timezone), ''), 'America/New_York')
  into v_tz
  from public.venues
  where id = NEW.venue_id;

  v_name := coalesce(nullif(trim(NEW.contact_name), ''), 'a client');
  v_when := to_char(NEW.scheduled_at at time zone v_tz, 'Mon DD, YYYY "at" HH12:MI AM');
  v_body := v_when;
  if NEW.confirmation_source = 'prospect_link' then
    v_body := v_body || ' · Confirmed by the guest';
  elsif NEW.confirmation_source = 'manual' then
    v_body := v_body || ' · Marked confirmed by your team';
  end if;

  if NEW.lead_id is not null then
    v_link := '/leads/' || NEW.lead_id::text;
  else
    v_link := '/tours';
  end if;

  perform public.create_venue_notification(
    NEW.venue_id,
    null,
    'tour_confirmed',
    'Tour confirmed — ' || v_name,
    v_body,
    v_link,
    '✅'
  );

  return NEW;
exception when others then
  raise warning '_trigger_tour_confirmed_notification failed for appointment %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_tour_confirmed on public.tour_appointments;
create trigger notify_tour_confirmed
  after update of status on public.tour_appointments
  for each row execute function public._trigger_tour_confirmed_notification();

-- ── 7. Proposal accepted — subject wording (both accept paths) ───────────────
-- Re-apply the notice bodies with preferred subject; preference gate is now
-- in create_venue_notification. Idempotency unchanged (early return when
-- already accepted / already approved).

create or replace function public.accept_commercial_selection(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_selections%rowtype;
  v_who text;
  v_amount text;
  v_title text;
  v_link text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_selections
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'accepted' then
    return jsonb_build_object('ok', true, 'id', v_row.id, 'alreadyAccepted', true);
  end if;

  if v_row.status <> 'offered' then
    return jsonb_build_object('ok', false, 'error', 'not_offered');
  end if;

  update public.commercial_selections
  set status = 'accepted',
      accepted_at = now()
  where id = v_row.id;

  v_who := null;
  if v_row.lead_id is not null then
    select nullif(trim(concat_ws(' ',
      nullif(trim(l.first_name), ''),
      nullif(trim(l.last_name), '')
    )), '')
    into v_who
    from public.leads l
    where l.id = v_row.lead_id
      and l.venue_id = v_row.venue_id;
  end if;
  if v_who is null and v_row.client_id is not null then
    select nullif(trim(concat_ws(' ',
      nullif(trim(c.first_name), ''),
      nullif(trim(c.last_name), '')
    )), '')
    into v_who
    from public.clients c
    where c.id = v_row.client_id
      and c.venue_id = v_row.venue_id;
  end if;
  if v_who is null then
    v_who := 'A client';
  end if;

  v_amount := trim(to_char(v_row.total_amount, 'FM$999,999,990.00'));
  v_title := 'Proposal accepted — ' || v_who;

  if v_row.lead_id is not null then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (v_row.venue_id, v_row.lead_id, 'proposal_accepted', v_title, v_amount || ' · ' || v_row.name);
  elsif v_row.client_id is not null then
    insert into public.client_activities (venue_id, client_id, type, title, description)
    values (v_row.venue_id, v_row.client_id, 'proposal_accepted', v_title, v_amount || ' · ' || v_row.name);
  end if;

  if v_row.client_id is not null then
    v_link := '/clients/' || v_row.client_id::text;
  elsif v_row.lead_id is not null then
    v_link := '/leads/' || v_row.lead_id::text;
  else
    v_link := null;
  end if;

  perform public.create_venue_notification(
    v_row.venue_id,
    v_row.event_id,
    'proposal_accepted',
    v_title,
    v_amount || ' · ' || v_row.name,
    v_link,
    '🎉'
  );

  return jsonb_build_object('ok', true, 'id', v_row.id, 'alreadyAccepted', false);
end;
$$;

revoke all on function public.accept_commercial_selection(text) from public;
grant execute on function public.accept_commercial_selection(text) to anon, authenticated, service_role;

create or replace function public.approve_commercial_proposal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_proposals%rowtype;
  v_total numeric(10, 2);
  v_primary_name text;
  v_primary_pkg uuid;
  v_items jsonb;
  v_selection_id uuid;
  v_who text;
  v_title text;
  v_amount text;
  v_link text;
  v_prev public.commercial_selections%rowtype;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_proposals
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'approved' and v_row.selection_id is not null then
    return jsonb_build_object('ok', true, 'id', v_row.id, 'selectionId', v_row.selection_id, 'alreadyApproved', true);
  end if;

  if v_row.status not in ('sent', 'selected') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  if not exists (select 1 from public.commercial_proposal_choices where proposal_id = v_row.id) then
    return jsonb_build_object('ok', false, 'error', 'no_selection');
  end if;

  if (select count(*) from public.commercial_proposal_choices
      where proposal_id = v_row.id and offer_role = 'primary') <> 1 then
    return jsonb_build_object('ok', false, 'error', 'need_one_primary');
  end if;

  select round(sum(line_total)::numeric, 2) into v_total
  from public.commercial_proposal_choices where proposal_id = v_row.id;

  select c.name, o.source_package_id
  into v_primary_name, v_primary_pkg
  from public.commercial_proposal_choices c
  join public.commercial_proposal_options o on o.id = c.option_id
  where c.proposal_id = v_row.id and c.offer_role = 'primary'
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'description', c.name,
      'quantity', c.quantity,
      'unit', case when c.offer_role = 'addon' then 'add-on' else 'package' end,
      'unitPrice', c.unit_price,
      'lineTotal', c.line_total,
      'offerRole', c.offer_role,
      'sourcePackageId', o.source_package_id
    ) order by case when c.offer_role = 'primary' then 0 else 1 end, c.name
  ), '[]'::jsonb)
  into v_items
  from public.commercial_proposal_choices c
  join public.commercial_proposal_options o on o.id = c.option_id
  where c.proposal_id = v_row.id;

  if v_row.client_id is not null then
    select * into v_prev from public.commercial_selections
    where venue_id = v_row.venue_id and client_id = v_row.client_id and status <> 'superseded'
    order by created_at desc limit 1 for update;
  elsif v_row.lead_id is not null then
    select * into v_prev from public.commercial_selections
    where venue_id = v_row.venue_id and lead_id = v_row.lead_id and status <> 'superseded'
    order by created_at desc limit 1 for update;
  end if;

  insert into public.commercial_selections (
    venue_id, lead_id, client_id, event_id, source_package_id,
    name, total_amount, deposit_amount, included_items,
    status, version, offered_at, accepted_at, selected_at, approved_at,
    proposal_id, offer_message
  ) values (
    v_row.venue_id, v_row.lead_id, v_row.client_id, v_row.event_id, v_primary_pkg,
    v_primary_name, v_total,
    least(coalesce(v_row.deposit_amount, 0), v_total),
    v_items,
    'accepted',
    coalesce(v_prev.version, 0) + 1,
    v_row.offered_at,
    now(),
    coalesce(v_row.selected_at, now()),
    now(),
    v_row.id,
    v_row.offer_message
  )
  returning id into v_selection_id;

  if v_prev.id is not null then
    update public.commercial_selections
    set status = 'superseded', superseded_by_id = v_selection_id
    where id = v_prev.id;
  end if;

  update public.commercial_proposals
  set status = 'approved',
      selected_at = coalesce(selected_at, now()),
      approved_at = now(),
      selection_id = v_selection_id
  where id = v_row.id;

  v_who := 'A client';
  if v_row.lead_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', nullif(trim(l.first_name), ''), nullif(trim(l.last_name), ''))), ''), 'A client')
    into v_who from public.leads l where l.id = v_row.lead_id and l.venue_id = v_row.venue_id;
  elsif v_row.client_id is not null then
    select coalesce(nullif(trim(concat_ws(' ', nullif(trim(c.first_name), ''), nullif(trim(c.last_name), ''))), ''), 'A client')
    into v_who from public.clients c where c.id = v_row.client_id and c.venue_id = v_row.venue_id;
  end if;

  v_amount := trim(to_char(v_total, 'FM$999,999,990.00'));
  v_title := 'Proposal accepted — ' || v_who;

  if v_row.lead_id is not null then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (v_row.venue_id, v_row.lead_id, 'proposal_accepted', v_title, v_amount || ' · ' || v_primary_name);
    v_link := '/leads/' || v_row.lead_id::text;
  elsif v_row.client_id is not null then
    insert into public.client_activities (venue_id, client_id, type, title, description)
    values (v_row.venue_id, v_row.client_id, 'proposal_accepted', v_title, v_amount || ' · ' || v_primary_name);
    v_link := '/clients/' || v_row.client_id::text;
  end if;

  perform public.create_venue_notification(
    v_row.venue_id, v_row.event_id, 'proposal_accepted', v_title,
    v_amount || ' · ' || v_primary_name, v_link, '🎉'
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'selectionId', v_selection_id,
    'totalAmount', v_total,
    'alreadyApproved', false
  );
end;
$$;

revoke all on function public.approve_commercial_proposal(text) from public;
grant execute on function public.approve_commercial_proposal(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
