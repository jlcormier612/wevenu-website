-- Inbox Needs Response as persisted state, independent of Read/Unread.
--
-- Locked product semantics:
--   * Unread = venue has not read relevant inbound messages (venue_unread / venue_read_at)
--   * Needs Response = venue still owes a response (or has not dismissed)
--   * Opening a conversation clears Unread only — never Needs Response
--   * Meaningful venue reply clears Needs Response
--   * Explicit "No response needed" clears Needs Response without a reply
--   * New meaningful inbound after dismissal reactivates Needs Response
--
-- Classification of what creates Needs Response is unchanged: meaningful
-- inbound from lead_or_client / contact / vendor (same as prior derived rule).

alter table public.conversations
  add column if not exists needs_response boolean not null default false;

comment on column public.conversations.needs_response is
  'Venue-level: conversation still requires a response. Independent of venue_unread. Cleared by meaningful venue reply or clear_conversation_needs_response; set true again by meaningful inbound.';

create index if not exists conversations_venue_needs_response
  on public.conversations (venue_id)
  where needs_response;

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
declare
  v_kind text;
  v_meaningful boolean;
begin
  v_meaningful := new.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
    and new.sender_type <> 'system';

  if new.channel in ('internal_note', 'phone_log', 'voicemail', 'push') then
    update public.conversations set
      last_message_at = new.sent_at
    where id = new.conversation_id;
    return new;
  end if;

  select conversation_kind into v_kind
  from public.conversations
  where id = new.conversation_id;

  if v_kind = 'couple_vendor' then
    update public.conversations set
      last_message_at = new.sent_at,
      venue_unread   = case when new.sender_type = 'vendor'
                            then venue_unread + 1 else venue_unread end,
      contact_unread = case when new.sender_type = 'lead_or_client'
                            then contact_unread + 1 else contact_unread end,
      needs_response = case
        when not v_meaningful then needs_response
        when new.sender_type in ('lead_or_client', 'contact', 'vendor') then true
        when new.sender_type = 'venue_staff' then false
        else needs_response
      end
    where id = new.conversation_id;
  else
    update public.conversations set
      last_message_at = new.sent_at,
      venue_unread   = case when new.sender_type in ('lead_or_client','contact','vendor')
                            then venue_unread + 1 else venue_unread end,
      contact_unread = case when new.sender_type in ('venue_staff','system')
                            then contact_unread + 1 else contact_unread end,
      needs_response = case
        when not v_meaningful then needs_response
        when new.sender_type in ('lead_or_client', 'contact', 'vendor') then true
        when new.sender_type = 'venue_staff' then false
        else needs_response
      end
    where id = new.conversation_id;
  end if;

  return new;
end;
$$;

update public.conversations c
set needs_response = exists (
  select 1
  from public.conversation_latest_meaningful(c.id) m
  where m.sender_type in ('lead_or_client', 'contact', 'vendor')
);

create or replace function public.clear_conversation_needs_response(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"ok":false,"error":"unauthorized"}'::jsonb;
  end if;

  update public.conversations
     set needs_response = false
   where id = p_conversation_id
     and venue_id = v_venue_id;

  if not found then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object('ok', true, 'needs_response', false);
end;
$$;

