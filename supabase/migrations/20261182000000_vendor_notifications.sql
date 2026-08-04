-- ============================================================================
-- Vendor notification center (in-app history feed)
--
-- Mirrors venue_notifications for the vendor app: mutable inbox with read_at,
-- security-definer helpers, and triggers so write paths surface notifications
-- without patching every RPC.
--
-- Event types:
--   new_message       — venue→vendor portal/system conversation message
--   new_task          — event task becomes vendor_visible / vendor_owned
--   document_shared   — document or floor plan shared_with_vendors flipped on
--   assigned_to_event — new event_vendor_assignments row
-- ============================================================================


-- ── 1. vendor_notifications ───────────────────────────────────────────────────

create table public.vendor_notifications (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors(id) on delete cascade,
  event_id      uuid references public.events(id) on delete set null,
  assignment_id uuid references public.event_vendor_assignments(id) on delete set null,

  type          text not null,
  title         text not null,
  body          text,
  link          text,
  emoji         text,

  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.vendor_notifications enable row level security;

create policy "vendor members read own notifications"
  on public.vendor_notifications for select
  using (vendor_id = public.current_user_vendor_id());

create policy "vendor members update own notifications"
  on public.vendor_notifications for update
  using (vendor_id = public.current_user_vendor_id())
  with check (vendor_id = public.current_user_vendor_id());

-- Inserts only via security definer helpers / service role (triggers).
grant select, update on public.vendor_notifications to authenticated;

create index vendor_notifications_vendor_time
  on public.vendor_notifications (vendor_id, created_at desc);

create index vendor_notifications_unread
  on public.vendor_notifications (vendor_id, read_at)
  where read_at is null;


-- ── 2. create_vendor_notification ─────────────────────────────────────────────
-- Never throws — notification failure must not break the primary write.

create or replace function public.create_vendor_notification(
  p_vendor_id     uuid,
  p_event_id      uuid,
  p_assignment_id uuid,
  p_type          text,
  p_title         text,
  p_body          text,
  p_link          text,
  p_emoji         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_vendor_id is null then
    return;
  end if;

  -- Short-window dedupe so DB triggers + app email paths can both call
  -- create without doubling the inbox row for the same event.
  if exists (
    select 1
    from public.vendor_notifications n
    where n.vendor_id = p_vendor_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and n.created_at > now() - interval '2 minutes'
  ) then
    return;
  end if;

  insert into public.vendor_notifications (
    vendor_id, event_id, assignment_id, type, title, body, link, emoji
  ) values (
    p_vendor_id, p_event_id, p_assignment_id, p_type, p_title, p_body, p_link, p_emoji
  );
exception when others then
  null;
end;
$$;

grant execute on function public.create_vendor_notification(uuid, uuid, uuid, text, text, text, text, text)
  to anon, authenticated, service_role;


-- ── 3. get_vendor_notifications ───────────────────────────────────────────────

create or replace function public.get_vendor_notifications(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id     uuid;
  v_notifications jsonb;
  v_unread_count  int;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select count(*) into v_unread_count
  from public.vendor_notifications
  where vendor_id = v_vendor_id
    and read_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           n.id,
      'type',         n.type,
      'title',        n.title,
      'body',         n.body,
      'link',         n.link,
      'emoji',        n.emoji,
      'eventId',      n.event_id,
      'assignmentId', n.assignment_id,
      'readAt',       n.read_at,
      'createdAt',    n.created_at
    ) order by n.created_at desc
  ), '[]'::jsonb)
  into v_notifications
  from (
    select *
    from public.vendor_notifications
    where vendor_id = v_vendor_id
    order by created_at desc
    limit greatest(coalesce(p_limit, 40), 1)
  ) n;

  return jsonb_build_object(
    'notifications', v_notifications,
    'unreadCount',   v_unread_count
  );
end;
$$;

grant execute on function public.get_vendor_notifications(int) to authenticated;


-- ── 4. mark_vendor_notifications_read ─────────────────────────────────────────
-- Empty array = mark all unread for this vendor.

