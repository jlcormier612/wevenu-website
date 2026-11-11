-- ============================================================================
-- message_received deep links: unbooked clients have no Conversation tab.
-- Preparing workspace (/clients/:id without a linked event) is the booking
-- journey surface — couple messages live on the Lead Conversation tab until
-- the relationship is Booked. Prefer /leads/:id#messages in that case.
-- ============================================================================

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
  v_client_event_id uuid;
  v_link            text;
begin
  if new.sender_type not in ('lead_or_client', 'contact', 'vendor') then
    return new;
  end if;

  -- Legacy mirror already notified via notify_inbound_message.
  if new.channel_metadata ? 'legacy_message_id' then
    return new;
  end if;

  select relationship_id into v_relationship_id
  from public.conversations where id = new.conversation_id;

  if v_relationship_id is null then
    -- Venue↔vendor ops threads (no customer relationship): Inbox with thread.
    v_link := '/messaging?conversation=' || new.conversation_id::text;
    perform public.create_venue_notification(
      new.venue_id,
      null,
      'message_received',
      'New message',
      case when new.body is not null then left(new.body, 100) else null end,
      v_link,
      '💬'
    );
    return new;
  end if;

  select first_name || coalesce(' ' || last_name, '') into v_display_name
  from public.venue_customer_relationships where id = v_relationship_id;

  select id into v_lead_id from public.leads where relationship_id = v_relationship_id
    order by created_at desc limit 1;
  select id into v_client_id from public.clients where relationship_id = v_relationship_id
    order by created_at desc limit 1;

  if v_client_id is not null then
    select e.id into v_client_event_id
    from public.events e
    where e.client_id = v_client_id
    order by e.event_date asc nulls last
    limit 1;
  end if;

  -- Booked Booking Workspace Conversation tab when an event is linked;
  -- otherwise Lead Conversation while preparing; else Inbox.
  v_link := case
    when v_client_id is not null and v_client_event_id is not null
      then '/clients/' || v_client_id::text || '#messages'
    when v_lead_id is not null
      then '/leads/' || v_lead_id::text || '#messages'
    when v_client_id is not null
      then '/clients/' || v_client_id::text || '#messages'
    else '/messaging?conversation=' || new.conversation_id::text
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
  raise warning '_trigger_conversation_message_notification failed for message %: %', new.id, sqlerrm;
  return new;
end;
$$;
