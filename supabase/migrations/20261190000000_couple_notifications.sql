-- ============================================================================
-- Couple notification center (message-only MVP)
--
-- Shared household inbox owned by client_id (not per-participant). Portal
-- access is token-validated via security-definer RPCs (same pattern as
-- get_couple_todos / get_couple_documents). Inserts come from a
-- conversation_messages trigger and optional app dual-writes; 2-minute
-- dedupe matches vendor_notifications.
--
-- Event types (MVP):
--   new_message — inbound-to-couple on venue_couple or couple_vendor
-- ============================================================================


-- ── 1. couple_notifications ───────────────────────────────────────────────────

create table if not exists public.couple_notifications (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  type             text not null,
  title            text not null,
  body             text,
  link             text,
  conversation_id  uuid references public.conversations(id) on delete set null,
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  constraint couple_notifications_type_check check (type in ('new_message'))
);

alter table public.couple_notifications enable row level security;

-- No direct table policies for anon/authenticated — portal clients read/write
-- only through token-gated security definer RPCs. Service role bypasses RLS.

create index if not exists couple_notifications_client_time
  on public.couple_notifications (client_id, created_at desc);

create index if not exists couple_notifications_unread
  on public.couple_notifications (client_id, read_at)
  where read_at is null;


-- ── 2. create_couple_notification ─────────────────────────────────────────────
-- Never throws — notification failure must not break the primary write.

create or replace function public.create_couple_notification(
  p_client_id       uuid,
  p_type            text,
  p_title           text,
  p_body            text,
  p_link            text,
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_id is null then
    return;
  end if;

  if p_type is distinct from 'new_message' then
    return;
  end if;

  -- Short-window dedupe so DB triggers + app email paths can both call
  -- create without doubling the inbox row for the same message.
  if exists (
    select 1
    from public.couple_notifications n
    where n.client_id = p_client_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and coalesce(n.conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and n.created_at > now() - interval '2 minutes'
  ) then
    return;
  end if;

  insert into public.couple_notifications (
    client_id, type, title, body, link, conversation_id
  ) values (
    p_client_id, p_type, p_title, p_body, p_link, p_conversation_id
  );
exception when others then
  null;
end;
$$;

grant execute on function public.create_couple_notification(uuid, text, text, text, text, uuid)
  to anon, authenticated, service_role;


-- ── 3. get_couple_notifications ───────────────────────────────────────────────

create or replace function public.get_couple_notifications(
  p_token text,
  p_limit int default 40
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids           record;
  v_notifications jsonb;
  v_unread_count  int;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select count(*) into v_unread_count
  from public.couple_notifications
  where client_id = v_ids.client_id
    and read_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',             n.id,
      'type',           n.type,
      'title',          n.title,
      'body',           n.body,
      'link',           n.link,
      'conversationId', n.conversation_id,
      'readAt',         n.read_at,
      'createdAt',      n.created_at
    ) order by n.created_at desc
  ), '[]'::jsonb)
  into v_notifications
  from (
    select *
    from public.couple_notifications
    where client_id = v_ids.client_id
    order by created_at desc
    limit greatest(coalesce(p_limit, 40), 1)
  ) n;

  return jsonb_build_object(
    'notifications', v_notifications,
    'unreadCount',   v_unread_count
  );
end;
$$;

grant execute on function public.get_couple_notifications(text, int) to anon, authenticated;


-- ── 4. mark_couple_notifications_read ─────────────────────────────────────────
-- Empty array = mark all unread for this client.

create or replace function public.mark_couple_notifications_read(
  p_token text,
  p_notification_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    update public.couple_notifications
    set read_at = now()
    where client_id = v_ids.client_id
      and read_at is null;
  else
    update public.couple_notifications
    set read_at = now()
    where id = any(p_notification_ids)
      and client_id = v_ids.client_id
      and read_at is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.mark_couple_notifications_read(text, uuid[]) to anon, authenticated;


-- ── 5. clear_couple_notifications ─────────────────────────────────────────────
-- Empty array = clear all for this client; otherwise delete matching ids.

create or replace function public.clear_couple_notifications(
  p_token text,
  p_notification_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    delete from public.couple_notifications
    where client_id = v_ids.client_id;
  else
    delete from public.couple_notifications
    where id = any(p_notification_ids)
      and client_id = v_ids.client_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.clear_couple_notifications(text, uuid[]) to anon, authenticated;


-- ── 6. Inbound-to-couple conversation messages ────────────────────────────────
-- venue_couple: venue_staff / system → couple
-- couple_vendor: vendor → couple

create or replace function public._trigger_couple_conversation_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind          text;
  v_relationship  uuid;
  v_assignment_id uuid;
  v_venue_id      uuid;
  v_client_id     uuid;
  v_venue_name    text;
  v_vendor_name   text;
  v_sender_label  text;
  v_link          text;
begin
  if NEW.channel = 'internal_note' then
    return NEW;
  end if;

  select c.conversation_kind,
         c.relationship_id,
         c.event_vendor_assignment_id,
         c.venue_id,
         v.name
  into v_kind, v_relationship, v_assignment_id, v_venue_id, v_venue_name
  from public.conversations c
  join public.venues v on v.id = c.venue_id
  where c.id = NEW.conversation_id;

  if v_kind = 'venue_couple' then
    if NEW.sender_type not in ('venue_staff', 'system') then
      return NEW;
    end if;

    select cl.id into v_client_id
    from public.clients cl
    where cl.relationship_id = v_relationship
    limit 1;

    v_sender_label := coalesce(nullif(trim(v_venue_name), ''), 'your venue');
    v_link := '#messages';

  elsif v_kind = 'couple_vendor' then
    if NEW.sender_type <> 'vendor' then
      return NEW;
    end if;

    select e.client_id, coalesce(nullif(trim(vd.business_name), ''), 'your vendor')
    into v_client_id, v_vendor_name
    from public.event_vendor_assignments eva
    join public.events e on e.id = eva.event_id
    join public.vendors vd on vd.id = eva.vendor_id
    where eva.id = v_assignment_id;

    v_sender_label := coalesce(v_vendor_name, 'your vendor');
    v_link := '#vendors';

  else
    return NEW;
  end if;

  if v_client_id is null then
    return NEW;
  end if;

  perform public.create_couple_notification(
    v_client_id,
    'new_message',
    'New message from ' || v_sender_label,
    case
      when NEW.body is not null and length(trim(NEW.body)) > 0
        then left(trim(NEW.body), 100)
      else 'Open to reply'
    end,
    v_link,
    NEW.conversation_id
  );

  return NEW;
exception when others then
  raise warning '_trigger_couple_conversation_message_notification failed for message %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists notify_couple_conversation_message on public.conversation_messages;
create trigger notify_couple_conversation_message
  after insert on public.conversation_messages
  for each row execute function public._trigger_couple_conversation_message_notification();


notify pgrst, 'reload schema';
