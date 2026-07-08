-- ============================================================================
-- TR-M7 — Messaging is unreliable for real (multi-staff) venues
-- Resolves docs/trust-risk-register.md TR-M7. Two related failures in the
-- couple-messaging system (lib/messages, sprint 95):
--
-- 1. Every venue-side RLS policy and RPC resolved the caller's venue via
--    `venues.owner_user_id = auth.uid()` only — never updated to
--    `current_user_venue_id()` after Sprint 107 added multi-staff support.
--    Any invited Manager/Coordinator/Staff got a silent, clean "no
--    conversations" instead of the venue's real messages — indistinguishable
--    from actually having none.
-- 2. The inbound-email-reply and delivery-tracking webhooks connect with the
--    cookie/anon client (no session, so RLS rejects every write) and never
--    check the result — both still return {ok:true} on a silent no-op.
-- ============================================================================

-- ---- Part 1: venue resolution — current_user_venue_id() instead of owner-only

drop policy if exists "venue_own_threads" on public.couple_threads;
create policy "venue_own_threads" on public.couple_threads
  for all using (venue_id = current_user_venue_id());

drop policy if exists "venue_own_messages" on public.couple_messages;
create policy "venue_own_messages" on public.couple_messages
  for all using (venue_id = current_user_venue_id());

drop policy if exists "venue_own_message_attachments" on public.couple_message_attachments;
create policy "venue_own_message_attachments" on public.couple_message_attachments
  for all using (
    exists (
      select 1 from public.couple_messages cm
      where cm.id = message_id and cm.venue_id = current_user_venue_id()
    )
  );

create or replace function public.get_couple_inbox()
returns jsonb language plpgsql security definer as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return (
    select jsonb_build_object(
      'threads', coalesce(jsonb_agg(t order by t.last_message_at desc nulls last), '[]'::jsonb),
      'total_unread', (select coalesce(sum(venue_unread), 0) from public.couple_threads where venue_id = v_venue_id)
    )
    from (
      select
        ct.id, ct.client_id, ct.last_message_at, ct.venue_unread, ct.couple_unread,
        c.first_name, c.last_name, c.partner_first_name, c.partner_last_name,
        c.event_date, c.event_type,
        (
          select jsonb_build_object('body', cm.body, 'sender_type', cm.sender_type, 'created_at', cm.created_at)
          from public.couple_messages cm
          where cm.thread_id = ct.id
          order by cm.created_at desc limit 1
        ) as latest_message
      from public.couple_threads ct
      join public.clients c on c.id = ct.client_id
      where ct.venue_id = v_venue_id
      order by ct.last_message_at desc nulls last
    ) t
  );
end;
$$;

create or replace function public.get_couple_thread(p_thread_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (select 1 from public.couple_threads where id = p_thread_id and venue_id = v_venue_id) then
    return '{"error":"not_found"}'::jsonb;
  end if;

  update public.couple_messages set venue_read_at = now()
  where thread_id = p_thread_id and sender_type = 'couple' and venue_read_at is null;

  update public.couple_threads set venue_unread = 0 where id = p_thread_id;

  return (
    select jsonb_build_object(
      'thread', row_to_json(ct.*),
      'messages', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cm.id, 'sender_type', cm.sender_type, 'body', cm.body,
              'created_at', cm.created_at, 'venue_read_at', cm.venue_read_at, 'couple_read_at', cm.couple_read_at,
              'attachments', coalesce(
                (select jsonb_agg(row_to_json(a.*)) from public.couple_message_attachments a where a.message_id = cm.id),
                '[]'::jsonb
              )
            )
            order by cm.created_at asc
          )
          from public.couple_messages cm
          where cm.thread_id = p_thread_id
        ),
        '[]'::jsonb
      )
    )
    from public.couple_threads ct
    join public.clients c on c.id = ct.client_id
    where ct.id = p_thread_id
  );
end;
$$;

create or replace function public.send_couple_message(p_thread_id uuid, p_body text)
returns jsonb language plpgsql security definer as $$
declare
  v_venue_id uuid;
  v_msg_id   uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (select 1 from public.couple_threads where id = p_thread_id and venue_id = v_venue_id) then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  if length(trim(p_body)) = 0 then
    return '{"ok":false,"error":"empty_body"}'::jsonb;
  end if;

  insert into public.couple_messages (thread_id, venue_id, sender_type, body)
  values (p_thread_id, v_venue_id, 'venue', trim(p_body))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

create or replace function public.ensure_couple_thread(p_client_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_venue_id  uuid;
  v_thread_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  insert into public.couple_threads (venue_id, client_id)
  values (v_venue_id, p_client_id)
  on conflict (venue_id, client_id) do nothing
  returning id into v_thread_id;

  if v_thread_id is null then
    select id into v_thread_id from public.couple_threads where venue_id = v_venue_id and client_id = p_client_id;
  end if;

  return jsonb_build_object('ok', true, 'thread_id', v_thread_id);
end;
$$;

create or replace function public.get_couple_unread_count()
returns jsonb language plpgsql security definer as $$
declare
  v_venue_id uuid;
  v_count    int;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"count":0}'::jsonb;
  end if;

  select coalesce(sum(venue_unread), 0) into v_count
  from public.couple_threads where venue_id = v_venue_id;

  return jsonb_build_object('count', v_count);
end;
$$;
