-- Inbox Pass 2 foundation:
-- 1) Inbound SMS/MMS idempotency via unique provider_id
-- 2) Service-role grants for webhook media → attachments
-- 3) Expand couple-messages MIME types for common MMS media
-- 4) Paginated venue Inbox RPC with filters (no unbounded full list)

-- ── 1. Unique provider_id (Twilio MessageSid / Resend email id) ──────────────
-- Partial unique index: nulls remain allowed for portal/notes.
-- Deduplicate any historical collisions by keeping the earliest row.

with ranked as (
  select id,
         row_number() over (partition by provider_id order by sent_at asc, id asc) as rn
    from public.conversation_messages
   where provider_id is not null
)
update public.conversation_messages cm
   set provider_id = provider_id || '-dup-' || cm.id::text
  from ranked r
 where cm.id = r.id
   and r.rn > 1;

create unique index if not exists conversation_messages_provider_uniq
  on public.conversation_messages (provider_id)
  where provider_id is not null;

-- ── 2. Service-role grants for inbound MMS persistence ───────────────────────

grant select, insert on public.conversation_message_attachments to service_role;
grant select, insert on public.conversation_message_events to service_role;

-- ── 3. MMS-friendly MIME types (storage still capped at 20MB; SMS send enforces 5MB) ──

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg','image/jpg','image/png','image/gif','image/webp',
     'image/heic','image/heif','image/tiff','image/bmp',
     'application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'video/mp4','video/mpeg','video/mpeg4','video/quicktime','video/webm','video/3gpp',
     'audio/mpeg','audio/mp4','audio/mp3','audio/amr','audio/ogg','audio/3gpp'
   ]
 where id = 'couple-messages';

-- ── 4. Latest meaningful message helper (Needs Response truth) ───────────────

create or replace function public.conversation_latest_meaningful(p_conversation_id uuid)
returns table (
  body text,
  sender_type text,
  sent_at timestamptz,
  channel text
)
language sql
stable
security definer
set search_path = public
as $$
  select cm.body, cm.sender_type::text, cm.sent_at, cm.channel::text
    from public.conversation_messages cm
   where cm.conversation_id = p_conversation_id
     and cm.sender_type <> 'system'
     and cm.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
   order by cm.sent_at desc, cm.id desc
   limit 1;
$$;

grant execute on function public.conversation_latest_meaningful(uuid) to authenticated;

-- ── 5. Paginated Inbox ───────────────────────────────────────────────────────

