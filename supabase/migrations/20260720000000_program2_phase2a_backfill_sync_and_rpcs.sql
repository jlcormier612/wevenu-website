-- ============================================================================
-- Program 2, Phase 2A — Historical backfill, forward-sync bridge, new
-- Conversation RPCs. Backend only — no UI reads any of this yet (that's
-- Phase 2B, a separate go/no-go). message_threads/messages and
-- couple_threads/couple_messages keep working exactly as they do today for
-- the entire duration of 2A.
--
-- Shape:
--   1. Shared resolvers (relationship_id from a message_threads row's
--      lead/client/event anchor, or from a couple_threads row's client_id) —
--      used by BOTH the one-time backfill and the forward-sync triggers, so
--      the two can't silently diverge on mapping rules (the risk named in
--      docs/program-2-implementation-plan.md's Phase 2A section).
--   2. One-time historical backfill of every existing message into
--      conversation_messages.
--   3. Forward-sync triggers: a TEMPORARY, named bridge — new rows written
--      to the legacy tables during 2A (the old UI is still live and
--      writable) keep mirroring into conversation_messages, so the new
--      system never goes stale between "backfill ran" and "2B retires the
--      old tables." Removed in 2B, not a permanent dual-write design.
--   4. New Conversation RPCs (venue-side + portal-side), mirroring
--      get_couple_inbox/get_couple_thread/send_couple_message/
--      get_couple_unread_count/get_portal_messages/send_portal_message —
--      built and tested here, not called by any UI until 2B.
--
-- Known, named gap (not silently dropped): a Client created directly
-- (createClient_, no originating Lead — clients.lead_id is nullable) has no
-- path to a relationship_id today. Every resolver below returns null for
-- these rows rather than guessing; the affected messages/clients are simply
-- not synced into the new system yet. This must be closed before Phase 2B
-- cuts the UI over (every portal user needs a working conversation by
-- then) — tracked as remaining work in the Architecture Delta, not fixed
-- silently here since it would expand this migration's actual scope.
-- ============================================================================

-- ---- Shared resolvers ---------------------------------------------------------

create or replace function public.resolve_relationship_id_for_thread_entity(
  p_lead_id   uuid,
  p_client_id uuid,
  p_event_id  uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select relationship_id from public.leads where id = p_lead_id),
    (select l.relationship_id from public.clients c
       join public.leads l on l.id = c.lead_id
      where c.id = p_client_id),
    (select l.relationship_id from public.events e
       join public.clients c on c.id = e.client_id
       join public.leads l on l.id = c.lead_id
      where e.id = p_event_id)
  )
$$;

create or replace function public.resolve_relationship_id_for_client(p_client_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.relationship_id
  from public.clients c
  join public.leads l on l.id = c.lead_id
  where c.id = p_client_id
$$;

-- ---- Guard against double-migration of the same legacy row ------------------
-- Backs both the NOT EXISTS guards below and the ON CONFLICT targets in the
-- forward-sync triggers — a real constraint, not just a convention.
create unique index conversation_messages_legacy_id_uniq
  on public.conversation_messages ((channel_metadata ->> 'legacy_message_id'))
  where channel_metadata ? 'legacy_message_id';

-- ---- One-time historical backfill: message_threads/messages -----------------
-- Thread structure itself is not preserved — in practice every send creates
-- a new message_threads row (lib/messaging/repository.ts's sendMessage), so
-- "thread" here means "one email," not a real conversation grouping. Every
-- message is re-attributed directly to its Relationship's one Conversation,
-- which is the whole point of this migration.
insert into public.conversation_messages (
  conversation_id, venue_id, sender_type, sender_id, channel, body, body_html,
  channel_metadata, sent_at
)
select
  conv.id,
  m.venue_id,
  case
    when m.direction = 'system' then 'system'
    when m.direction = 'inbound' then 'lead_or_client'
    else 'venue_staff'
  end,
  null,
  case
    when m.channel = 'internal' then 'internal_note'
    when m.channel = 'system' then 'internal_note'
    else m.channel
  end,
  m.body,
  m.body_html,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_message_id', m.id,
    'legacy_source', 'messages',
    'subject', t.subject,
    'to_email', m.to_email,
    'to_phone', m.to_phone,
    'provider_id', m.provider_id
  )),
  coalesce(m.sent_at, m.created_at)
