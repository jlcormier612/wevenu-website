-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 2: couple portal reads/writes
-- through Conversations.
--
-- The portal side of the same gap Milestone 1 closed on the venue side:
-- get_portal_conversation/send_portal_conversation_message have existed
-- since Phase 2A but were never given attachment support, so the portal API
-- routes could not be swapped onto them without a feature regression
-- against couple_messages (which has supported attachments since Sprint
-- 95.5). This migration brings the portal RPCs to parity with Milestone 1's
-- venue-side ones so components/portal/message-section.tsx's existing
-- upload/attach flow can be re-pointed at Conversations with zero UI changes.
-- ============================================================================

-- ── add_portal_conversation_message_attachment — token-authenticated ────────
-- Mirrors add_portal_message_attachment's token/ownership check exactly,
-- scoped to conversation_messages instead of couple_messages.

create or replace function public.add_portal_conversation_message_attachment(
  p_token      text,
  p_message_id uuid,
  p_file_url   text,
  p_file_name  text,
  p_file_size  bigint default null,
  p_mime_type  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_venue_id  uuid;
  v_relationship_id uuid;
  v_att_id    uuid;
begin
  select cps.client_id, cps.venue_id into v_client_id, v_venue_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_relationship_id := public.resolve_relationship_id_for_client(v_client_id);
  if v_relationship_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_relationship');
  end if;

  if not exists (
    select 1 from public.conversation_messages cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.id = p_message_id
      and c.relationship_id = v_relationship_id
      and cm.venue_id = v_venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.conversation_message_attachments (message_id, file_url, file_name, file_size, mime_type)
  values (p_message_id, p_file_url, p_file_name, p_file_size, p_mime_type)
  returning id into v_att_id;

  return jsonb_build_object('ok', true, 'attachment_id', v_att_id);
end;
$$;

grant execute on function public.add_portal_conversation_message_attachment(text, uuid, text, text, bigint, text) to anon, authenticated;

-- ── send_portal_conversation_message now allows an empty body ──────────────
-- Same allowance Milestone 1 made venue-side: an attachment-only message is
-- created with an empty body, then a file is attached right after.

create or replace function public.send_portal_conversation_message(
  p_token text,
  p_body text,
  p_has_attachment boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_client_id  uuid;
  v_venue_id   uuid;
  v_access_level text;
  v_relationship_id uuid;
  v_conversation_id uuid;
  v_msg_id     uuid;
begin
  select cps.client_id, cps.venue_id, cps.access_level
  into v_client_id, v_venue_id, v_access_level
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return '{"ok":false,"error":"invalid_token"}'::jsonb;
  end if;

  if v_access_level = 'view_only' then
    return '{"ok":false,"error":"insufficient_access"}'::jsonb;
  end if;

  if length(trim(coalesce(p_body, ''))) = 0 and not p_has_attachment then
    return '{"ok":false,"error":"empty_body"}'::jsonb;
  end if;

  v_relationship_id := public.resolve_relationship_id_for_client(v_client_id);
  if v_relationship_id is null then
    return '{"ok":false,"error":"no_relationship"}'::jsonb;
  end if;

  select id into v_conversation_id from public.conversations where relationship_id = v_relationship_id;
  if v_conversation_id is null then
    return '{"ok":false,"error":"no_conversation"}'::jsonb;
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body)
  values (v_conversation_id, v_venue_id, 'lead_or_client', 'portal', trim(coalesce(p_body, '')))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

grant execute on function public.send_portal_conversation_message(text, text, boolean) to anon, authenticated;

-- ── get_portal_conversation now includes venue_read_at + attachments ───────
-- venue_read_at is the portal-side equivalent of couple_messages'
-- venue_read_at ("has the venue seen this") — needed to reconstruct
-- message-section.tsx's "Seen by venue" read receipt, which the original
-- portal RPC never returned because nothing consumed it yet.

create or replace function public.get_portal_conversation(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_client_id uuid;
  v_venue_id  uuid;
  v_relationship_id uuid;
  v_conversation_id uuid;
begin
  select cps.client_id, cps.venue_id into v_client_id, v_venue_id
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  limit 1;

  if v_client_id is null then
    return '{"error":"invalid_token"}'::jsonb;
  end if;

  v_relationship_id := public.resolve_relationship_id_for_client(v_client_id);
  if v_relationship_id is null then
    return '{"error":"no_relationship"}'::jsonb;
  end if;

  select id into v_conversation_id from public.conversations where relationship_id = v_relationship_id;
  if v_conversation_id is null then
    return '{"error":"no_conversation"}'::jsonb;
  end if;

  update public.conversation_messages set contact_read_at = now()
  where conversation_id = v_conversation_id
    and sender_type = 'venue_staff'
    and contact_read_at is null;

  update public.conversations set contact_unread = 0 where id = v_conversation_id;

  return (
    select jsonb_build_object(
      'conversation_id', v_conversation_id,
      'messages', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cm.id, 'sender_type', cm.sender_type, 'body', cm.body,
              'sent_at', cm.sent_at, 'contact_read_at', cm.contact_read_at,
              'venue_read_at', cm.venue_read_at,
              'attachments', coalesce(
                (select jsonb_agg(jsonb_build_object(
                    'id', a.id, 'fileUrl', a.file_url, 'fileName', a.file_name,
                    'fileSize', a.file_size, 'mimeType', a.mime_type
                  ) order by a.created_at)
                 from public.conversation_message_attachments a
                 where a.message_id = cm.id),
                '[]'::jsonb
              )
            )
            order by cm.sent_at asc
          )
          from public.conversation_messages cm
          where cm.conversation_id = v_conversation_id
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

notify pgrst, 'reload schema';
