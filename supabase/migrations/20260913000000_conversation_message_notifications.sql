-- Communication Platform — Release Readiness, Release Blocker #2.
--
-- notify_inbound_message fires only on the legacy `messages` table.
-- conversation_messages_touch (the new Conversation system's own trigger)
-- only updates last_message_at/unread counters — no notification fires at
-- all for a message landing in the new system, already named as a gap in
-- docs/platform-orchestration-architecture.md §1. This closes it with the
-- same shape _trigger_message_notification already uses (gated to messages
-- from the other party, same create_venue_notification call, same emoji),
-- not a new notification mechanism.

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

create trigger notify_conversation_message
  after insert on public.conversation_messages
  for each row execute function public._trigger_conversation_message_notification();
