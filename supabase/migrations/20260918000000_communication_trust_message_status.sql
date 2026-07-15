-- Communication Trust Experience — Phase 3 foundation.
--
-- A venue owner should never wonder "did my message actually go?" — but
-- today only the legacy `messages` table has any status lifecycle at all,
-- and it stops at a bare "sent", which conflates "the provider accepted
-- it" with "it was delivered." `conversation_messages` (the table behind
-- the newer Conversation system) has no status tracking whatsoever — a
-- message sent through it can never be updated by a delivery, open,
-- click, or bounce webhook, because there is no `provider_id` for the
-- webhook to match against and nowhere to record the result. This
-- migration gives both tables one shared vocabulary, so the UI layer
-- built on top of it doesn't need to know which table a message lives in.
--
-- Shared vocabulary: draft, sending, accepted, delivered, opened, clicked,
-- replied, failed, received. "Queued" (a scheduled-but-not-yet-sent
-- message) intentionally has no row in either table yet — that state is
-- owned entirely by scheduled_messages, per One Fact, One Owner.

-- ---- messages: widen the status lifecycle -----------------------------------

alter table public.messages drop constraint if exists messages_status_check;

update public.messages set status = 'accepted' where status = 'sent';

alter table public.messages add constraint messages_status_check
  check (status in ('draft', 'sending', 'accepted', 'delivered', 'opened', 'clicked', 'replied', 'failed', 'received'));

-- ---- conversation_messages: add the lifecycle it never had -------------------
--
-- Nullable by design: portal notes, internal notes, and phone logs are
-- record-only (no provider ever touches them) and correctly show no
-- status at all, rather than a misleading "delivered".

alter table public.conversation_messages
  add column if not exists provider_id     text,
  add column if not exists status          text,
  add column if not exists failure_reason  text;

alter table public.conversation_messages drop constraint if exists conversation_messages_status_check;
alter table public.conversation_messages add constraint conversation_messages_status_check
  check (status is null or status in ('draft', 'sending', 'accepted', 'delivered', 'opened', 'clicked', 'replied', 'failed', 'received'));

create index if not exists conversation_messages_provider
  on public.conversation_messages (provider_id) where provider_id is not null;

-- ---- send_conversation_message RPC: accept the send result -------------------
--
-- Previously discarded the provider's response entirely (see
-- docs/communication-trust-experience.md, Phase 1). Now records it so the
-- webhook routes have something to match against.

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

  if length(trim(p_body)) = 0 then
    return '{"ok":false,"error":"empty_body"}'::jsonb;
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body, provider_id, status)
  values (p_conversation_id, v_venue_id, 'venue_staff', coalesce(nullif(p_channel, ''), 'portal'), trim(p_body), p_provider_id, p_status)
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

grant execute on function public.send_conversation_message(uuid, text, text, text, text) to authenticated;

-- create or replace with a wider parameter list creates a new overload
-- rather than replacing the 3-arg original — drop it so only one signature
-- exists and every caller is forced onto the version that records status.
drop function if exists public.send_conversation_message(uuid, text, text);

-- ---- find_relationship_by_phone: fix asymmetric country-code stripping --------
--
-- Found live during this pass, not by reading code: the function stripped
-- a leading US/Canada "1" from the *inbound* number only, never from the
-- stored lead/client phone it compares against. Any record whose phone
-- happened to be saved with a country code (confirmed present in real
-- data — toE164() already produces this format elsewhere in this same
-- codebase) could never be matched by an inbound text, ever, with no
-- error and no trace — the route's own unmatched-sender branch just logs
-- a console.warn and returns 200 OK, so Twilio, the venue, and the client
-- would all believe the text was received. Exactly the class of silent
-- failure this whole pass exists to close. Fixed by normalizing both
-- sides of the comparison through the same function.

create or replace function public.normalize_phone_digits(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if length(v_digits) = 11 and left(v_digits, 1) = '1' then
    v_digits := substring(v_digits from 2);
  end if;
  return v_digits;
end;
$$;

create or replace function public.find_relationship_by_phone(p_phone text)
returns table (venue_id uuid, relationship_id uuid, entity_type text, entity_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := public.normalize_phone_digits(p_phone);
begin
  if v_digits = '' then
    return;
  end if;

  return query
    select l.venue_id, l.relationship_id, 'lead'::text, l.id,
      trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))
    from public.leads l
    where l.relationship_id is not null
      and public.normalize_phone_digits(l.phone) = v_digits
    limit 1;

  if found then
    return;
  end if;

  return query
    select c.venue_id, c.relationship_id, 'client'::text, c.id,
      trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
    from public.clients c
    where c.relationship_id is not null
      and public.normalize_phone_digits(c.phone) = v_digits
    limit 1;
end;
$$;

-- ---- get_conversation RPC: surface status/failure_reason to the UI ------------

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
              'status', cm.status, 'failure_reason', cm.failure_reason
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

-- ---- service_role grants ------------------------------------------------------
--
-- Same recurring gap already found twice this pass (see
-- 20260917000000_communication_service_role_grants.sql) — service_role
-- gets no privileges automatically just because rolbypassrls is true.
-- conversation_message_events already existed, unused; the webhook routes
-- are about to become its first writer.

grant update on public.conversation_messages to service_role;
grant select, insert on public.conversation_message_events to service_role;

-- Found live during this pass: the SMS inbound webhook's insert into
-- conversation_messages failed with "permission denied for table
-- conversations" — not from the insert itself, but from
-- touch_conversation_on_message() (an AFTER INSERT trigger on
-- conversation_messages) trying to update the parent conversation's
-- last_message_at/unread counts. The 20260917000000 migration granted
-- select+insert on conversations but never update — Postgres's own error
-- named the exact fix.
grant update on public.conversations to service_role;
