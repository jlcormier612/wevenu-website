-- ============================================================================
-- Notification action deep links
--
-- "Reply to message" must open the Conversation surface on the Lead/Booking
-- record when that surface exists, or Inbox with the exact conversation
-- selected otherwise. Also align other venue notification action links to
-- Booking Workspace hash tabs (#playbook, #documents, …) instead of the
-- unused ?tab= query that EventDetail never reads.
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

  -- Booking/Lead Conversation tab when the relationship has that surface;
  -- otherwise Inbox with the exact conversation loaded.
  v_link := case
    when v_client_id is not null then '/clients/' || v_client_id::text || '#messages'
    when v_lead_id   is not null then '/leads/' || v_lead_id::text || '#messages'
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

-- Legacy messages table (still used by some inbound paths).
create or replace function public._trigger_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.message_threads%rowtype;
  v_link   text;
begin
  if NEW.direction != 'inbound' then return NEW; end if;

  select * into v_thread
  from public.message_threads
  where id = NEW.thread_id;

  v_link := case
    when v_thread.event_id is not null then '/events/' || v_thread.event_id::text || '#messages'
    when v_thread.lead_id  is not null then '/leads/' || v_thread.lead_id::text || '#messages'
    else '/messaging'
  end;

  perform public.create_venue_notification(
    NEW.venue_id,
    v_thread.event_id,
    'message_received',
    'New message from ' || coalesce(NEW.from_name, 'your couple'),
    case when NEW.body is not null then left(NEW.body, 100) else null end,
    v_link,
    '💬'
  );

  return NEW;
end;
$$;

create or replace function public._trigger_task_completed_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is not distinct from NEW.status then return NEW; end if;
  if NEW.status != 'complete' then return NEW; end if;
  if NEW.completed_by not in ('couple', 'vendor') then return NEW; end if;
  if NEW.event_id is null then return NEW; end if;

  perform public.create_venue_notification(
    NEW.venue_id,
    NEW.event_id,
    case NEW.completed_by
      when 'vendor' then 'task_completed_vendor'
      else 'task_completed_couple'
    end,
    case NEW.completed_by
      when 'vendor' then 'Vendor completed a task'
      else 'Couple completed a task'
    end,
    NEW.title,
    '/events/' || NEW.event_id::text || '#playbook',
    '✅'
  );

  return NEW;
end;
$$;

create or replace function public._trigger_rsvp_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if OLD.rsvp_status is not distinct from NEW.rsvp_status then return NEW; end if;
  if NEW.rsvp_status not in ('attending', 'declined') then return NEW; end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id  = NEW.client_id
    and e.venue_id   = NEW.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc
  limit 1;

  perform public.create_venue_notification(
    NEW.venue_id,
    v_event_id,
    'rsvp_received',
    NEW.first_name || coalesce(' ' || NEW.last_name, '') || ' RSVP''d',
    case NEW.rsvp_status
      when 'attending' then 'Confirmed attending'
      when 'declined'  then 'Not able to attend'
      else 'Responded to invitation'
    end,
    case when v_event_id is not null
         then '/events/' || v_event_id::text || '#documents'
         else '/events'
    end,
    case NEW.rsvp_status when 'attending' then '🎉' else '💌' end
  );

  return NEW;
end;
$$;

create or replace function public._trigger_feedback_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_venue_notification(
    NEW.venue_id,
    NEW.event_id,
    'feedback_received',
    'Couple feedback received',
    case
      when NEW.overall_rating = 5 then 'Perfect experience — 5 stars 💗'
      when NEW.overall_rating = 4 then 'Wonderful experience — 4 stars'
      when NEW.overall_rating = 3 then 'Good experience — 3 stars'
      else 'Review needs attention — ' || NEW.overall_rating || ' stars'
    end,
    '/events/' || NEW.event_id::text || '#feedback',
    case when NEW.overall_rating >= 4 then '💗' else '⚠️' end
  );
  return NEW;
end;
$$;

create or replace function public._trigger_referral_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_venue_notification(
    NEW.venue_id,
    NEW.event_id,
    'referral_received',
    'Referral received',
    NEW.referral_name || ' was referred by your couple',
    '/events/' || NEW.event_id::text || '#feedback',
    '🤝'
  );
  return NEW;
end;
$$;

notify pgrst, 'reload schema';
