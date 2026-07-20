-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 3: vendor conversations.
--
-- Closes the vendor-scoping fork the assessment found: conversations.
-- vendor_relationship_id has existed since Phase 2 but was never actually
-- used — vendor conversations were "modeled, not built." Per the approved
-- design: vendors don't have one lifelong conversation with a venue, they
-- have a distinct operational conversation per event ("Photography for
-- Emma & James" vs. "DJ for Sarah & Mike"). So the real anchor is
-- event_vendor_assignment_id, not vendor_relationship_id.
--
-- vendor_relationship_id stays on the table but changes role: from an
-- (unused) independent anchor to a denormalized tag, always populated
-- alongside the event anchor, that exists only so the relationship-level
-- rollup ("every conversation we've ever had with this vendor, across
-- every event") can filter directly — a derived view, never a second
-- messaging system. No syncing, no copying: the rollup is just
-- `select * from conversations where vendor_relationship_id = ...`.
-- ============================================================================

alter table public.conversations
  add column event_vendor_assignment_id uuid references public.event_vendor_assignments(id) on delete cascade;

create unique index conversations_event_vendor_assignment_uniq
  on public.conversations (event_vendor_assignment_id)
  where event_vendor_assignment_id is not null;

-- vendor_relationship_id is no longer an anchor — many event-anchored
-- conversations now legitimately share the same vendor_relationship_id (the
-- whole point of the rollup), so the old uniqueness requirement is wrong.
drop index if exists public.conversations_vendor_uniq;
create index conversations_vendor_relationship
  on public.conversations (vendor_relationship_id)
  where vendor_relationship_id is not null;

alter table public.conversations drop constraint conversations_one_anchor;
alter table public.conversations add constraint conversations_one_anchor check (
  (
    (case when relationship_id is not null then 1 else 0 end) +
    (case when event_vendor_assignment_id is not null then 1 else 0 end)
  ) = 1
);

-- ── Provisioning: a Conversation exists the moment an assignment does ──────
-- Mirrors provision_conversation_for_relationship exactly. vendor_relationship_id
-- is looked up (never created here) — every vendor assignable to an event
-- already has a venue_vendor_relationships row, since vendors only reach the
-- assignment dropdown via the vendor directory (lib/vendors/repository.ts
-- getVendors, which reads venue_vendor_relationships). If that invariant
-- were ever violated the conversation still provisions correctly with a
-- null tag — it just won't appear in the relationship rollup until backfilled.

create or replace function public.provision_conversation_for_event_vendor_assignment()
returns trigger
language plpgsql
as $$
declare
  v_vendor_relationship_id uuid;
begin
  select id into v_vendor_relationship_id
  from public.venue_vendor_relationships
  where venue_id = new.venue_id and vendor_id = new.vendor_id
  limit 1;

  insert into public.conversations (venue_id, event_vendor_assignment_id, vendor_relationship_id)
  values (new.venue_id, new.id, v_vendor_relationship_id)
  on conflict (event_vendor_assignment_id) where event_vendor_assignment_id is not null do nothing;

  return new;
end;
$$;

create trigger event_vendor_assignments_provision_conversation
  after insert on public.event_vendor_assignments
  for each row execute function public.provision_conversation_for_event_vendor_assignment();

-- Backfill: every event_vendor_assignment that predates this migration gets
-- its Conversation now, the same one-time backfill shape Phase 2's
-- relationship migration used.
insert into public.conversations (venue_id, event_vendor_assignment_id, vendor_relationship_id)
select
  eva.venue_id, eva.id,
  (select vvr.id from public.venue_vendor_relationships vvr
    where vvr.venue_id = eva.venue_id and vvr.vendor_id = eva.vendor_id limit 1)
from public.event_vendor_assignments eva
where not exists (select 1 from public.conversations c where c.event_vendor_assignment_id = eva.id);

-- ── Venue-side: resolve an assignment's conversation id ─────────────────────
-- A plain RLS-scoped read, same reasoning as getConversationIdForRelationship:
-- the caller already has an authenticated venue session.

create or replace function public.get_conversation_id_for_event_vendor_assignment(p_assignment_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.conversations where event_vendor_assignment_id = p_assignment_id;
$$;

grant execute on function public.get_conversation_id_for_event_vendor_assignment(uuid) to authenticated;

-- ── Venue-side: the vendor relationship rollup ──────────────────────────────
-- "Every conversation we've ever had with this vendor, across every event."
-- A derived read over event-anchored conversations, ordered by event date —
-- never a second messaging system, per the approved design.

create or replace function public.get_vendor_relationship_rollup(p_vendor_relationship_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (
    select 1 from public.venue_vendor_relationships
    where id = p_vendor_relationship_id and venue_id = v_venue_id
  ) then
    return '{"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object(
    'conversations', coalesce(
      (
        select jsonb_agg(t order by t.event_date desc nulls last)
        from (
          select
            c.id as conversation_id, c.last_message_at, c.venue_unread,
            e.id as event_id, e.name as event_name, e.event_date,
            (
              select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
              from public.conversation_messages cmsg
              where cmsg.conversation_id = c.id
              order by cmsg.sent_at desc limit 1
            ) as latest_message
          from public.conversations c
          join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
          join public.events e on e.id = eva.event_id
          where c.vendor_relationship_id = p_vendor_relationship_id and c.venue_id = v_venue_id
        ) t
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_relationship_rollup(uuid) to authenticated;

-- ── Vendor-side RPCs (vendor_users session, current_user_vendor_id()) ──────
-- Vendors authenticate with a real Supabase session (unlike the couple
-- portal's token model), so these mirror the venue-side RPCs' auth pattern
-- exactly rather than reusing the couple portal's token-based one.

create or replace function public.get_vendor_conversation_inbox()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'conversations', coalesce(
      (
        select jsonb_agg(t order by t.last_message_at desc nulls last)
        from (
          select
            c.id as conversation_id, c.last_message_at, c.contact_unread,
            e.id as event_id, e.name as event_name, e.event_date,
            (
              select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
              from public.conversation_messages cmsg
              where cmsg.conversation_id = c.id
              order by cmsg.sent_at desc limit 1
            ) as latest_message
          from public.conversations c
          join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
          join public.events e on e.id = eva.event_id
          where eva.vendor_id = v_vendor_id
        ) t
      ),
      '[]'::jsonb
    ),
    'total_unread', (
      select coalesce(sum(c.contact_unread), 0)
      from public.conversations c
      join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
      where eva.vendor_id = v_vendor_id
    )
  );
end;
$$;

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
              'venue_read_at', cm.venue_read_at
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

create or replace function public.send_vendor_conversation_message(p_conversation_id uuid, p_body text)
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

  if length(trim(coalesce(p_body, ''))) = 0 then
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
  values (p_conversation_id, v_venue_id, 'vendor', 'portal', trim(p_body))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

grant execute on function public.get_vendor_conversation_inbox() to authenticated;
grant execute on function public.get_vendor_conversation(uuid) to authenticated;
grant execute on function public.send_vendor_conversation_message(uuid, text) to authenticated;

notify pgrst, 'reload schema';
