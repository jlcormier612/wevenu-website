-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 1: attachments on Conversations.
--
-- Closes the one real capability gap blocking Conversations from being a
-- complete replacement for the two legacy messaging systems it's meant to
-- absorb: couple-chat (couple_message_attachments) and legacy entity
-- messaging (message_attachments) both support attachments; Conversations
-- has never had any mechanism at all. Mirrors couple_message_attachments'
-- shape (the tighter, more proven of the two precedents — 20MB limit,
-- restricted MIME allowlist) rather than message_attachments' unrestricted
-- one.
-- ============================================================================

create table public.conversation_message_attachments (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.conversation_messages(id) on delete cascade,
  file_url    text not null,
  file_name   text not null,
  file_size   bigint,
  mime_type   text,
  created_at  timestamptz not null default now()
);

create index conversation_message_attachments_msg on public.conversation_message_attachments (message_id);

alter table public.conversation_message_attachments enable row level security;

create policy conversation_message_attachments_venue on public.conversation_message_attachments
  for all
  using (exists (
    select 1 from public.conversation_messages cm
    where cm.id = message_id and cm.venue_id = public.current_user_venue_id()
  ))
  with check (exists (
    select 1 from public.conversation_messages cm
    where cm.id = message_id and cm.venue_id = public.current_user_venue_id()
  ));

grant select, insert, delete on public.conversation_message_attachments to authenticated;

-- Reuses the couple-messages bucket under a conversations/ prefix rather
-- than provisioning a second bucket with duplicated RLS policies for the
-- same 20MB/restricted-type shape.
create policy conversation_attachments_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'couple-messages' and (storage.foldername(name))[1] = 'conversations');

-- ── add_conversation_message_attachment — venue-side RPC ───────────────────
-- Mirrors add_message_attachment's shape exactly, using current_user_venue_id()
-- (the convention every other Conversations RPC already uses) rather than
-- the older owner_user_id lookup the couple-messages version predates.

create or replace function public.add_conversation_message_attachment(
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
  v_venue_id uuid;
  v_att_id   uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not exists (
    select 1 from public.conversation_messages
    where id = p_message_id and venue_id = v_venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.conversation_message_attachments (message_id, file_url, file_name, file_size, mime_type)
  values (p_message_id, p_file_url, p_file_name, p_file_size, p_mime_type)
  returning id into v_att_id;

  return jsonb_build_object('ok', true, 'attachment_id', v_att_id);
end;
$$;

grant execute on function public.add_conversation_message_attachment(uuid, text, text, bigint, text) to authenticated;

-- ── send_conversation_message now allows an empty body ─────────────────────
-- An attachment-only message ("here's the floor plan," no text) is created
-- with an empty body, then a file is attached to it via
-- add_conversation_message_attachment right after — matching the same
-- allowance couple_messages already made for the same reason.

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_body text,
  p_channel text default 'portal',
  p_provider_id text default null,
  p_status text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venue_id uuid;
  v_msg_id   uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (select 1 from public.conversations where id = p_conversation_id and venue_id = v_venue_id) then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body, provider_id, status)
  values (p_conversation_id, v_venue_id, 'venue_staff', coalesce(nullif(p_channel, ''), 'portal'), trim(coalesce(p_body, '')), p_provider_id, p_status)
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

-- ── get_conversation now includes each message's attachments ───────────────

create or replace function public.get_conversation(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venue_id uuid;
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

  update public.conversations set venue_unread = 0 where id = p_conversation_id;

  return (
    select jsonb_build_object(
      'conversation_id', p_conversation_id,
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
            order by cm.sent_at asc
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

notify pgrst, 'reload schema';
