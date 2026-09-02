-- ============================================================================
-- Staff-only conversation channels must never reach couple or vendor portals.
--
-- internal_note (and unused historical channels phone_log / voicemail / push)
-- remain in conversation_messages for venue staff. They must not:
--   - appear in portal / vendor conversation retrieval
--   - increment contact (couple/vendor) unread
--   - appear as the vendor/couple inbox latest-message snippet
--
-- Venue get_conversation and the venue inbox are unchanged: staff still see
-- historical internal notes.
-- ============================================================================

-- ── Unread: staff-only channels bump last_message_at for the venue, never
--    contact_unread / couple unread.

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
declare
  v_kind text;
begin
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
    -- couple sends → vendor unread; vendor sends → couple unread
    update public.conversations set
      last_message_at = new.sent_at,
      venue_unread   = case when new.sender_type = 'vendor'
                            then venue_unread + 1 else venue_unread end,
      contact_unread = case when new.sender_type = 'lead_or_client'
                            then contact_unread + 1 else contact_unread end
    where id = new.conversation_id;
  else
    -- venue_couple / venue_vendor: venue vs counterparty (contact/vendor/lead)
    update public.conversations set
      last_message_at = new.sent_at,
      venue_unread   = case when new.sender_type in ('lead_or_client','contact','vendor')
                            then venue_unread + 1 else venue_unread end,
      contact_unread = case when new.sender_type in ('venue_staff','system')
                            then contact_unread + 1 else contact_unread end
    where id = new.conversation_id;
  end if;

  return new;
end;
$$;

-- ── Couple portal: hide staff-only channels

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
    and contact_read_at is null
    and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');

  update public.conversations set contact_unread = 0 where id = v_conversation_id;

  return (
    select jsonb_build_object(
      'conversation_id', v_conversation_id,
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
          where cm.conversation_id = v_conversation_id
            and cm.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

-- ── Vendor inbox latest_message: exclude staff-only

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
            c.id as conversation_id,
            c.last_message_at,
            c.contact_unread,
            c.conversation_kind,
            e.id as event_id,
            e.name as event_name,
            e.event_date,
            v.name as venue_name,
            case
              when c.conversation_kind = 'couple_vendor' then
                nullif(trim(both ' & ' from concat_ws(' & ',
                  nullif(trim(cl.first_name), ''),
                  nullif(trim(cl.partner_first_name), '')
                )), '')
              else null
            end as couple_name,
            case
              when c.conversation_kind = 'couple_vendor' then 'Couple'
              else 'Venue'
            end as counterparty_label,
            (
              select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
              from public.conversation_messages cmsg
              where cmsg.conversation_id = c.id
                and cmsg.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
              order by cmsg.sent_at desc limit 1
            ) as latest_message
          from public.conversations c
          join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
          join public.events e on e.id = eva.event_id
          join public.venues v on v.id = c.venue_id
          left join public.clients cl on cl.id = e.client_id
          where eva.vendor_id = v_vendor_id
            and c.conversation_kind in ('venue_vendor', 'couple_vendor')
        ) t
      ),
      '[]'::jsonb
    ),
    'total_unread', (
      select coalesce(sum(c.contact_unread), 0)
      from public.conversations c
      join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
      where eva.vendor_id = v_vendor_id
        and c.conversation_kind in ('venue_vendor', 'couple_vendor')
    )
  );
end;
$$;

create or replace function public.get_vendor_conversation(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_vendor_id uuid;
  v_kind text;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  select c.conversation_kind into v_kind
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  where c.id = p_conversation_id and eva.vendor_id = v_vendor_id;

  if v_kind is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if v_kind = 'couple_vendor' then
    update public.conversation_messages set contact_read_at = now()
    where conversation_id = p_conversation_id
      and sender_type = 'lead_or_client'
      and contact_read_at is null
      and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');
  else
    update public.conversation_messages set contact_read_at = now()
    where conversation_id = p_conversation_id
      and sender_type in ('venue_staff', 'system')
      and contact_read_at is null
      and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');
  end if;

  update public.conversations set contact_unread = 0 where id = p_conversation_id;

  return (
    select jsonb_build_object(
      'conversation_id', p_conversation_id,
      'conversation_kind', c.conversation_kind,
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
            and cm.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
        ),
        '[]'::jsonb
      )
    )
    from public.conversations c
    where c.id = p_conversation_id
  );
end;
$$;

create or replace function public.get_portal_couple_vendor_conversations(
  p_access_token text,
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_event_id uuid;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('conversations', '[]'::jsonb, 'total_unread', 0);
  end if;

  return jsonb_build_object(
    'conversations', coalesce(
      (
        select jsonb_agg(t order by t.last_message_at desc nulls last)
        from (
          select
            c.id as conversation_id,
            c.last_message_at,
            c.venue_unread as couple_unread,
            eva.id as assignment_id,
            vnd.id as vendor_id,
            coalesce(nullif(trim(vnd.business_name), ''), 'Vendor') as vendor_name,
            vnd.category as vendor_category,
            (
              select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
              from public.conversation_messages cmsg
              where cmsg.conversation_id = c.id
                and cmsg.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
              order by cmsg.sent_at desc limit 1
            ) as latest_message
          from public.conversations c
          join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
          join public.vendors vnd on vnd.id = eva.vendor_id
          where eva.event_id = v_event_id
            and eva.venue_id = v_session_venue_id
            and c.conversation_kind = 'couple_vendor'
        ) t
      ),
      '[]'::jsonb
    ),
    'total_unread', (
      select coalesce(sum(c.venue_unread), 0)
      from public.conversations c
      join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
      where eva.event_id = v_event_id
        and eva.venue_id = v_session_venue_id
        and c.conversation_kind = 'couple_vendor'
    )
  );
end;
$$;

create or replace function public.get_portal_couple_vendor_conversation(
  p_access_token text,
  p_client_id uuid,
  p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_event_id uuid;
  v_vendor_name text;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  select coalesce(nullif(trim(vnd.business_name), ''), 'Vendor') into v_vendor_name
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  join public.vendors vnd on vnd.id = eva.vendor_id
  where c.id = p_conversation_id
    and c.conversation_kind = 'couple_vendor'
    and eva.event_id = v_event_id
    and eva.venue_id = v_session_venue_id;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  update public.conversation_messages set venue_read_at = now()
  where conversation_id = p_conversation_id
    and sender_type = 'vendor'
    and venue_read_at is null
    and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');

  update public.conversations set venue_unread = 0 where id = p_conversation_id;

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'vendor_name', v_vendor_name,
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
          and cm.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
      ),
      '[]'::jsonb
    )
  );
end;
$$;

notify pgrst, 'reload schema';