grant execute on function public.clear_conversation_needs_response(uuid) to authenticated;

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
  p_assigned_staff_id uuid default null,
  p_event_id uuid default null,
  p_event_date_from date default null,
  p_event_date_to date default null,
  p_event_status text default null,
  p_has_attachments boolean default false,
  p_unassigned_only boolean default false,
  p_sort text default 'recent',
  p_event_types text[] default null,
  p_cursor_sort_key text default null
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
  v_sort text := case lower(coalesce(p_sort, 'recent'))
    when 'oldest' then 'oldest'
    when 'event_date_asc' then 'event_date_asc'
    when 'event_date_desc' then 'event_date_desc'
    when 'client_name_asc' then 'client_name_asc'
    when 'client_name_desc' then 'client_name_desc'
    else 'recent'
  end;
  v_phone_digits text;
  v_event_types text[] := nullif(p_event_types, '{}'::text[]);
  v_has_event_attrs boolean :=
    v_event_types is not null
    or p_event_date_from is not null
    or p_event_date_to is not null
    or (p_event_status is not null and p_event_status <> '');
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  v_term := nullif(trim(coalesce(p_search, '')), '');
  if v_term is not null then
    v_term := '%' || lower(v_term) || '%';
  end if;
  v_phone_digits := nullif(regexp_replace(trim(coalesce(p_search, '')), '\D', '', 'g'), '');

  return (
    with base as (
      select
        c.id,
        c.relationship_id,
        c.last_message_at,
        c.venue_unread,
        c.contact_unread,
        c.needs_response,
        c.assigned_staff_id,
        c.inbox_owner_kind,
        (select vs.full_name from public.venue_staff vs where vs.id = c.assigned_staff_id) as assigned_staff_name,
        case
          when c.inbox_owner_kind = 'lead' then coalesce(
            (select l.first_name || coalesce(' ' || l.last_name, '') ||
                    coalesce(' & ' || l.partner_first_name, '')
               from public.leads l
              where l.id = c.inbox_owner_lead_id),
            (select l.first_name || coalesce(' ' || l.last_name, '') ||
                    coalesce(' & ' || l.partner_first_name, '')
               from public.leads l
              where l.relationship_id = c.relationship_id
              order by l.created_at desc limit 1)
          )
          when c.inbox_owner_kind = 'client' then coalesce(
            (select cl.first_name || coalesce(' ' || cl.last_name, '') ||
                    coalesce(' & ' || cl.partner_first_name, '')
               from public.clients cl
              where cl.id = c.inbox_owner_client_id),
            (select cl.first_name || coalesce(' ' || cl.last_name, '') ||
                    coalesce(' & ' || cl.partner_first_name, '')
               from public.clients cl
              where cl.relationship_id = c.relationship_id
              order by cl.created_at desc limit 1)
          )
          else coalesce(
            (select l.first_name || coalesce(' ' || l.last_name, '') ||
                    coalesce(' & ' || l.partner_first_name, '')
               from public.leads l
              where l.relationship_id = c.relationship_id
              order by l.created_at desc limit 1),
            (select cl.first_name || coalesce(' ' || cl.last_name, '') ||
                    coalesce(' & ' || cl.partner_first_name, '')
               from public.clients cl
              where cl.relationship_id = c.relationship_id
              order by cl.created_at desc limit 1)
          )
        end as display_name,
        coalesce(
          c.inbox_owner_lead_id,
          (select l3.id from public.leads l3
            where l3.relationship_id = c.relationship_id
            order by l3.created_at desc limit 1)
        ) as lead_id,
        coalesce(
          c.inbox_owner_client_id,
          (select cl2.id from public.clients cl2
            where cl2.relationship_id = c.relationship_id
            order by cl2.created_at desc limit 1)
        ) as client_id,
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
        and c.conversation_kind = 'venue_couple'
        and exists (
          select 1 from public.conversation_messages cm0
          where cm0.conversation_id = c.id
        )
        and (
          -- Activity-sort cursors apply early; attribute sorts cursor after enrich.
          v_sort not in ('recent', 'oldest')
          or p_cursor_last_message_at is null
          or (
            v_sort = 'recent'
            and (
              c.last_message_at < p_cursor_last_message_at
              or (c.last_message_at is not distinct from p_cursor_last_message_at and c.id < p_cursor_id)
            )
          )
          or (
            v_sort = 'oldest'
            and (
              c.last_message_at > p_cursor_last_message_at
              or (c.last_message_at is not distinct from p_cursor_last_message_at and c.id > p_cursor_id)
            )
          )
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
        (select l.event_type from public.leads l where l.id = b.lead_id) as lead_event_type,
        coalesce(
          (
            select min(e.event_date)::text
              from public.events e
             where e.client_id = b.client_id
               and e.venue_id = v_venue_id
               and e.event_date is not null
          ),
          (select l.event_date::text from public.leads l where l.id = b.lead_id)
        ) as sort_event_date,
        lower(coalesce(b.display_name, '')) as sort_client_name
      from base b
    ),
    filtered as (
      select e.*
      from enriched e
      where e.latest_message is not null
        and (not p_unread_only or e.venue_unread > 0)
        and (
          not p_needs_response_only
          or e.needs_response
        )
        and (
          p_relationship is null or p_relationship = 'all'
          -- Inbox Leads = conversation owned by a lead/opportunity (stage irrelevant).
          or (
            p_relationship in ('leads', 'lead')
            and coalesce(e.inbox_owner_kind, 'lead') = 'lead'
          )
          -- Inbox Clients = conversation owned by a client record.
          or (
            p_relationship in ('bookings', 'clients', 'client')
            and e.inbox_owner_kind = 'client'
          )
        )
        and (
          not p_unassigned_only
          or e.assigned_staff_id is null
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
          p_event_id is null
          or exists (
            select 1 from public.events ev
            where ev.id = p_event_id
              and ev.venue_id = v_venue_id
              and ev.client_id = e.client_id
          )
        )
        and (
          not v_has_event_attrs
          or exists (
            select 1 from public.events ev
            where ev.client_id = e.client_id
              and ev.venue_id = v_venue_id
              and (
                v_event_types is null
                or ev.event_type = any (v_event_types)
              )
              and (p_event_date_from is null or ev.event_date >= p_event_date_from)
              and (p_event_date_to is null or ev.event_date <= p_event_date_to)
              and (
                p_event_status is null or p_event_status = ''
                or ev.status::text = p_event_status
              )
          )
          or (
            e.client_id is null
            and e.lead_id is not null
            and (
              v_event_types is null
              or e.lead_event_type = any (v_event_types)
            )
            and (
              (p_event_date_from is null and p_event_date_to is null)
              or (
                e.preferred_date is not null
                and (p_event_date_from is null or e.preferred_date::date >= p_event_date_from)
                and (p_event_date_to is null or e.preferred_date::date <= p_event_date_to)
              )
            )
            and (p_event_status is null or p_event_status = '')
          )
        )
        and (
          not p_has_attachments
          or exists (
            select 1
              from public.conversation_messages cm
              join public.conversation_message_attachments att on att.message_id = cm.id
             where cm.conversation_id = e.id
          )
        )
        and (
          v_term is null
          or lower(coalesce(e.display_name, '')) like v_term
          or lower(coalesce(e.search_email, '')) like v_term
          or (
            v_phone_digits is not null
            and length(v_phone_digits) >= 3
            and regexp_replace(coalesce(e.search_phone, ''), '\D', '', 'g') like '%' || v_phone_digits || '%'
          )
          or lower(coalesce(e.event_name, '')) like v_term
          or lower(coalesce(e.event_type, '')) like v_term
          or (e.event_date is not null and e.event_date like '%' || trim(coalesce(p_search, '')) || '%')
          or exists (
            select 1 from public.events ev
            where ev.client_id = e.client_id
              and ev.venue_id = v_venue_id
              and (
                lower(coalesce(ev.name, '')) like v_term
                or lower(coalesce(ev.event_type, '')) like v_term
                or (ev.event_date is not null and ev.event_date::text like '%' || trim(coalesce(p_search, '')) || '%')
              )
          )
        )
        and (
          -- Attribute-sort cursors (after enrich).
          v_sort in ('recent', 'oldest')
          or p_cursor_id is null
          or (
            v_sort = 'event_date_asc'
            and p_cursor_sort_key is not null
            and (
              coalesce(e.sort_event_date, '9999-99-99') > p_cursor_sort_key
              or (
                coalesce(e.sort_event_date, '9999-99-99') = p_cursor_sort_key
                and e.id > p_cursor_id
              )
            )
          )
          or (
            v_sort = 'event_date_desc'
            and p_cursor_sort_key is not null
            and (
              coalesce(e.sort_event_date, '0001-01-01') < p_cursor_sort_key
              or (
                coalesce(e.sort_event_date, '0001-01-01') = p_cursor_sort_key
                and e.id < p_cursor_id
              )
            )
          )
          or (
            v_sort = 'client_name_asc'
            and p_cursor_sort_key is not null
            and (
              e.sort_client_name > p_cursor_sort_key
              or (e.sort_client_name = p_cursor_sort_key and e.id > p_cursor_id)
            )
          )
          or (
            v_sort = 'client_name_desc'
            and p_cursor_sort_key is not null
            and (
              e.sort_client_name < p_cursor_sort_key
              or (e.sort_client_name = p_cursor_sort_key and e.id < p_cursor_id)
            )
          )
        )
      order by
        case when v_sort = 'oldest' then e.last_message_at end asc nulls last,
        case when v_sort = 'recent' then e.last_message_at end desc nulls last,
        case when v_sort = 'event_date_asc' then coalesce(e.sort_event_date, '9999-99-99') end asc,
        case when v_sort = 'event_date_desc' then coalesce(e.sort_event_date, '0001-01-01') end desc,
        case when v_sort = 'client_name_asc' then e.sort_client_name end asc,
        case when v_sort = 'client_name_desc' then e.sort_client_name end desc,
        case when v_sort in ('oldest', 'event_date_asc', 'client_name_asc') then e.id end asc,
        case when v_sort in ('recent', 'event_date_desc', 'client_name_desc') then e.id end desc
      limit v_limit + 1
    ),
    page_rows as (
      select *
        from filtered
       order by
         case when v_sort = 'oldest' then last_message_at end asc nulls last,
         case when v_sort = 'recent' then last_message_at end desc nulls last,
         case when v_sort = 'event_date_asc' then coalesce(sort_event_date, '9999-99-99') end asc,
         case when v_sort = 'event_date_desc' then coalesce(sort_event_date, '0001-01-01') end desc,
         case when v_sort = 'client_name_asc' then sort_client_name end asc,
         case when v_sort = 'client_name_desc' then sort_client_name end desc,
         case when v_sort in ('oldest', 'event_date_asc', 'client_name_asc') then id end asc,
         case when v_sort in ('recent', 'event_date_desc', 'client_name_desc') then id end desc
       limit v_limit
    )
    select jsonb_build_object(
      'conversations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', f.id,
          'relationship_id', f.relationship_id,
          'last_message_at', f.last_message_at,
          'venue_unread', f.venue_unread,
          'contact_unread', f.contact_unread,
          'needs_response', f.needs_response,
          'assigned_staff_id', f.assigned_staff_id,
          'assigned_staff_name', f.assigned_staff_name,
          'display_name', f.display_name,
          'inbox_owner_kind', f.inbox_owner_kind,
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
          'lead_event_type', f.lead_event_type,
          'sort_event_date', f.sort_event_date,
          'sort_client_name', f.sort_client_name
        ) order by
          case when v_sort = 'oldest' then f.last_message_at end asc nulls last,
          case when v_sort = 'recent' then f.last_message_at end desc nulls last,
          case when v_sort = 'event_date_asc' then coalesce(f.sort_event_date, '9999-99-99') end asc,
          case when v_sort = 'event_date_desc' then coalesce(f.sort_event_date, '0001-01-01') end desc,
          case when v_sort = 'client_name_asc' then f.sort_client_name end asc,
          case when v_sort = 'client_name_desc' then f.sort_client_name end desc,
          case when v_sort in ('oldest', 'event_date_asc', 'client_name_asc') then f.id end asc,
          case when v_sort in ('recent', 'event_date_desc', 'client_name_desc') then f.id end desc
        )
        from page_rows f
      ), '[]'::jsonb),
      'has_more', (select count(*) > v_limit from filtered),
      'total_unread', (
        select coalesce(sum(venue_unread), 0)
          from public.conversations
         where venue_id = v_venue_id and relationship_id is not null
      ),
      'total_needs_response', (
        select count(*)::int
          from public.conversations
         where venue_id = v_venue_id
           and relationship_id is not null
           and needs_response
      ),
      'next_cursor', (
        select jsonb_build_object(
          'last_message_at', x.last_message_at,
          'id', x.id,
          'sort_key', case
            when v_sort in ('event_date_asc', 'event_date_desc') then coalesce(x.sort_event_date, '')
            when v_sort in ('client_name_asc', 'client_name_desc') then x.sort_client_name
            else null
          end
        )
        from (
          select last_message_at, id, sort_event_date, sort_client_name
            from page_rows
           order by
             case when v_sort = 'oldest' then last_message_at end asc nulls last,
             case when v_sort = 'recent' then last_message_at end desc nulls last,
             case when v_sort = 'event_date_asc' then coalesce(sort_event_date, '9999-99-99') end asc,
             case when v_sort = 'event_date_desc' then coalesce(sort_event_date, '0001-01-01') end desc,
             case when v_sort = 'client_name_asc' then sort_client_name end asc,
             case when v_sort = 'client_name_desc' then sort_client_name end desc,
             case when v_sort in ('oldest', 'event_date_asc', 'client_name_asc') then id end asc,
             case when v_sort in ('recent', 'event_date_desc', 'client_name_desc') then id end desc
           limit 1 offset greatest((select count(*) from page_rows) - 1, 0)
        ) x
        where (select count(*) from page_rows) > 0
      )
    )
  );
end;
$$;

grant execute on function public.get_conversation_inbox_page(
  int, timestamptz, uuid, text, boolean, boolean, text, text, text, uuid,
  uuid, date, date, text, boolean, boolean, text, text[], text
) to authenticated;
