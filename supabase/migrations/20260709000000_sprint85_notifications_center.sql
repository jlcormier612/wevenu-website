-- ============================================================================
-- Sprint 85: Notifications Center
--
-- "You're generating a huge amount of activity now. You need a central
--  notification system."
--
-- Architecture:
--   venue_notifications  — the in-app coordinator inbox (mutable, has read_at)
--   notification_log     — unchanged; remains the email/SMS audit trail
--
-- Notifications are created by DB triggers on key tables, so every code path
-- that writes data automatically surfaces it to the coordinator. No existing
-- RPCs need to be patched.
--
-- Changes:
--   1.  venue_notifications table + indexes + RLS
--   2.  create_venue_notification()     — secure helper, never throws
--   3.  get_venue_notifications()       — coordinator inbox RPC
--   4.  mark_notifications_read()       — mark one or all as read
--   5.  _trigger_new_lead_notification()         + trigger on leads
--   6.  _trigger_rsvp_notification()            + trigger on couple_guests
--   7.  _trigger_task_completed_notification()  + trigger on event_tasks
--   8.  _trigger_vendor_checkin_notification()  + trigger on event_vendor_assignments
--   9.  _trigger_feedback_notification()        + trigger on couple_venue_feedback
--  10.  _trigger_referral_notification()        + trigger on couple_referrals
--  11.  _trigger_message_notification()         + trigger on messages
-- ============================================================================


-- ── 1. venue_notifications ────────────────────────────────────────────────────
-- Mutable in-app inbox. Separate from notification_log (email audit trail).

create table public.venue_notifications (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  event_id   uuid references public.events(id) on delete set null,

  type       text not null,     -- rsvp_received | task_completed | vendor_checked_in | etc.
  title      text not null,
  body       text,
  link       text,              -- app-relative deep link (/events/xxx?tab=playbook)
  emoji      text,              -- displayed next to title

  read_at    timestamptz,       -- null = unread

  created_at timestamptz not null default now()
);

alter table public.venue_notifications enable row level security;

create policy "venue owner reads own notifications"
  on public.venue_notifications for select
  using (exists (
    select 1 from public.venues v
    where v.id = venue_notifications.venue_id
      and v.owner_user_id = auth.uid()
  ));

create policy "venue owner updates own notifications"
  on public.venue_notifications for update
  using (exists (
    select 1 from public.venues v
    where v.id = venue_notifications.venue_id
      and v.owner_user_id = auth.uid()
  ));

-- Service role inserts via triggers; no direct-insert RLS policy needed.
grant select, update on public.venue_notifications to authenticated;

create index venue_notifications_venue_time
  on public.venue_notifications (venue_id, created_at desc);

create index venue_notifications_unread
  on public.venue_notifications (venue_id, read_at)
  where read_at is null;


-- ── 2. create_venue_notification ─────────────────────────────────────────────
-- Secure helper. Called from trigger functions. Never throws — notification
-- failure must never break the primary operation.

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
begin
  insert into public.venue_notifications (venue_id, event_id, type, title, body, link, emoji)
  values (p_venue_id, p_event_id, p_type, p_title, p_body, p_link, p_emoji);
exception when others then
  null; -- never break the caller
end;
$$;

-- Callable by triggers (which run as session user / service role)
grant execute on function public.create_venue_notification(uuid, uuid, text, text, text, text, text)
  to anon, authenticated;


-- ── 3. get_venue_notifications ────────────────────────────────────────────────
-- Coordinator fetches their inbox. Returns notifications + unread count.

create or replace function public.get_venue_notifications(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id     uuid;
  v_notifications jsonb;
  v_unread_count  int;
begin
  select v.id into v_venue_id
  from public.venues v
  where v.owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  select count(*) into v_unread_count
  from public.venue_notifications
  where venue_id = v_venue_id
    and read_at  is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',        n.id,
      'type',      n.type,
      'title',     n.title,
      'body',      n.body,
      'link',      n.link,
      'emoji',     n.emoji,
      'eventId',   n.event_id,
      'readAt',    n.read_at,
      'createdAt', n.created_at
    ) order by n.created_at desc
  ), '[]'::jsonb)
  into v_notifications
  from (
    select * from public.venue_notifications
    where venue_id = v_venue_id
    order by created_at desc
    limit p_limit
  ) n;

  return jsonb_build_object(
    'notifications', v_notifications,
    'unreadCount',   v_unread_count
  );
end;
$$;

grant execute on function public.get_venue_notifications(int) to authenticated;


-- ── 4. mark_notifications_read ────────────────────────────────────────────────
-- Pass specific IDs to mark them read, or empty array to mark all.

