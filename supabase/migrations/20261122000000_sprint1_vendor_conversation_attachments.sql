-- ============================================================================
-- Sprint 1 — finishing RC2's disclosed vendor-attachment gap (see
-- docs/rc2-messaging-conversations-final-report.md, "Newly discovered
-- parallel communication surfaces," item 3): vendors could not send or see
-- attachments in their Conversation thread. Coordinators could still see
-- any attachment they added to a vendor conversation (the read path is
-- anchor-agnostic), so this closes the gap symmetrically rather than
-- building a new mechanism — same conversation_message_attachments table,
-- same couple-messages/conversations/ storage prefix, same
-- current_user_vendor_id() auth pattern already established by RC2
-- Milestone 3's vendor RPCs.
-- ============================================================================

-- ── Vendor-side: attach an already-uploaded file to a message ──────────────
-- Mirrors add_conversation_message_attachment's shape exactly, scoped to the
-- vendor's own assignment via the same join every other vendor RPC uses.

create or replace function public.add_vendor_conversation_message_attachment(
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
  v_vendor_id uuid;
  v_att_id    uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not exists (
    select 1 from public.conversation_messages cm
    join public.conversations c on c.id = cm.conversation_id
    join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
    where cm.id = p_message_id and eva.vendor_id = v_vendor_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.conversation_message_attachments (message_id, file_url, file_name, file_size, mime_type)
  values (p_message_id, p_file_url, p_file_name, p_file_size, p_mime_type)
  returning id into v_att_id;

  return jsonb_build_object('ok', true, 'attachment_id', v_att_id);
end;
$$;

grant execute on function public.add_vendor_conversation_message_attachment(uuid, text, text, bigint, text) to authenticated;

-- ── Vendor-side: resolve a conversation's venue_id, for the upload route ───
-- conversation_message_attachments' RLS policy (and conversations' own
-- policy) resolve back to current_user_venue_id() only — there is no
-- vendor-scoped RLS read on conversations, by design (every other
-- vendor-facing read goes through a SECURITY DEFINER RPC, never a direct
-- table select). The upload route needs the venue_id to build the storage
-- path before any attachment row exists, so it gets a narrow RPC for
-- exactly that, mirroring get_conversation_id_for_event_vendor_assignment's
-- shape.

create or replace function public.get_vendor_conversation_venue_id(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_venue_id  uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return null;
  end if;

  select c.venue_id into v_venue_id
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  where c.id = p_conversation_id and eva.vendor_id = v_vendor_id;

  return v_venue_id;
end;
$$;

grant execute on function public.get_vendor_conversation_venue_id(uuid) to authenticated;

-- ── send_vendor_conversation_message now allows an empty body ──────────────
-- Same allowance Milestones 1/2 made venue- and portal-side: an
-- attachment-only message is created with an empty body, then a file is
-- attached to it right after via add_vendor_conversation_message_attachment.
-- Every vendor message is channel 'portal' (there is no vendor email/SMS
-- send path), so attachment-only is always safe here — no channel branch
-- needed, unlike the venue side's record-only-channel restriction.

-- The old 2-arg overload predates p_has_attachment and is now orphaned —
-- every caller (lib/conversations/repository.ts) always passes all three
-- args, so this drop just prevents a confusing, unused duplicate signature
-- from lingering (not a security concern the way TR-L3's drop was; this
-- overload never bypassed anything, it's just dead weight).
drop function if exists public.send_vendor_conversation_message(uuid, text);

create or replace function public.send_vendor_conversation_message(
  p_conversation_id uuid,
  p_body text,
  p_has_attachment boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vendor_id uuid;
  v_venue_id  uuid;
  v_msg_id    uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  if length(trim(coalesce(p_body, ''))) = 0 and not p_has_attachment then
    return '{"ok":false,"error":"empty_body"}'::jsonb;
  end if;

  select c.venue_id into v_venue_id
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  where c.id = p_conversation_id and eva.vendor_id = v_vendor_id;

  if v_venue_id is null then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body)
  values (p_conversation_id, v_venue_id, 'vendor', 'portal', trim(coalesce(p_body, '')))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

grant execute on function public.send_vendor_conversation_message(uuid, text, boolean) to authenticated;

-- ── get_vendor_conversation now includes each message's attachments ────────

create or replace function public.get_vendor_conversation(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (
    select 1 from public.conversations c
    join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
    where c.id = p_conversation_id and eva.vendor_id = v_vendor_id
  ) then
    return '{"error":"not_found"}'::jsonb;
  end if;

  update public.conversation_messages set contact_read_at = now()
  where conversation_id = p_conversation_id
    and sender_type in ('venue_staff', 'system')
    and contact_read_at is null;

  update public.conversations set contact_unread = 0 where id = p_conversation_id;

  return (
    select jsonb_build_object(
      'conversation_id', p_conversation_id,
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
          where cm.conversation_id = p_conversation_id
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

notify pgrst, 'reload schema';
