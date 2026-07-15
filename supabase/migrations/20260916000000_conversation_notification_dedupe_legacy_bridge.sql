-- Communication Platform — End-to-End Verification.
--
-- Found by live end-to-end testing, not by reading code: the notification
-- trigger added for Release Blocker #2 (docs/communication-platform-
-- release-readiness.md) double-fires for every venue still on the legacy
-- messaging experience — which is every real venue today. An inbound
-- legacy email/SMS is inserted into `messages`, which fires
-- notify_inbound_message (pre-existing) *and* is mirrored by
-- sync_message_to_conversation into `conversation_messages`, which then
-- fires notify_conversation_message (added this pass) a second time for
-- the exact same real-world message. DB-verified directly: a single
-- legacy inbound insert produced 2 venue_notifications rows before this
-- fix, 1 after.
--
-- The fix: skip conversation_messages rows that are mirrors of a legacy
-- message (identified the same way sync_message_to_conversation's own
-- ON CONFLICT already does — channel_metadata carrying 'legacy_message_id')
-- — those already notified through their own, original trigger. Only a
-- conversation_message with no legacy origin (a native SMS inbound write,
-- a scheduled-message send reply, or any future native Conversation send)
-- should reach this trigger's own notification.

create or replace function public._trigger_conversation_message_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_relationship_id uuid;
  v_display_name    text;
  v_lead_id         uuid;
  v_client_id       uuid;
  v_link            text;
begin
  -- Only the other party's messages are notification-worthy — a venue
  -- staff member's own send, or a system-generated entry, needs no alert.
  if new.sender_type not in ('lead_or_client', 'contact', 'vendor') then
    return new;
  end if;

  -- A mirror of a legacy message already fired notify_inbound_message at
  -- the moment it landed in `messages` — firing again here would double
  -- every inbound notification for the (still-default) legacy experience.
  if new.channel_metadata ? 'legacy_message_id' then
    return new;
  end if;

  select relationship_id into v_relationship_id
  from public.conversations where id = new.conversation_id;

  if v_relationship_id is null then
    return new;
  end if;

  select first_name || coalesce(' ' || last_name, '') into v_display_name
  from public.venue_customer_relationships where id = v_relationship_id;

  select id into v_lead_id from public.leads where relationship_id = v_relationship_id;
  select id into v_client_id from public.clients where relationship_id = v_relationship_id;

  v_link := case
    when v_client_id is not null then '/clients/' || v_client_id::text
    when v_lead_id   is not null then '/leads/' || v_lead_id::text
    else '/messaging'
  end;

  perform public.create_venue_notification(
    new.venue_id,
    null,
    'message_received',
    'New message from ' || coalesce(v_display_name, 'your contact'),
    case when new.body is not null then left(new.body, 100) else null end,
    v_link,
    '💬'
  );

  return new;
exception when others then
  -- Notifications must never block the conversation write itself.
  raise warning '_trigger_conversation_message_notification failed for message %: %', new.id, sqlerrm;
  return new;
end;
$$;