from public.messages m
join public.message_threads t on t.id = m.thread_id
join lateral (
  select public.resolve_relationship_id_for_thread_entity(t.lead_id, t.client_id, t.event_id) as relationship_id
) r on true
join public.conversations conv on conv.relationship_id = r.relationship_id
where r.relationship_id is not null
  and not exists (
    select 1 from public.conversation_messages cm2
    where cm2.channel_metadata ->> 'legacy_message_id' = m.id::text
  );

-- ---- One-time historical backfill: couple_threads/couple_messages -----------
insert into public.conversation_messages (
  conversation_id, venue_id, sender_type, sender_id, channel, body,
  channel_metadata, sent_at, venue_read_at, contact_read_at
)
select
  conv.id,
  cm.venue_id,
  case when cm.sender_type = 'couple' then 'lead_or_client' else 'venue_staff' end,
  null,
  'portal',
  cm.body,
  jsonb_build_object('legacy_message_id', cm.id, 'legacy_source', 'couple_messages'),
  cm.created_at,
  cm.venue_read_at,
  cm.couple_read_at
from public.couple_messages cm
join public.couple_threads ct on ct.id = cm.thread_id
join lateral (
  select public.resolve_relationship_id_for_client(ct.client_id) as relationship_id
) r on true
join public.conversations conv on conv.relationship_id = r.relationship_id
where r.relationship_id is not null
  and not exists (
    select 1 from public.conversation_messages cm2
    where cm2.channel_metadata ->> 'legacy_message_id' = cm.id::text
  );

-- ---- Forward-sync bridge (temporary — removed in Phase 2B) ------------------
-- Best-effort: if a relationship can't be resolved for a given row (the
-- known Client-with-no-Lead gap above), the mirror is silently skipped —
-- writing the *original* row must never fail because its mirror couldn't be
-- created. Errors are swallowed the same way message_thread_participants'
-- best-effort insert already does in this codebase.

create or replace function public.sync_message_to_conversation()
returns trigger
language plpgsql
as $$
declare
  v_relationship_id uuid;
  v_conversation_id  uuid;
  v_thread public.message_threads%rowtype;
begin
  select * into v_thread from public.message_threads where id = new.thread_id;
  v_relationship_id := public.resolve_relationship_id_for_thread_entity(
    v_thread.lead_id, v_thread.client_id, v_thread.event_id
  );
  if v_relationship_id is null then
    return new;
  end if;

  select id into v_conversation_id from public.conversations where relationship_id = v_relationship_id;
  if v_conversation_id is null then
    return new;
  end if;

  insert into public.conversation_messages (
    conversation_id, venue_id, sender_type, channel, body, body_html,
    channel_metadata, sent_at
  ) values (
    v_conversation_id,
    new.venue_id,
    case
      when new.direction = 'system' then 'system'
      when new.direction = 'inbound' then 'lead_or_client'
      else 'venue_staff'
    end,
    case
      when new.channel = 'internal' then 'internal_note'
      when new.channel = 'system' then 'internal_note'
      else new.channel
    end,
    new.body,
    new.body_html,
    jsonb_strip_nulls(jsonb_build_object(
      'legacy_message_id', new.id, 'legacy_source', 'messages',
      'subject', v_thread.subject, 'to_email', new.to_email,
      'to_phone', new.to_phone, 'provider_id', new.provider_id
    )),
    coalesce(new.sent_at, new.created_at)
  )
  on conflict ((channel_metadata ->> 'legacy_message_id')) where (channel_metadata ? 'legacy_message_id') do nothing;

  return new;
exception when others then
  -- Mirroring must never block the real write — but silently swallowing
  -- every error is exactly the TR-M7 shape (a webhook reporting success
  -- despite failing). RAISE WARNING so a broken bridge is at least visible
  -- in the database logs instead of invisibly dropping messages.
  raise warning 'sync_message_to_conversation failed for message %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger messages_sync_to_conversation
  after insert on public.messages
  for each row execute function public.sync_message_to_conversation();

create or replace function public.sync_couple_message_to_conversation()
returns trigger
language plpgsql
as $$
declare
  v_relationship_id uuid;
  v_conversation_id  uuid;
  v_client_id        uuid;
