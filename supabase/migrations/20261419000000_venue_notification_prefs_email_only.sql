-- Notification preferences control optional EMAIL only — never in-app visibility.
-- Settings copy (Communications): "These are optional extras — your important
-- activity and alerts will still appear in Hello to Cheers."
--
-- Previous create_venue_notification (202612980 / 202614071) early-returned when
-- the per-type pref was OFF, so no venue_notifications row was inserted and the
-- bell never showed the event. Correct contract:
--   • Always insert the in-app row when create_venue_notification is called.
--   • Set needs_email from the same preference CASE (true = eligible for
--     processVenueNotificationEmails; false = suppress optional email).
-- Triggers, idempotency, and callers are unchanged.

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
  v_email_enabled boolean;
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
  end into v_email_enabled
  from public.venue_notification_preferences
  where venue_id = p_venue_id;

  -- No prefs row (brand-new venue): same email defaults as before — quiet types
  -- stay needs_email=false until Settings is opened; in-app row is still created.
  if not found then
    v_email_enabled := case p_type
      when 'questionnaire_submitted'     then false
      when 'payment_received'            then false
      when 'contract_signed'             then false
      when 'final_guest_count_submitted' then false
      else true
    end;
  end if;

  insert into public.venue_notifications (venue_id, event_id, type, title, body, link, emoji, needs_email)
  values (p_venue_id, p_event_id, p_type, p_title, p_body, p_link, p_emoji, v_email_enabled);
exception when others then
  null;
end;
$$;
