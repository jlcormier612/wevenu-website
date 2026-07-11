-- ============================================================================
-- Communication Workspace Completion
--
-- One additive column (assigned_staff_id, mirroring event_tasks and
-- timeline_entries' own assigned_to_staff_id — the same venue_staff
-- roster) plus a richer get_conversation_inbox() so the Inbox can filter by
-- Lead vs Booking, Assigned Coordinator, and show each card's channel and
-- shortcut targets — without a second query per row. The "no status column"
-- decision from the original conversation foundation migration is
-- respected: Waiting for Client / Waiting for Venue stay computed from
-- latest_message.sender_type in the application layer, never stored here.
-- ============================================================================

alter table public.conversations
  add column assigned_staff_id uuid references public.venue_staff (id) on delete set null;

create index conversations_assigned_staff on public.conversations (assigned_staff_id) where assigned_staff_id is not null;

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
        -- Client shortcut (the originating Lead record) and Booking shortcut
        -- (the Client/Booking Workspace record) — a Relationship may have
        -- both once a Lead has booked (Communication Workspace Completion,
        -- Requirement 3). Most-recent-wins, matching display_name above.
        (select l3.id from public.leads l3
          where l3.relationship_id = c.relationship_id
          order by l3.created_at desc limit 1) as lead_id,
        (select cl2.id from public.clients cl2
           join public.leads l4 on l4.id = cl2.lead_id
          where l4.relationship_id = c.relationship_id
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