begin
  select client_id into v_client_id from public.couple_threads where id = new.thread_id;
  v_relationship_id := public.resolve_relationship_id_for_client(v_client_id);
  if v_relationship_id is null then
    return new;
  end if;

  select id into v_conversation_id from public.conversations where relationship_id = v_relationship_id;
  if v_conversation_id is null then
    return new;
  end if;

  insert into public.conversation_messages (
    conversation_id, venue_id, sender_type, channel, body, channel_metadata, sent_at
  ) values (
    v_conversation_id,
    new.venue_id,
    case when new.sender_type = 'couple' then 'lead_or_client' else 'venue_staff' end,
    'portal',
    new.body,
    jsonb_build_object('legacy_message_id', new.id, 'legacy_source', 'couple_messages'),
    new.created_at
  )
  on conflict ((channel_metadata ->> 'legacy_message_id')) where (channel_metadata ? 'legacy_message_id') do nothing;

  return new;
exception when others then
  raise warning 'sync_couple_message_to_conversation failed for message %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger couple_messages_sync_to_conversation
  after insert on public.couple_messages
  for each row execute function public.sync_couple_message_to_conversation();

-- ---- New Conversation RPCs: venue side (built + tested, not yet called by any UI) ----

create or replace function public.get_conversation_inbox()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return (
    select jsonb_build_object(
      'conversations', coalesce(jsonb_agg(t order by t.last_message_at desc nulls last), '[]'::jsonb),
      'total_unread', (select coalesce(sum(venue_unread), 0) from public.conversations where venue_id = v_venue_id)
    )
    from (
      select
        c.id, c.relationship_id, c.last_message_at, c.venue_unread, c.contact_unread,
        -- Name is projected from whichever Lead/Client is most current for this
        -- Relationship, never read from venue_customer_relationships' own
        -- first_name/last_name — those are a creation-time convenience only,
        -- not a second source of truth for a name Lead/Client already own
        -- (Engineering Standard #10).
        coalesce(
          (select cl.first_name || coalesce(' ' || cl.last_name, '') ||
                  coalesce(' & ' || cl.partner_first_name, '')
             from public.clients cl
             join public.leads l2 on l2.id = cl.lead_id
            where l2.relationship_id = c.relationship_id
            order by cl.created_at desc limit 1),
          (select l.first_name || coalesce(' ' || l.last_name, '') ||
                  coalesce(' & ' || l.partner_first_name, '')
             from public.leads l
            where l.relationship_id = c.relationship_id
            order by l.created_at desc limit 1)
        ) as display_name,
        (
          select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
          from public.conversation_messages cmsg
          where cmsg.conversation_id = c.id
          order by cmsg.sent_at desc limit 1
        ) as latest_message
      from public.conversations c
      where c.venue_id = v_venue_id and c.relationship_id is not null
      order by c.last_message_at desc nulls last
    ) t
  );
end;
$$;

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
              'venue_read_at', cm.venue_read_at, 'contact_read_at', cm.contact_read_at
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

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_body text,
  p_channel text default 'portal'
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

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body)
  values (p_conversation_id, v_venue_id, 'venue_staff', coalesce(nullif(p_channel, ''), 'portal'), trim(p_body))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

create or replace function public.get_conversation_unread_count()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"count":0}'::jsonb;
  end if;

  return jsonb_build_object(
    'count', (select coalesce(sum(venue_unread), 0) from public.conversations where venue_id = v_venue_id)
  );
end;
$$;

grant execute on function public.get_conversation_inbox() to authenticated;
grant execute on function public.get_conversation(uuid) to authenticated;
grant execute on function public.send_conversation_message(uuid, text, text) to authenticated;
grant execute on function public.get_conversation_unread_count() to authenticated;

-- ---- New Conversation RPCs: portal side (token-authenticated) ---------------
-- Access-level checked from day one (TR-G4 was this exact check added late
-- to four other portal RPCs — not repeating that here). Reading a
-- conversation is available to any valid session; sending is not available
-- to 'view_only' sessions, mirroring how other portal RPCs restrict by
-- access_level rather than by an all-or-nothing token check.

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
              'sent_at', cm.sent_at, 'contact_read_at', cm.contact_read_at
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

create or replace function public.send_portal_conversation_message(p_token text, p_body text)
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

  if length(trim(p_body)) = 0 then
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
  values (v_conversation_id, v_venue_id, 'lead_or_client', 'portal', trim(p_body))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

grant execute on function public.get_portal_conversation(text) to anon, authenticated;
grant execute on function public.send_portal_conversation_message(text, text) to anon, authenticated;
