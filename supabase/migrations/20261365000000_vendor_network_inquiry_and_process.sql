-- ============================================================================
-- Vendor Network: process attributes + pre-selection couple↔vendor inquiry
--
-- 1) Preference: Approved (standard) / Recommended / Preferred (no Featured)
-- 2) Required + In-house on venue_vendor_relationships
-- 3) Required categories (venue process)
-- 4) Conversation kind couple_vendor_inquiry (pre-assignment)
-- 5) Start/send/get inquiry RPCs; merge into couple_vendor on assignment
-- 6) Invitation claim honors invitation expiry
-- ============================================================================

-- ── 1. Preference levels ─────────────────────────────────────────────────────

update public.venue_vendor_relationships
set preference_level = 'preferred'
where preference_level = 'featured';

alter table public.venue_vendor_relationships
  drop constraint if exists venue_vendor_relationships_preference_level_check;

alter table public.venue_vendor_relationships
  add constraint venue_vendor_relationships_preference_level_check
  check (preference_level in ('standard', 'recommended', 'preferred'));

alter table public.venue_vendor_relationships
  alter column preference_level set default 'standard';

-- ── 2. Required + In-house ───────────────────────────────────────────────────

alter table public.venue_vendor_relationships
  add column if not exists is_required boolean not null default false;

alter table public.venue_vendor_relationships
  add column if not exists is_in_house boolean not null default false;

-- ── 3. Required categories ───────────────────────────────────────────────────

create table if not exists public.venue_required_vendor_categories (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  category   text not null,
  created_at timestamptz not null default now(),
  unique (venue_id, category)
);

create index if not exists venue_required_vendor_categories_venue
  on public.venue_required_vendor_categories (venue_id);

alter table public.venue_required_vendor_categories enable row level security;

drop policy if exists venue_required_vendor_categories_venue on public.venue_required_vendor_categories;
create policy venue_required_vendor_categories_venue
  on public.venue_required_vendor_categories
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.venue_required_vendor_categories to authenticated;

-- ── 4. Inquiry soft context on conversations ─────────────────────────────────

alter table public.conversations
  add column if not exists inquiry_context jsonb not null default '{}'::jsonb;

-- ── 5. Kind + anchor: couple_vendor_inquiry ──────────────────────────────────

alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations
  add constraint conversations_kind_check check (
    conversation_kind in (
      'venue_couple',
      'venue_vendor',
      'couple_vendor',
      'couple_vendor_inquiry'
    )
  );

-- venue_couple must not carry a vendor_relationship_id (inquiry owns that pairing)
update public.conversations
set vendor_relationship_id = null
where conversation_kind = 'venue_couple'
  and vendor_relationship_id is not null;

alter table public.conversations drop constraint if exists conversations_kind_matches_anchor;
alter table public.conversations
  add constraint conversations_kind_matches_anchor check (
    (conversation_kind = 'venue_couple'
      and relationship_id is not null
      and event_vendor_assignment_id is null
      and vendor_relationship_id is null)
    or
    (conversation_kind in ('venue_vendor', 'couple_vendor')
      and event_vendor_assignment_id is not null
      and relationship_id is null)
    or
    (conversation_kind = 'couple_vendor_inquiry'
      and relationship_id is not null
      and vendor_relationship_id is not null
      and event_vendor_assignment_id is null)
  );

-- One active inquiry per couple relationship + venue-vendor relationship
create unique index if not exists conversations_couple_vendor_inquiry_uniq
  on public.conversations (relationship_id, vendor_relationship_id)
  where conversation_kind = 'couple_vendor_inquiry'
    and relationship_id is not null
    and vendor_relationship_id is not null;

-- venue_couple owns the single relationship_id conversation; inquiries also
-- carry relationship_id (plus vendor_relationship_id), so the original unique
-- must be scoped to venue_couple only.
drop index if exists public.conversations_relationship_uniq;
create unique index conversations_relationship_uniq
  on public.conversations (relationship_id)
  where relationship_id is not null
    and conversation_kind = 'venue_couple';

-- ── 6. Unread touch: inquiry mirrors couple_vendor ───────────────────────────

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
declare
  v_kind text;
begin
  select conversation_kind into v_kind
  from public.conversations
  where id = new.conversation_id;

  if v_kind in ('couple_vendor', 'couple_vendor_inquiry') then
    if new.sender_type in ('lead_or_client', 'contact') then
      update public.conversations
      set last_message_at = new.sent_at,
          contact_unread = contact_unread + 1
      where id = new.conversation_id;
    elsif new.sender_type = 'vendor' then
      update public.conversations
      set last_message_at = new.sent_at,
          venue_unread = venue_unread + 1
      where id = new.conversation_id;
    else
      update public.conversations
      set last_message_at = new.sent_at
      where id = new.conversation_id;
    end if;
  else
    if new.sender_type in ('venue_staff', 'system') then
      update public.conversations
      set last_message_at = new.sent_at,
          contact_unread = contact_unread + 1
      where id = new.conversation_id;
    elsif new.sender_type in ('lead_or_client', 'contact', 'vendor') then
      update public.conversations
      set last_message_at = new.sent_at,
          venue_unread = venue_unread + 1
      where id = new.conversation_id;
    else
      update public.conversations
      set last_message_at = new.sent_at
      where id = new.conversation_id;
    end if;
  end if;

  return new;
