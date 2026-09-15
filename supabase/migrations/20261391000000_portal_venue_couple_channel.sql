-- Portal venue↔couple routing + channel visibility
--
-- Vendor Network allows couple_vendor_inquiry rows to share relationship_id
-- with venue_couple. Portal get/send previously selected by relationship_id
-- alone and could land on the wrong conversation. SMS already scopes via
-- findOrCreateVenueCoupleConversation; portal RPCs must match that rule.
--
-- Also return conversation_messages.channel so the couple portal can label
-- mixed-channel history (portal / email / sms) without redesigning compose.

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

  select id into v_conversation_id
  from public.conversations
  where relationship_id = v_relationship_id
    and conversation_kind = 'venue_couple';
  if v_conversation_id is null then
    return '{"error":"no_conversation"}'::jsonb;
  end if;

  update public.conversation_messages set contact_read_at = now()
  where conversation_id = v_conversation_id
    and sender_type = 'venue_staff'
    and contact_read_at is null
    and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');

  update public.conversations set contact_unread = 0 where id = v_conversation_id;

  return (
    select jsonb_build_object(
      'conversation_id', v_conversation_id,
      'messages', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cm.id, 'sender_type', cm.sender_type, 'channel', cm.channel,
              'body', cm.body,
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
            and cm.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

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

  select id into v_conversation_id
  from public.conversations
  where relationship_id = v_relationship_id
    and conversation_kind = 'venue_couple';
  if v_conversation_id is null then
    return '{"ok":false,"error":"no_conversation"}'::jsonb;
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body)
  values (v_conversation_id, v_venue_id, 'lead_or_client', 'portal', trim(coalesce(p_body, '')))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;