create or replace function public.get_conversation_inbox_page(
  p_limit int default 40,
  p_cursor_last_message_at timestamptz default null,
  p_cursor_id uuid default null,
  p_search text default null,
  p_unread_only boolean default false,
  p_needs_response_only boolean default false,
  p_relationship text default 'all',
  p_channel text default null,
  p_booking_stage text default null,
  p_assigned_staff_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 100));
  v_term text;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  v_term := nullif(trim(coalesce(p_search, '')), '');
  if v_term is not null then
    v_term := '%' || lower(v_term) || '%';
  end if;

  return (
    with base as (
      select
        c.id,
        c.relationship_id,
        c.last_message_at,
        c.venue_unread,
        c.contact_unread,
        c.assigned_staff_id,
        (select vs.full_name from public.venue_staff vs where vs.id = c.assigned_staff_id) as assigned_staff_name,
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
        (select l3.id from public.leads l3
          where l3.relationship_id = c.relationship_id
          order by l3.created_at desc limit 1) as lead_id,
        (select cl2.id from public.clients cl2
          where cl2.relationship_id = c.relationship_id
          order by cl2.created_at desc limit 1) as client_id,
        (
          select jsonb_build_object(
            'body', cmsg.body, 'sender_type', cmsg.sender_type,
            'sent_at', cmsg.sent_at, 'channel', cmsg.channel
          )
          from public.conversation_messages cmsg
          where cmsg.conversation_id = c.id
          order by cmsg.sent_at desc, cmsg.id desc
          limit 1
        ) as latest_message,
        (select to_jsonb(m) from public.conversation_latest_meaningful(c.id) m) as latest_meaningful_message
      from public.conversations c
      where c.venue_id = v_venue_id
        and c.relationship_id is not null
        -- only conversations with at least one message (Pass 1 empty-shell rule)
        and exists (
          select 1 from public.conversation_messages cm0
          where cm0.conversation_id = c.id
        )
        and (
          p_cursor_last_message_at is null
          or c.last_message_at < p_cursor_last_message_at
          or (c.last_message_at is not distinct from p_cursor_last_message_at and c.id < p_cursor_id)
        )
    ),
    enriched as (
      select
        b.*,
        coalesce(
          (select cl.email from public.clients cl where cl.id = b.client_id),
          (select l.email from public.leads l where l.id = b.lead_id)
        ) as search_email,
        coalesce(
          (select cl.phone from public.clients cl where cl.id = b.client_id),
          (select l.phone from public.leads l where l.id = b.lead_id)
        ) as search_phone,
        (select count(*)::int from public.events e where e.client_id = b.client_id) as event_count,
        case
          when (select count(*) from public.events e where e.client_id = b.client_id) = 1 then
            (select e.name from public.events e where e.client_id = b.client_id limit 1)
          else null
        end as event_name,
        case
          when (select count(*) from public.events e where e.client_id = b.client_id) = 1 then
            (select e.event_date::text from public.events e where e.client_id = b.client_id limit 1)
          else null
        end as event_date,
        case
          when (select count(*) from public.events e where e.client_id = b.client_id) = 1 then
            (select e.event_type from public.events e where e.client_id = b.client_id limit 1)
          else null
        end as event_type,
        (select l.event_date::text from public.leads l where l.id = b.lead_id) as preferred_date,
        (select l.event_type from public.leads l where l.id = b.lead_id) as lead_event_type
      from base b
    ),
    filtered as (
      select e.*
      from enriched e
      where e.latest_message is not null
        and (not p_unread_only or e.venue_unread > 0)
        and (
          not p_needs_response_only
          or (
            e.latest_meaningful_message is not null
            and (e.latest_meaningful_message->>'sender_type') in ('lead_or_client', 'contact', 'vendor')
          )
        )
        and (
          p_relationship is null or p_relationship = 'all'
          or (p_relationship in ('leads', 'lead') and e.client_id is null and e.lead_id is not null)
          or (p_relationship in ('bookings', 'clients', 'client') and e.client_id is not null)
        )
        and (
          p_assigned_staff_id is null
          or e.assigned_staff_id = p_assigned_staff_id
        )
        and (
          p_channel is null or p_channel = ''
          or exists (
            select 1 from public.conversation_messages cm
            where cm.conversation_id = e.id and cm.channel::text = p_channel
          )
        )
        and (
          v_term is null
          or lower(coalesce(e.display_name, '')) like v_term
          or lower(coalesce(e.search_email, '')) like v_term
          or regexp_replace(coalesce(e.search_phone, ''), '\D', '', 'g')
               like '%' || regexp_replace(trim(coalesce(p_search, '')), '\D', '', 'g') || '%'
          or lower(coalesce(e.event_name, '')) like v_term
          or lower(coalesce(e.event_type, '')) like v_term
          or (e.event_date is not null and e.event_date like '%' || trim(coalesce(p_search, '')) || '%')
        )
        -- Booking stage filter is applied in the application layer using the
        -- authoritative Booking Journey model (avoids inventing a second stage source).
        -- p_booking_stage is accepted so callers can pass it through; it does not
        -- filter here.
      order by e.last_message_at desc nulls last, e.id desc
      limit v_limit + 1
    )
    select jsonb_build_object(
      'conversations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'relationship_id', f.relationship_id,
          'last_message_at', f.last_message_at,
          'venue_unread', f.venue_unread,
          'contact_unread', f.contact_unread,
          'assigned_staff_id', f.assigned_staff_id,
          'assigned_staff_name', f.assigned_staff_name,
          'display_name', f.display_name,
          'lead_id', f.lead_id,
          'client_id', f.client_id,
          'latest_message', f.latest_message,
          'latest_meaningful_message', f.latest_meaningful_message,
          'search_email', f.search_email,
          'search_phone', f.search_phone,
          'event_count', f.event_count,
          'event_name', f.event_name,
          'event_date', f.event_date,
          'event_type', f.event_type,
          'preferred_date', f.preferred_date,
          'lead_event_type', f.lead_event_type
        ) order by f.last_message_at desc nulls last, f.id desc)
        from (
          select * from filtered order by last_message_at desc nulls last, id desc limit v_limit
        ) f
      ), '[]'::jsonb),
      'has_more', (select count(*) > v_limit from filtered),
      'total_unread', (
        select coalesce(sum(venue_unread), 0)
          from public.conversations
         where venue_id = v_venue_id and relationship_id is not null
      ),
      'next_cursor', (
        select jsonb_build_object(
          'last_message_at', x.last_message_at,
          'id', x.id
        )
        from (
          select last_message_at, id
            from filtered
           order by last_message_at desc nulls last, id desc
           limit 1 offset greatest(v_limit - 1, 0)
        ) x
        where (select count(*) from filtered) > 0
      )
    )
  );
end;
$$;

grant execute on function public.get_conversation_inbox_page(
  int, timestamptz, uuid, text, boolean, boolean, text, text, text, uuid
) to authenticated;

notify pgrst, 'reload schema';