end;
$$;

-- ── 7. Start / continue inquiry (portal) ─────────────────────────────────────

create or replace function public.start_portal_vendor_inquiry(
  p_access_token text,
  p_client_id uuid,
  p_vendor_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_rel_id uuid;
  v_vvr_id uuid;
  v_claimed boolean;
  v_event_id uuid;
  v_event_date date;
  v_event_type text;
  v_venue_name text;
  v_couple_name text;
  v_convo_id uuid;
  v_msg_id uuid;
  v_body text := nullif(trim(p_body), '');
  v_created boolean := false;
begin
  if v_body is null then
    return jsonb_build_object('ok', false, 'error', 'message_required');
  end if;

  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token
    and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select c.relationship_id,
         nullif(trim(both ' & ' from concat_ws(' & ',
           nullif(trim(c.first_name), ''),
           nullif(trim(c.partner_first_name), '')
         )), '')
  into v_rel_id, v_couple_name
  from public.clients c
  where c.id = p_client_id and c.venue_id = v_session_venue_id;
  if v_rel_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select vvr.id, vnd.is_claimed
  into v_vvr_id, v_claimed
  from public.venue_vendor_relationships vvr
  join public.vendors vnd on vnd.id = vvr.vendor_id
  where vvr.venue_id = v_session_venue_id
    and vvr.vendor_id = p_vendor_id
    and vvr.status <> 'inactive';
  if v_vvr_id is null then
    return jsonb_build_object('ok', false, 'error', 'vendor_unavailable');
  end if;
  if not coalesce(v_claimed, false) then
    return jsonb_build_object('ok', false, 'error', 'vendor_unclaimed');
  end if;

  select e.id, e.event_date, e.event_type
  into v_event_id, v_event_date, v_event_type
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  select name into v_venue_name from public.venues where id = v_session_venue_id;

  -- If already assigned, use the assignment couple_vendor thread instead.
  select c.id into v_convo_id
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  where eva.event_id = v_event_id
    and eva.vendor_id = p_vendor_id
    and eva.venue_id = v_session_venue_id
    and c.conversation_kind = 'couple_vendor'
  limit 1;

  if v_convo_id is null then
    select c.id into v_convo_id
    from public.conversations c
    where c.conversation_kind = 'couple_vendor_inquiry'
      and c.relationship_id = v_rel_id
      and c.vendor_relationship_id = v_vvr_id
    limit 1;

    if v_convo_id is null then
      insert into public.conversations (
        venue_id,
        relationship_id,
        vendor_relationship_id,
        conversation_kind,
        inquiry_context
      ) values (
        v_session_venue_id,
        v_rel_id,
        v_vvr_id,
        'couple_vendor_inquiry',
        jsonb_build_object(
          'eventId', v_event_id,
          'eventDate', v_event_date,
          'eventType', v_event_type,
          'venueName', v_venue_name,
          'coupleName', v_couple_name
        )
      )
      returning id into v_convo_id;
      v_created := true;
    else
      update public.conversations
      set inquiry_context = coalesce(inquiry_context, '{}'::jsonb) || jsonb_build_object(
        'eventId', coalesce(v_event_id, (inquiry_context->>'eventId')::uuid),
        'eventDate', coalesce(v_event_date::text, inquiry_context->>'eventDate'),
        'eventType', coalesce(v_event_type, inquiry_context->>'eventType'),
        'venueName', coalesce(v_venue_name, inquiry_context->>'venueName'),
        'coupleName', coalesce(v_couple_name, inquiry_context->>'coupleName')
      )
      where id = v_convo_id;
    end if;
  end if;

  insert into public.conversation_messages (
    conversation_id, venue_id, sender_type, sender_id, channel, body
  ) values (
    v_convo_id, v_session_venue_id, 'lead_or_client', p_client_id, 'portal', v_body
  )
  returning id into v_msg_id;

  return jsonb_build_object(
    'ok', true,
    'conversationId', v_convo_id,
    'messageId', v_msg_id,
    'created', v_created
  );
end;
$$;

grant execute on function public.start_portal_vendor_inquiry(text, uuid, uuid, text)
  to anon, authenticated;

-- ── 8. Portal: list inquiries + assigned threads ─────────────────────────────

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
  v_rel_id uuid;
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

  select c.relationship_id into v_rel_id
  from public.clients c
  where c.id = p_client_id and c.venue_id = v_session_venue_id;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  return jsonb_build_object(
    'conversations', coalesce(
      (
        select jsonb_agg(t order by t.last_message_at desc nulls last)
        from (
          -- Assigned couple_vendor threads
          select
            c.id as conversation_id,
            c.last_message_at,
            c.venue_unread as couple_unread,
            eva.id as assignment_id,
            vnd.id as vendor_id,
            coalesce(nullif(trim(vnd.business_name), ''), 'Vendor') as vendor_name,
            vnd.category as vendor_category,
            c.conversation_kind,
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
          where v_event_id is not null
            and eva.event_id = v_event_id
            and eva.venue_id = v_session_venue_id
            and c.conversation_kind = 'couple_vendor'

          union all

          -- Pre-selection inquiries (not yet assigned for this event)
          select
            c.id as conversation_id,
            c.last_message_at,
            c.venue_unread as couple_unread,
            null::uuid as assignment_id,
            vnd.id as vendor_id,
            coalesce(nullif(trim(vnd.business_name), ''), 'Vendor') as vendor_name,
            vnd.category as vendor_category,
            c.conversation_kind,
            (
              select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
              from public.conversation_messages cmsg
              where cmsg.conversation_id = c.id
                and cmsg.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
              order by cmsg.sent_at desc limit 1
            ) as latest_message
          from public.conversations c
          join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
          join public.vendors vnd on vnd.id = vvr.vendor_id
          where c.conversation_kind = 'couple_vendor_inquiry'
            and c.relationship_id = v_rel_id
            and c.venue_id = v_session_venue_id
            and not exists (
              select 1 from public.event_vendor_assignments eva2
              where eva2.event_id = v_event_id
                and eva2.vendor_id = vnd.id
                and eva2.venue_id = v_session_venue_id
            )
        ) t
      ),
      '[]'::jsonb
    ),
    'total_unread', (
      select coalesce(sum(u.venue_unread), 0)
      from (
        select c.venue_unread
        from public.conversations c
        join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
        where v_event_id is not null
          and eva.event_id = v_event_id
          and eva.venue_id = v_session_venue_id
          and c.conversation_kind = 'couple_vendor'
        union all
        select c.venue_unread
        from public.conversations c
        where c.conversation_kind = 'couple_vendor_inquiry'
          and c.relationship_id = v_rel_id
          and c.venue_id = v_session_venue_id
      ) u
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
  v_rel_id uuid;
  v_kind text;
  v_vendor_name text;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select c.relationship_id into v_rel_id
  from public.clients c
  where c.id = p_client_id and c.venue_id = v_session_venue_id;
  if v_rel_id is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  -- Assigned thread
  select c.conversation_kind, coalesce(nullif(trim(vnd.business_name), ''), 'Vendor')
  into v_kind, v_vendor_name
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  join public.events e on e.id = eva.event_id
  join public.vendors vnd on vnd.id = eva.vendor_id
  where c.id = p_conversation_id
    and c.conversation_kind = 'couple_vendor'
    and e.client_id = p_client_id
    and eva.venue_id = v_session_venue_id;

  if v_kind is null then
    select c.conversation_kind, coalesce(nullif(trim(vnd.business_name), ''), 'Vendor')
    into v_kind, v_vendor_name
    from public.conversations c
    join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
    join public.vendors vnd on vnd.id = vvr.vendor_id
    where c.id = p_conversation_id
      and c.conversation_kind = 'couple_vendor_inquiry'
      and c.relationship_id = v_rel_id
      and c.venue_id = v_session_venue_id;
  end if;

  if v_kind is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  update public.conversation_messages set venue_read_at = now()
  where conversation_id = p_conversation_id
    and sender_type = 'vendor'
    and venue_read_at is null
    and channel not in ('internal_note', 'phone_log', 'voicemail', 'push');

  update public.conversations set venue_unread = 0 where id = p_conversation_id;

  return jsonb_build_object(
    'conversationId', p_conversation_id,
    'vendorName', v_vendor_name,
    'conversationKind', v_kind,
    'messages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', cm.id,
            'senderType', cm.sender_type,
            'body', cm.body,
            'sentAt', cm.sent_at,
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

create or replace function public.send_portal_couple_vendor_message(
  p_access_token text,
  p_client_id uuid,
  p_conversation_id uuid,
  p_body text,
  p_has_attachment boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_rel_id uuid;
  v_kind text;
  v_venue_id uuid;
  v_msg_id uuid;
  v_body text := nullif(trim(p_body), '');
begin
  if v_body is null and not coalesce(p_has_attachment, false) then
    return jsonb_build_object('ok', false, 'error', 'empty_message');
  end if;

  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select c.relationship_id into v_rel_id
  from public.clients c
  where c.id = p_client_id and c.venue_id = v_session_venue_id;
  if v_rel_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select c.conversation_kind, c.venue_id into v_kind, v_venue_id
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  join public.events e on e.id = eva.event_id
  where c.id = p_conversation_id
    and c.conversation_kind = 'couple_vendor'
    and e.client_id = p_client_id
    and eva.venue_id = v_session_venue_id;

  if v_kind is null then
    select c.conversation_kind, c.venue_id into v_kind, v_venue_id
    from public.conversations c
    join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
    where c.id = p_conversation_id
      and c.conversation_kind = 'couple_vendor_inquiry'
      and c.relationship_id = v_rel_id
      and c.venue_id = v_session_venue_id
      and vvr.status <> 'inactive';
  end if;

  if v_kind is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.conversation_messages (
    conversation_id, venue_id, sender_type, sender_id, channel, body
  ) values (
    p_conversation_id, v_venue_id, 'lead_or_client', p_client_id, 'portal',
    coalesce(v_body, '')
  )
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

-- ── 9. Assignment provision: merge inquiry → couple_vendor ───────────────────

create or replace function public.provision_conversation_for_event_vendor_assignment()
returns trigger
language plpgsql
as $$
declare
  v_vendor_relationship_id uuid;
  v_rel_id uuid;
  v_inquiry_id uuid;
begin
  select id into v_vendor_relationship_id
  from public.venue_vendor_relationships
  where venue_id = new.venue_id and vendor_id = new.vendor_id
  limit 1;

  insert into public.conversations (
    venue_id, event_vendor_assignment_id, vendor_relationship_id, conversation_kind
  ) values (
    new.venue_id, new.id, v_vendor_relationship_id, 'venue_vendor'
  )
  on conflict (event_vendor_assignment_id, conversation_kind)
    where event_vendor_assignment_id is not null
  do nothing;

  -- Resolve couple relationship for this event's client
  select cl.relationship_id into v_rel_id
  from public.events e
  join public.clients cl on cl.id = e.client_id
  where e.id = new.event_id;

  if v_rel_id is not null and v_vendor_relationship_id is not null then
    select c.id into v_inquiry_id
    from public.conversations c
    where c.conversation_kind = 'couple_vendor_inquiry'
      and c.relationship_id = v_rel_id
      and c.vendor_relationship_id = v_vendor_relationship_id
    limit 1;
  end if;

  if v_inquiry_id is not null then
    -- Handoff: same conversation becomes the assignment couple_vendor thread
    update public.conversations
    set event_vendor_assignment_id = new.id,
        relationship_id = null,
        conversation_kind = 'couple_vendor',
        vendor_relationship_id = v_vendor_relationship_id
    where id = v_inquiry_id
      and conversation_kind = 'couple_vendor_inquiry';
  else
    insert into public.conversations (
      venue_id, event_vendor_assignment_id, vendor_relationship_id, conversation_kind
    ) values (
      new.venue_id, new.id, v_vendor_relationship_id, 'couple_vendor'
    )
    on conflict (event_vendor_assignment_id, conversation_kind)
      where event_vendor_assignment_id is not null
    do nothing;
  end if;

  return new;
end;
$$;

-- ── 10. Vendor inbox includes inquiries ──────────────────────────────────────

create or replace function public.get_vendor_conversation_inbox()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
              when c.conversation_kind = 'couple_vendor_inquiry' then
                nullif(trim(c.inquiry_context->>'coupleName'), '')
              else null
            end as couple_name,
            case
              when c.conversation_kind in ('couple_vendor', 'couple_vendor_inquiry') then 'Couple'
              else 'Venue'
            end as counterparty_label,
            case
              when c.conversation_kind = 'couple_vendor_inquiry' then
                nullif(c.inquiry_context->>'eventDate', '')::date
              else e.event_date
            end as inquiry_event_date,
            case
              when c.conversation_kind = 'couple_vendor_inquiry' then
                nullif(c.inquiry_context->>'eventType', '')
              else e.event_type
            end as inquiry_event_type,
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

          union all

          select
            c.id as conversation_id,
            c.last_message_at,
            c.contact_unread,
            c.conversation_kind,
            null::uuid as event_id,
            null::text as event_name,
            nullif(c.inquiry_context->>'eventDate', '')::date as event_date,
            coalesce(nullif(c.inquiry_context->>'venueName', ''), v.name) as venue_name,
            nullif(c.inquiry_context->>'coupleName', '') as couple_name,
            'Couple'::text as counterparty_label,
            nullif(c.inquiry_context->>'eventDate', '')::date as inquiry_event_date,
            nullif(c.inquiry_context->>'eventType', '') as inquiry_event_type,
            (
              select jsonb_build_object('body', cmsg.body, 'sender_type', cmsg.sender_type, 'sent_at', cmsg.sent_at)
              from public.conversation_messages cmsg
              where cmsg.conversation_id = c.id
                and cmsg.channel not in ('internal_note', 'phone_log', 'voicemail', 'push')
              order by cmsg.sent_at desc limit 1
            ) as latest_message
          from public.conversations c
          join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
          join public.venues v on v.id = c.venue_id
          where c.conversation_kind = 'couple_vendor_inquiry'
            and vvr.vendor_id = v_vendor_id
            and vvr.status <> 'inactive'
        ) t
      ),
      '[]'::jsonb
    ),
    'total_unread', (
      select coalesce(sum(x.contact_unread), 0)
      from (
        select c.contact_unread
        from public.conversations c
        join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
        where eva.vendor_id = v_vendor_id
          and c.conversation_kind in ('venue_vendor', 'couple_vendor')
        union all
        select c.contact_unread
        from public.conversations c
        join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
        where c.conversation_kind = 'couple_vendor_inquiry'
          and vvr.vendor_id = v_vendor_id
      ) x
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
    select c.conversation_kind into v_kind
    from public.conversations c
    join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
    where c.id = p_conversation_id
      and c.conversation_kind = 'couple_vendor_inquiry'
      and vvr.vendor_id = v_vendor_id;
  end if;

  if v_kind is null then
    return '{"error":"not_found"}'::jsonb;
  end if;

  if v_kind in ('couple_vendor', 'couple_vendor_inquiry') then
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
      'inquiry_context', c.inquiry_context,
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

-- Allow vendor replies on inquiry threads
create or replace function public.send_vendor_conversation_message(
  p_conversation_id uuid,
  p_body text,
  p_has_attachment boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_user_id uuid;
  v_kind text;
  v_venue_id uuid;
  v_msg_id uuid;
  v_body text := nullif(trim(p_body), '');
begin
  v_vendor_id := current_user_vendor_id();
  v_user_id := auth.uid();
  if v_vendor_id is null or v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  if v_body is null and not coalesce(p_has_attachment, false) then
    return jsonb_build_object('ok', false, 'error', 'empty_message');
  end if;

  select c.conversation_kind, c.venue_id into v_kind, v_venue_id
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  where c.id = p_conversation_id and eva.vendor_id = v_vendor_id;

  if v_kind is null then
    select c.conversation_kind, c.venue_id into v_kind, v_venue_id
    from public.conversations c
    join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
    where c.id = p_conversation_id
      and c.conversation_kind = 'couple_vendor_inquiry'
      and vvr.vendor_id = v_vendor_id
      and vvr.status <> 'inactive';
  end if;

  if v_kind is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.conversation_messages (
    conversation_id, venue_id, sender_type, sender_id, channel, body
  ) values (
    p_conversation_id, v_venue_id, 'vendor', v_user_id, 'portal', coalesce(v_body, '')
  )
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

-- ── 11. Message notifications for inquiry ────────────────────────────────────

create or replace function public._trigger_vendor_conversation_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
  v_kind text;
  v_vendor_id uuid;
  v_event_id uuid;
  v_venue_name text;
  v_event_name text;
  v_title text;
  v_body text;
begin
  if new.channel in ('internal_note', 'phone_log', 'voicemail', 'push') then
    return new;
  end if;

  select c.event_vendor_assignment_id, c.conversation_kind
  into v_assignment_id, v_kind
  from public.conversations c
  where c.id = new.conversation_id;

  if v_kind = 'couple_vendor_inquiry' then
    if new.sender_type not in ('lead_or_client', 'contact') then
      return new;
    end if;
    select vvr.vendor_id,
           coalesce(nullif(c.inquiry_context->>'venueName', ''), v.name),
           nullif(c.inquiry_context->>'coupleName', '')
    into v_vendor_id, v_venue_name, v_event_name
    from public.conversations c
    join public.venue_vendor_relationships vvr on vvr.id = c.vendor_relationship_id
    join public.venues v on v.id = c.venue_id
    where c.id = new.conversation_id;

    if v_vendor_id is null then
      return new;
    end if;

    v_title := 'New message from a couple';
    v_body := coalesce(v_event_name, 'A couple') || ' at ' || coalesce(v_venue_name, 'a venue') || ' messaged you.';

    perform public.create_vendor_notification(
      v_vendor_id,
      null,
      null,
      'conversation_message',
      v_title,
      v_body,
      '/vendor/messages/' || new.conversation_id::text,
      '💬'
    );
    return new;
  end if;

  if v_assignment_id is null then
    return new;
  end if;

  select eva.id, eva.vendor_id, eva.event_id, v.name, e.name
  into v_assignment_id, v_vendor_id, v_event_id, v_venue_name, v_event_name
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  join public.venues v on v.id = c.venue_id
  join public.events e on e.id = eva.event_id
  where c.id = new.conversation_id;

  if v_kind = 'couple_vendor' then
    if new.sender_type not in ('lead_or_client', 'contact') then
      return new;
    end if;
    v_title := 'New message from your couple';
    v_body := 'A couple messaged you about ' || coalesce(v_event_name, 'their event') || '.';
  elsif v_kind = 'venue_vendor' then
    if new.sender_type not in ('venue_staff', 'system') then
      return new;
    end if;
    v_title := 'New message from ' || coalesce(v_venue_name, 'your venue');
    v_body := coalesce(v_venue_name, 'Your venue') || ' messaged you about ' || coalesce(v_event_name, 'an event') || '.';
  else
    return new;
  end if;

  perform public.create_vendor_notification(
    v_vendor_id,
    v_event_id,
    v_assignment_id,
    'conversation_message',
    v_title,
    v_body,
    '/vendor/messages/' || new.conversation_id::text,
    '💬'
  );

  return new;
exception when others then
  raise warning '_trigger_vendor_conversation_message_notification failed: %', sqlerrm;
  return new;
end;
$$;

-- ── 12. Directory payload: process attrs + inquiry id ────────────────────────

create or replace function public.get_venue_vendor_directory(
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
  v_rel_id uuid;
  v_vendors jsonb;
  v_required_categories jsonb;
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

  select c.relationship_id into v_rel_id
  from public.clients c
  where c.id = p_client_id and c.venue_id = v_session_venue_id;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('category', category) order by category), '[]'::jsonb)
  into v_required_categories
  from public.venue_required_vendor_categories
  where venue_id = v_session_venue_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',               vvr.id,
      'vendorId',         vnd.id,
      'name',             vnd.business_name,
      'category',         vnd.category,
      'description',      vnd.description,
      'photoUrl',         vnd.logo_url,
      'websiteUrl',       vnd.website_url,
      'email',            vnd.email,
      'phone',            vnd.phone,
      'contactName',      vnd.contact_name,
      'instagramUrl',     vnd.instagram_url,
      'facebookUrl',      vnd.facebook_url,
      'pinterestUrl',     vnd.pinterest_url,
      'tiktokUrl',        vnd.tiktok_url,
      'pricingTier',      vnd.pricing_tier,
      'preferenceLevel',  case
                            when vvr.preference_level = 'featured' then 'preferred'
                            else vvr.preference_level
                          end,
      'isRequired',       vvr.is_required,
      'isInHouse',        vvr.is_in_house,
      'recommendationId', evr.id,
      'pickedAt',         evr.picked_at,
      'selectedAt',       evr.selected_at,
      'isAssigned',       (eva.id is not null),
      'assignmentId',     eva.id,
      'coupleVendorConversationId', (
        select c.id from public.conversations c
        where c.event_vendor_assignment_id = eva.id
          and c.conversation_kind = 'couple_vendor'
        limit 1
      ),
      'inquiryConversationId', (
        select c.id from public.conversations c
        where c.conversation_kind = 'couple_vendor_inquiry'
          and c.relationship_id = v_rel_id
          and c.vendor_relationship_id = vvr.id
        limit 1
      ),
      'isClaimed',        vnd.is_claimed,
      'heroImageUrl',     case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl',    case when vnd.is_claimed then vnd.cover_image_url else null end,
      'serviceArea',      case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', vvr.promotion_headline,
      'promotionDetails',  vvr.promotion_details,
      'packages', case when vnd.is_claimed then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'description', p.description,
          'price', p.price, 'priceType', p.price_type
        ) order by p.sort_order), '[]'::jsonb)
        from public.vendor_packages p
        where p.vendor_id = vnd.id and p.is_active = true
      ) else '[]'::jsonb end,
      'faqs', case when vnd.is_claimed then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', f.id, 'question', f.question, 'answer', f.answer
        ) order by f.sort_order), '[]'::jsonb)
        from public.vendor_faqs f
        where f.vendor_id = vnd.id
      ) else '[]'::jsonb end
    ) order by
      case when vvr.is_required then 0 else 1 end,
      case vvr.preference_level
        when 'preferred' then 0
        when 'recommended' then 1
        else 2
      end,
      vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_vendors
  from public.venue_vendor_relationships vvr
  join public.vendors vnd on vnd.id = vvr.vendor_id
  left join public.event_vendor_recommendations evr
    on evr.vendor_id = vnd.id and evr.event_id = v_event_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where vvr.venue_id = v_session_venue_id and vvr.status <> 'inactive';

  return jsonb_build_object(
    'vendors', coalesce(v_vendors, '[]'::jsonb),
    'requiredCategories', coalesce(v_required_categories, '[]'::jsonb)
  );