create or replace function public.mark_vendor_notifications_read(p_notification_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false);
  end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    update public.vendor_notifications
    set read_at = now()
    where vendor_id = v_vendor_id
      and read_at is null;
  else
    update public.vendor_notifications
    set read_at = now()
    where id = any(p_notification_ids)
      and vendor_id = v_vendor_id
      and read_at is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mark_vendor_notifications_read(uuid[]) to authenticated;


-- ── 5. Assigned to event ──────────────────────────────────────────────────────

create or replace function public._trigger_vendor_assigned_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_name  text;
  v_venue_name  text;
  v_couple      text;
begin
  select e.name,
         v.name,
         case
           when c.partner_first_name is not null and c.partner_first_name <> ''
             then c.first_name || ' & ' || c.partner_first_name
           else nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '')
         end
  into v_event_name, v_venue_name, v_couple
  from public.events e
  join public.venues v on v.id = e.venue_id
  left join public.clients c on c.id = e.client_id
  where e.id = NEW.event_id;

  perform public.create_vendor_notification(
    NEW.vendor_id,
    NEW.event_id,
    NEW.id,
    'assigned_to_event',
    'You''ve been selected for an event',
    coalesce(v_couple, v_event_name, 'Upcoming event')
      || coalesce(' · ' || v_venue_name, ''),
    '/vendor/events/' || NEW.id::text,
    '🎉'
  );

  return NEW;
exception when others then
  raise warning '_trigger_vendor_assigned_notification failed for assignment %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_vendor_assigned on public.event_vendor_assignments;
create trigger notify_vendor_assigned
  after insert on public.event_vendor_assignments
  for each row execute function public._trigger_vendor_assigned_notification();


-- ── 6. New message from venue ─────────────────────────────────────────────────

create or replace function public._trigger_vendor_conversation_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
  v_vendor_id     uuid;
  v_event_id      uuid;
  v_kind          text;
  v_venue_name    text;
  v_event_name    text;
  v_sender_label  text;
begin
  if NEW.channel = 'internal_note' then
    return NEW;
  end if;

  select c.event_vendor_assignment_id,
         c.conversation_kind,
         eva.vendor_id,
         eva.event_id,
         v.name,
         e.name
  into v_assignment_id, v_kind, v_vendor_id, v_event_id, v_venue_name, v_event_name
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  join public.venues v on v.id = c.venue_id
  left join public.events e on e.id = eva.event_id
  where c.id = NEW.conversation_id;

  if v_vendor_id is null then
    return NEW;
  end if;

  -- Vendor inbox only cares about inbound-to-vendor messages.
  if v_kind = 'venue_vendor' then
    if NEW.sender_type not in ('venue_staff', 'system') then
      return NEW;
    end if;
    v_sender_label := coalesce(v_venue_name, 'your venue');
  elsif v_kind = 'couple_vendor' then
    if NEW.sender_type not in ('lead_or_client', 'contact') then
      return NEW;
    end if;
    v_sender_label := 'your couple';
  else
    return NEW;
  end if;

  perform public.create_vendor_notification(
    v_vendor_id,
    v_event_id,
    v_assignment_id,
    'new_message',
    'New message from ' || v_sender_label,
    case
      when NEW.body is not null and length(trim(NEW.body)) > 0
        then left(trim(NEW.body), 100)
      else coalesce(v_event_name, 'Open to reply')
    end,
    '/vendor/messages/' || NEW.conversation_id::text,
    '💬'
  );

  return NEW;
exception when others then
  raise warning '_trigger_vendor_conversation_message_notification failed for message %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_vendor_conversation_message on public.conversation_messages;
create trigger notify_vendor_conversation_message
  after insert on public.conversation_messages
  for each row execute function public._trigger_vendor_conversation_message_notification();


-- ── 7. New vendor-visible task ────────────────────────────────────────────────

