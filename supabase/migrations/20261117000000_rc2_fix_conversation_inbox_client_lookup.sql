-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 4: fix a real, pre-existing bug
-- in get_conversation_inbox found while testing this milestone's search
-- work (not something this milestone introduced).
--
-- get_conversation_inbox's display_name AND client_id were both derived by
-- joining clients to leads (`join public.leads l2 on l2.id = cl.lead_id`)
-- and matching relationship_id through the lead. That predates Phase 2B's
-- addition of clients.relationship_id (20260721000000) as the direct,
-- authoritative link — clients created without ever going through a Lead
-- (a real, supported path; lib/clients/repository.ts's insertClient has
-- always had both a direct-create and a lead-conversion path) have no
-- lead_id, so the join silently produced nothing: no display name, and no
-- client_id, meaning their Inbox row couldn't even link to the Booking
-- Workspace. Same bug, same fix, applied to search_global's new
-- Conversations branch in this same migration set.
-- ============================================================================

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
        c.assigned_staff_id,
        (select vs.full_name from public.venue_staff vs where vs.id = c.assigned_staff_id) as assigned_staff_name,
        -- Name is projected from whichever Lead/Client is most current for this
        -- Relationship, never read from venue_customer_relationships' own
        -- first_name/last_name — those are a creation-time convenience only,
        -- not a second source of truth for a name Lead/Client already own
        -- (Engineering Standard #10). Matched via clients.relationship_id
        -- directly (Phase 2B), not through a lead join — a client created
        -- without ever having a Lead row still has one.
        coalesce(
          (select cl.first_name || coalesce(' ' || cl.last_name, '') ||
                  coalesce(' & ' || cl.partner_first_name, '')
             from public.clients cl
            where cl.relationship_id = c.relationship_id
            order by cl.created_at desc limit 1),
          (select l.first_name || coalesce(' ' || l.last_name, '') ||
                  coalesce(' & ' || l.partner_first_name, '')
             from public.leads l
            where l.relationship_id = c.relationship_id
            order by l.created_at desc limit 1)
        ) as display_name,
        -- Client shortcut (the originating Lead record) and Booking shortcut
        -- (the Client/Booking Workspace record) — a Relationship may have
        -- both once a Lead has booked (Communication Workspace Completion,
        -- Requirement 3). Most-recent-wins, matching display_name above.
        (select l3.id from public.leads l3
          where l3.relationship_id = c.relationship_id
          order by l3.created_at desc limit 1) as lead_id,
        (select cl2.id from public.clients cl2
          where cl2.relationship_id = c.relationship_id
          order by cl2.created_at desc limit 1) as client_id,
        (
          select jsonb_build_object(
            'body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at, 'channel', cmsg.channel
          )
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

notify pgrst, 'reload schema';