end;
$$;

-- ── 13. Claim: enforce invitation expiry ─────────────────────────────────────

create or replace function public.claim_vendor_profile(
  p_claim_token text,
  p_role        text default 'owner'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_vendor  public.vendors%rowtype;
  v_user_id uuid := auth.uid();
  v_invite  public.vendor_invitations%rowtype;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_role not in ('owner', 'manager', 'staff', 'contractor') then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;

  select * into v_invite
  from public.vendor_invitations
  where token = p_claim_token
  order by created_at desc
  limit 1;

  if found then
    if v_invite.status = 'accepted' then
      return jsonb_build_object('ok', false, 'error', 'already_accepted');
    end if;
    if v_invite.status in ('expired', 'revoked') or v_invite.expires_at <= now() then
      if v_invite.status = 'pending' and v_invite.expires_at <= now() then
        update public.vendor_invitations set status = 'expired' where id = v_invite.id;
      end if;
      return jsonb_build_object('ok', false, 'error', 'invitation_expired');
    end if;
  end if;

  select * into v_vendor from public.vendors
  where claim_token = p_claim_token and is_claimed = false;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_already_claimed');
  end if;

  insert into public.vendor_users (vendor_id, user_id, role, accepted_at)
  values (v_vendor.id, v_user_id, p_role, now())
  on conflict (vendor_id, user_id) do update
    set is_active = true, role = excluded.role, accepted_at = now();

  update public.vendors set claim_token = null where id = v_vendor.id;

  update public.venue_vendor_relationships
  set status = 'active'
  where vendor_id = v_vendor.id and status = 'invited';

  update public.vendor_invitations
  set status = 'accepted', accepted_at = now()
  where vendor_id = v_vendor.id and status = 'pending';

  insert into public.vendor_notification_preferences (vendor_id) values (v_vendor.id)
  on conflict (vendor_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'vendor_id', v_vendor.id,
    'already_vendor', exists (
      select 1 from public.vendor_users
      where user_id = v_user_id and vendor_id != v_vendor.id and is_active = true
    )
  );
end;
$$;

-- Accept page preview: honor invitation expiry + always return inviting venue name
create or replace function public.get_vendor_by_claim_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_invite public.vendor_invitations%rowtype;
  v_venue_name text;
  v_invite_by_token boolean := false;
begin
  -- Prefer invitation row keyed by the same token the email used.
  select * into v_invite
  from public.vendor_invitations
  where token = p_token
  order by created_at desc
  limit 1;

  if found then
    v_invite_by_token := true;
    if v_invite.status in ('expired', 'revoked', 'accepted')
       or (v_invite.status = 'pending' and v_invite.expires_at <= now()) then
      if v_invite.status = 'pending' then
        update public.vendor_invitations set status = 'expired' where id = v_invite.id;
      end if;
      return null;
    end if;
  end if;

  select id, business_name, category
  into r
  from public.vendors
  where claim_token = p_token
    and is_claimed = false;

  if not found then return null; end if;

  -- Legacy/network claim tokens may exist without a matching invitations.token.
  -- Still enforce the newest pending invitation expiry for this vendor when present.
  if not v_invite_by_token then
    select * into v_invite
    from public.vendor_invitations
    where vendor_id = r.id
      and status = 'pending'
    order by created_at desc
    limit 1;
    if found and v_invite.expires_at <= now() then
      update public.vendor_invitations set status = 'expired' where id = v_invite.id;
      return null;
    end if;
  end if;

  select coalesce(
           (select name from public.venues where id = v_invite.venue_id),
           (
             select vn.name
             from public.venue_vendor_relationships vvr
             join public.venues vn on vn.id = vvr.venue_id
             where vvr.vendor_id = r.id
               and vvr.status <> 'inactive'
             order by vvr.updated_at desc nulls last
             limit 1
           )
         )
  into v_venue_name;

  return jsonb_build_object(
    'id',           r.id,
    'businessName', r.business_name,
    'category',     r.category,
    'venueName',    v_venue_name
  );
end $$;

notify pgrst, 'reload schema';

-- ── 14. create_vendor_atomic: process attrs + default Approved ───────────────

create or replace function public.create_vendor_atomic(payload jsonb, p_venue_id_override uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id  uuid;
  v_name      text := trim(payload ->> 'businessName');
  v_vendor_id uuid := gen_random_uuid();
  v_pref      text := coalesce(nullif(payload ->> 'preferenceLevel', ''), 'standard');
begin
  v_venue_id := case
    when p_venue_id_override is not null and auth.role() = 'service_role' then p_venue_id_override
    else public.current_user_venue_id()
  end;

  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_name = '' then
    raise exception 'business name is required';
  end if;

  if v_pref = 'featured' then
    v_pref := 'preferred';
  end if;
  if v_pref not in ('standard', 'recommended', 'preferred') then
    v_pref := 'standard';
  end if;

  insert into public.vendors (
    id, business_name, category, contact_name, email, phone, website_url,
    instagram_url, facebook_url, pinterest_url, tiktok_url,
    logo_url, description, pricing_tier
  ) values (
    v_vendor_id, v_name,
    nullif(payload ->> 'category', ''),
    nullif(trim(payload ->> 'contactName'), ''),
    nullif(trim(payload ->> 'email'), ''),
    nullif(trim(payload ->> 'phone'), ''),
    nullif(trim(payload ->> 'websiteUrl'), ''),
    nullif(trim(payload ->> 'instagramUrl'), ''),
    nullif(trim(payload ->> 'facebookUrl'), ''),
    nullif(trim(payload ->> 'pinterestUrl'), ''),
    nullif(trim(payload ->> 'tiktokUrl'), ''),
    nullif(trim(payload ->> 'logoUrl'), ''),
    nullif(trim(payload ->> 'description'), ''),
    nullif(payload ->> 'pricingTier', '')
  );

  insert into public.venue_vendor_relationships (
    venue_id, vendor_id, preference_level, is_required, is_in_house,
    notes, special_pricing_note
  ) values (
    v_venue_id, v_vendor_id,
    v_pref,
    coalesce((payload ->> 'isRequired')::boolean, false),
    coalesce((payload ->> 'isInHouse')::boolean, false),
    nullif(trim(payload ->> 'notes'), ''),
    nullif(trim(payload ->> 'specialPricingNote'), '')
  );

  return v_vendor_id;
end;
$$;

notify pgrst, 'reload schema';

-- ── 15. Recommended tab: same process fields as directory (canonical VVR) ───

create or replace function public.get_event_vendor_recommendations(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_event_id         uuid;
  v_rel_id           uuid;
  v_recommendations  jsonb;
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

  select c.relationship_id into v_rel_id
  from public.clients c
  where c.id = p_client_id and c.venue_id = v_session_venue_id;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('recommendations', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           evr.id,
      'vendorId',     vnd.id,
      'name',         vnd.business_name,
      'category',     vnd.category,
      'description',  vnd.description,
      'photoUrl',     vnd.logo_url,
      'websiteUrl',   vnd.website_url,
      'email',        vnd.email,
      'phone',        vnd.phone,
      'contactName',  vnd.contact_name,
      'instagramUrl', vnd.instagram_url,
      'facebookUrl',  vnd.facebook_url,
      'pinterestUrl', vnd.pinterest_url,
      'tiktokUrl',    vnd.tiktok_url,
      'pricingTier',  vnd.pricing_tier,
      'preferenceLevel', case
                           when vvr.preference_level = 'featured' then 'preferred'
                           else coalesce(vvr.preference_level, 'standard')
                         end,
      'isRequired',   coalesce(vvr.is_required, false),
      'isInHouse',    coalesce(vvr.is_in_house, false),
      'note',         evr.note,
      'source',       evr.source,
      'pickedAt',     evr.picked_at,
      'selectedAt',   evr.selected_at,
      'isAssigned',   (eva.id is not null),
      'assignmentId', eva.id,
      'coupleVendorConversationId', (
        select c.id from public.conversations c
        where c.event_vendor_assignment_id = eva.id
          and c.conversation_kind = 'couple_vendor'
        limit 1
      ),
      'inquiryConversationId', (
        select c.id from public.conversations c
        where c.conversation_kind = 'couple_vendor_inquiry'
          and c.relationship_id = v_rel_id
          and c.vendor_relationship_id = vvr.id
        limit 1
      ),
      'isClaimed',    vnd.is_claimed,
      'heroImageUrl',  case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl', case when vnd.is_claimed then vnd.cover_image_url else null end,
      'serviceArea',   case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', vvr.promotion_headline,
      'promotionDetails',  vvr.promotion_details,
      'packages', case when vnd.is_claimed then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'description', p.description,
          'price', p.price, 'priceType', p.price_type
        ) order by p.sort_order), '[]'::jsonb)
        from public.vendor_packages p
        where p.vendor_id = vnd.id and p.is_active = true
      ) else '[]'::jsonb end,
      'faqs', case when vnd.is_claimed then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', f.id, 'question', f.question, 'answer', f.answer
        ) order by f.sort_order), '[]'::jsonb)
        from public.vendor_faqs f
        where f.vendor_id = vnd.id
      ) else '[]'::jsonb end
    ) order by
      case when coalesce(vvr.is_required, false) then 0 else 1 end,
      case coalesce(vvr.preference_level, 'standard')
        when 'preferred' then 0
        when 'featured' then 0
        when 'recommended' then 1
        else 2
      end,
      vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_recommendations
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  left join public.venue_vendor_relationships vvr
    on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where evr.event_id = v_event_id
    and (evr.source = 'venue' or evr.selected_at is not null or eva.id is not null)
    and (
      coalesce(vvr.status, 'inactive') <> 'inactive'
      or evr.selected_at is not null
      or eva.id is not null
    );

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end;
$$;

notify pgrst, 'reload schema';