create or replace function public._trigger_vendor_task_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if NEW.visibility not in ('vendor_visible', 'vendor_owned') then
    return NEW;
  end if;

  -- Only when newly visible to vendors (insert or visibility transition).
  if TG_OP = 'UPDATE'
     and OLD.visibility in ('vendor_visible', 'vendor_owned') then
    return NEW;
  end if;

  for r in
    select eva.id as assignment_id, eva.vendor_id
    from public.event_vendor_assignments eva
    where eva.event_id = NEW.event_id
  loop
    perform public.create_vendor_notification(
      r.vendor_id,
      NEW.event_id,
      r.assignment_id,
      'new_task',
      'New task shared with you',
      NEW.title,
      '/vendor/events/' || r.assignment_id::text || '?tab=tasks',
      '✅'
    );
  end loop;

  return NEW;
exception when others then
  raise warning '_trigger_vendor_task_notification failed for task %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_vendor_task_insert on public.event_tasks;
create trigger notify_vendor_task_insert
  after insert on public.event_tasks
  for each row execute function public._trigger_vendor_task_notification();

drop trigger if exists notify_vendor_task_visibility on public.event_tasks;
create trigger notify_vendor_task_visibility
  after update of visibility on public.event_tasks
  for each row execute function public._trigger_vendor_task_notification();


-- ── 8. Document shared with vendors ───────────────────────────────────────────

create or replace function public._trigger_vendor_document_shared_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not NEW.shared_with_vendors then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.shared_with_vendors is true then
    return NEW;
  end if;
  if NEW.event_id is null then
    return NEW;
  end if;

  for r in
    select eva.id as assignment_id, eva.vendor_id
    from public.event_vendor_assignments eva
    where eva.event_id = NEW.event_id
  loop
    perform public.create_vendor_notification(
      r.vendor_id,
      NEW.event_id,
      r.assignment_id,
      'document_shared',
      'Document shared with you',
      NEW.name,
      '/vendor/events/' || r.assignment_id::text || '?tab=documents',
      '📄'
    );
  end loop;

  return NEW;
exception when others then
  raise warning '_trigger_vendor_document_shared_notification failed for document %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_vendor_document_shared_ins on public.documents;
create trigger notify_vendor_document_shared_ins
  after insert on public.documents
  for each row execute function public._trigger_vendor_document_shared_notification();

drop trigger if exists notify_vendor_document_shared_upd on public.documents;
create trigger notify_vendor_document_shared_upd
  after update of shared_with_vendors on public.documents
  for each row execute function public._trigger_vendor_document_shared_notification();


-- ── 9. Floor plan shared with vendors ─────────────────────────────────────────

create or replace function public._trigger_vendor_floor_plan_shared_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_title text;
begin
  if not NEW.shared_with_vendors then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and OLD.shared_with_vendors is true then
    return NEW;
  end if;
  if NEW.event_id is null then
    return NEW;
  end if;

  v_title := coalesce(nullif(trim(NEW.name), ''), 'Floor plan');

  for r in
    select eva.id as assignment_id, eva.vendor_id
    from public.event_vendor_assignments eva
    where eva.event_id = NEW.event_id
  loop
    perform public.create_vendor_notification(
      r.vendor_id,
      NEW.event_id,
      r.assignment_id,
      'document_shared',
      'Floor plan shared with you',
      v_title,
      '/vendor/floor-plans/' || NEW.id::text,
      '🗺️'
    );
  end loop;

  return NEW;
exception when others then
  raise warning '_trigger_vendor_floor_plan_shared_notification failed for plan %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_vendor_floor_plan_shared_ins on public.floor_plans;
create trigger notify_vendor_floor_plan_shared_ins
  after insert on public.floor_plans
  for each row execute function public._trigger_vendor_floor_plan_shared_notification();

drop trigger if exists notify_vendor_floor_plan_shared_upd on public.floor_plans;
create trigger notify_vendor_floor_plan_shared_upd
  after update of shared_with_vendors on public.floor_plans
  for each row execute function public._trigger_vendor_floor_plan_shared_notification();


notify pgrst, 'reload schema';