create or replace function public.mark_notifications_read(p_notification_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select v.id into v_venue_id
  from public.venues v
  where v.owner_user_id = auth.uid();
  if not found then return jsonb_build_object('ok', false); end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    -- Mark all unread notifications for this venue as read
    update public.venue_notifications
    set read_at = now()
    where venue_id = v_venue_id
      and read_at  is null;
  else
    update public.venue_notifications
    set read_at = now()
    where id      = any(p_notification_ids)
      and venue_id = v_venue_id
      and read_at  is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;


-- ── 5. New lead notification ──────────────────────────────────────────────────

create or replace function public._trigger_new_lead_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_venue_notification(
    NEW.venue_id,
    null,
    'new_lead',
    'New inquiry from ' || NEW.first_name || coalesce(' ' || NEW.last_name, ''),
    coalesce(NEW.event_type, 'Event inquiry')
      || case when NEW.event_date is not null
              then ' · ' || to_char(NEW.event_date, 'Mon DD, YYYY')
              else '' end,
    '/leads',
    '✨'
  );
  return NEW;
end;
$$;

create trigger notify_new_lead
  after insert on public.leads
  for each row execute function public._trigger_new_lead_notification();


-- ── 6. RSVP received notification ────────────────────────────────────────────
-- Fires when a guest changes their rsvp_status to attending/declined.

create or replace function public._trigger_rsvp_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  -- Only fire when rsvp_status actually changed to a definitive answer
  if OLD.rsvp_status is not distinct from NEW.rsvp_status then return NEW; end if;
  if NEW.rsvp_status not in ('attending', 'declined') then return NEW; end if;

  -- Find the most relevant event for this guest's venue + client
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
         then '/events/' || v_event_id::text || '?tab=final-details'
         else '/events'
    end,
    case NEW.rsvp_status when 'attending' then '🎉' else '💌' end
  );

  return NEW;
end;
$$;

create trigger notify_rsvp
  after update of rsvp_status on public.couple_guests
  for each row execute function public._trigger_rsvp_notification();


-- ── 7. Task completed by couple or vendor ────────────────────────────────────

create or replace function public._trigger_task_completed_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when transitioning TO complete
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
    '/events/' || NEW.event_id::text || '?tab=playbook',
    '✅'
  );

  return NEW;
end;
$$;

create trigger notify_task_completed
  after update of status on public.event_tasks
  for each row execute function public._trigger_task_completed_notification();


-- ── 8. Vendor check-in ───────────────────────────────────────────────────────
-- Fires when checked_in_at transitions from null → a timestamp.

create or replace function public._trigger_vendor_checkin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_name text;
begin
  -- Only fire when checked_in_at is set, not cleared
  if OLD.checked_in_at is not null then return NEW; end if;
  if NEW.checked_in_at is null then return NEW; end if;

  select name into v_vendor_name
  from public.vendors
  where id = NEW.vendor_id;

  perform public.create_venue_notification(
    NEW.venue_id,
    NEW.event_id,
    'vendor_checked_in',
    coalesce(v_vendor_name, 'Vendor') || ' has arrived',
    'Checked in and ready for setup',
    '/events/' || NEW.event_id::text || '/today',
    '🤝'
  );

  return NEW;
end;
$$;

create trigger notify_vendor_checkin
  after update of checked_in_at on public.event_vendor_assignments
  for each row execute function public._trigger_vendor_checkin_notification();


-- ── 9. Couple feedback received ───────────────────────────────────────────────

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
    '/events/' || NEW.event_id::text || '?tab=feedback',
    case when NEW.overall_rating >= 4 then '💗' else '⚠️' end
  );
  return NEW;
end;
$$;

create trigger notify_feedback
  after insert on public.couple_venue_feedback
  for each row execute function public._trigger_feedback_notification();


-- ── 10. Referral received ─────────────────────────────────────────────────────

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
    '/events/' || NEW.event_id::text || '?tab=feedback',
    '💍'
  );
  return NEW;
end;
$$;

create trigger notify_referral
  after insert on public.couple_referrals
  for each row execute function public._trigger_referral_notification();


-- ── 11. Inbound message received ──────────────────────────────────────────────
-- direction = 'inbound' means the message came FROM the couple/lead TO the venue.

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
    when v_thread.event_id  is not null then '/events/' || v_thread.event_id::text
    when v_thread.lead_id   is not null then '/leads'
    else '/messages'
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

create trigger notify_inbound_message
  after insert on public.messages
  for each row execute function public._trigger_message_notification();


notify pgrst, 'reload schema';
