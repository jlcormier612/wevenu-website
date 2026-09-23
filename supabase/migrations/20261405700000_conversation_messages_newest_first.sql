-- Venue Lead/Inbox conversation thread: newest message first.
-- Inbox conversation *list* ordering (most recent activity) is unchanged.
-- Couple/vendor portal RPCs keep their own ordering.

create or replace function public.get_conversation(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venue_id uuid;
  v_needs_response boolean;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (select 1 from public.conversations where id = p_conversation_id and venue_id = v_venue_id) then
    return '{"error":"not_found"}'::jsonb;
  end if;

  update public.conversation_messages set venue_read_at = now()
  where conversation_id = p_conversation_id
    and sender_type in ('lead_or_client', 'contact', 'vendor')
    and venue_read_at is null;

  update public.conversations
     set venue_unread = 0
   where id = p_conversation_id
  returning needs_response into v_needs_response;

  return (
    select jsonb_build_object(
      'conversation_id', p_conversation_id,
      'needs_response', coalesce(v_needs_response, false),
      'messages', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', cm.id, 'sender_type', cm.sender_type, 'channel', cm.channel,
              'body', cm.body, 'sent_at', cm.sent_at,
              'venue_read_at', cm.venue_read_at, 'contact_read_at', cm.contact_read_at,
              'status', cm.status, 'failure_reason', cm.failure_reason,
              'channel_metadata', cm.channel_metadata,
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
            order by cm.sent_at desc
          )
          from public.conversation_messages cm
          where cm.conversation_id = p_conversation_id
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;
