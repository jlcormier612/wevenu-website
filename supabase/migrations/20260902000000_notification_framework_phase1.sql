-- ============================================================================
-- Notification Framework Migration — Phase 1
--
-- Per docs/platform-orchestration-architecture.md and
-- docs/platform-event-adoption-plan.md: the first live Platform Event
-- consumer. Reacts to a trigger on platform_events itself — not on any
-- upstream table — so it behaves identically regardless of whether the
-- row came from a SQL trigger (Booking/Event) or application code
-- (Requests). This is deliberately the *only* place "which Platform Event
-- types produce a notification" is decided; migrating one of the 9
-- existing trigger-based notifications later is exactly this: add one
-- case here, then remove the old trigger, never redesign this mechanism.
--
-- Scope: only the 8 Platform Events already wrapped in Phase 1
-- (Booking.Confirmed, Event.Completed, Request.Created/Submitted/Reviewed/
-- Completed/Assigned/Reassigned). Every one of the 9 pre-existing
-- notification triggers (new_lead, rsvp_received, task_completed_*,
-- vendor_checked_in, vendor_selected, feedback_received, referral_received,
-- message_received) is completely untouched by this migration — none of
-- those event types are handled by the CASE below, so they produce nothing
-- here and keep firing exactly as they always have, from their own
-- trigger, unchanged.
--
-- Reuses create_venue_notification() exactly as-is (same table, same
-- venue_notification_preferences gating, same schema) — these 8 new types
-- aren't in that function's preference CASE statement, so they fall
-- through to its existing "no row / unmapped type → enabled" default,
-- with no change to venue_notification_preferences' own columns.
--
-- p_event_id (venue_notifications.event_id, a real FK to events) is only
-- ever the entity's own id for the two Booking/Event cases, where
-- entity_id genuinely is an events.id. For every Request case, entity_id
-- is a requests.id, not an events.id — passing it as p_event_id would
-- violate the foreign key, so this passes null instead, the same choice
-- notify_new_lead already makes for leads (which also aren't tied to one
-- specific event row).
-- ============================================================================

create or replace function public._trigger_notification_from_platform_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type  text;
  v_title text;
  v_body  text;
  v_link  text;
  v_emoji text;
  v_event_id uuid;
  v_display_name text;
  v_request_title text;
begin
  case new.event_type

    when 'Booking.Confirmed' then
      select e.name into v_display_name from public.events e where e.id = new.entity_id;

      v_type     := 'booking_confirmed';
      v_title    := 'Booking confirmed';
      v_body     := coalesce(v_display_name, 'A booking') || ' is now confirmed.';
      v_link     := '/events/' || new.entity_id::text;
      v_emoji    := '🎉';
      v_event_id := new.entity_id;

    when 'Event.Completed' then
      select e.name into v_display_name from public.events e where e.id = new.entity_id;

      v_type     := 'event_completed';
      v_title    := 'Event completed';
      v_body     := coalesce(v_display_name, 'A wedding') || ' is marked complete.';
      v_link     := '/events/' || new.entity_id::text;
      v_emoji    := '🎊';
      v_event_id := new.entity_id;

    when 'Request.Created' then
      select title into v_request_title from public.requests where id = new.entity_id;
      v_type  := 'request_created';
      v_title := 'Request created';
      v_body  := coalesce(v_request_title, 'A request');
      v_link  := '/requests/' || new.entity_id::text;
      v_emoji := '📋';

    when 'Request.Submitted' then
      select title into v_request_title from public.requests where id = new.entity_id;
      v_type  := 'request_submitted';
      v_title := 'Client submitted a response';
      v_body  := coalesce(v_request_title, 'A request');
      v_link  := '/requests/' || new.entity_id::text;
      v_emoji := '📨';

    when 'Request.Reviewed' then
      select title into v_request_title from public.requests where id = new.entity_id;
      v_type  := 'request_reviewed';
      v_title := 'Request reviewed';
      v_body  := coalesce(v_request_title, 'A request');
      v_link  := '/requests/' || new.entity_id::text;
      v_emoji := '👀';

    when 'Request.Completed' then
      select title into v_request_title from public.requests where id = new.entity_id;
      v_type  := 'request_completed';
      v_title := 'Request completed';
      v_body  := coalesce(v_request_title, 'A request');
      v_link  := '/requests/' || new.entity_id::text;
      v_emoji := '✅';

    when 'Request.Assigned' then
      select title into v_request_title from public.requests where id = new.entity_id;
      v_type  := 'request_assigned';
      v_title := 'Request assigned';
      v_body  := coalesce(v_request_title, 'A request');
      v_link  := '/requests/' || new.entity_id::text;
      v_emoji := '👤';

    when 'Request.Reassigned' then
      select title into v_request_title from public.requests where id = new.entity_id;
      v_type  := 'request_reassigned';
      v_title := 'Request reassigned';
      v_body  := coalesce(v_request_title, 'A request');
      v_link  := '/requests/' || new.entity_id::text;
      v_emoji := '🔄';

    else
      -- Every other Platform Event type (none exist yet beyond the 8
      -- above) produces no notification here. This is the one line a
      -- future migration of an existing trigger-based notification adds
      -- a case above, then retires the old trigger — never a redesign.
      v_type := null;

  end case;

  if v_type is not null then
    perform public.create_venue_notification(
      new.venue_id, v_event_id, v_type, v_title, v_body, v_link, v_emoji
    );
  end if;

  return new;
end;
$$;

create trigger notify_from_platform_event
  after insert on public.platform_events
  for each row execute function public._trigger_notification_from_platform_event();

notify pgrst, 'reload schema';
