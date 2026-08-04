-- ============================================================================
-- Couple ↔ vendor conversations (venue-preferred vendor model).
--
-- Design: dedicated pairwise threads, not three-way.
--   venue_couple  — existing relationship_id anchor (couple ↔ venue)
--   venue_vendor  — existing event_vendor_assignment_id (venue ↔ vendor)
--   couple_vendor — NEW, also assignment-anchored, kind discriminant
--
-- Who sees what:
--   Couple portal: couple_vendor threads for their assigned vendors
--   Vendor portal: both venue_vendor and couple_vendor (labeled Venue / Couple)
--   Venue app: venue_vendor only (ops thread); couple_vendor exists in DB
--              but is not required surface for V1
--
-- Unassigned = no assignment row = neither assignment thread exists.
-- ============================================================================

-- ── Kind column ───────────────────────────────────────────────────────────────

alter table public.conversations
  add column if not exists conversation_kind text;

update public.conversations
set conversation_kind = 'venue_couple'
where relationship_id is not null and conversation_kind is null;

update public.conversations
set conversation_kind = 'venue_vendor'
where event_vendor_assignment_id is not null and conversation_kind is null;

alter table public.conversations
  alter column conversation_kind set default 'venue_couple';

alter table public.conversations
  alter column conversation_kind set not null;

alter table public.conversations
  drop constraint if exists conversations_kind_check;

alter table public.conversations
  add constraint conversations_kind_check check (
    conversation_kind in ('venue_couple', 'venue_vendor', 'couple_vendor')
  );

alter table public.conversations
  drop constraint if exists conversations_kind_matches_anchor;

alter table public.conversations
  add constraint conversations_kind_matches_anchor check (
    (conversation_kind = 'venue_couple'
      and relationship_id is not null
      and event_vendor_assignment_id is null)
    or
    (conversation_kind in ('venue_vendor', 'couple_vendor')
      and event_vendor_assignment_id is not null
      and relationship_id is null)
  );

-- Allow two assignment-anchored threads per assignment (venue + couple).
drop index if exists public.conversations_event_vendor_assignment_uniq;

create unique index conversations_event_vendor_assignment_kind_uniq
  on public.conversations (event_vendor_assignment_id, conversation_kind)
  where event_vendor_assignment_id is not null;

-- ── Unread: couple_vendor is couple (venue_unread) ↔ vendor (contact_unread) ─

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

-- ── Provision both venue↔vendor and couple↔vendor on assignment insert ──────

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

  insert into public.conversations (
    venue_id, event_vendor_assignment_id, vendor_relationship_id, conversation_kind
  ) values (
    new.venue_id, new.id, v_vendor_relationship_id, 'venue_vendor'
  )
  on conflict (event_vendor_assignment_id, conversation_kind)
    where event_vendor_assignment_id is not null
  do nothing;

  insert into public.conversations (
    venue_id, event_vendor_assignment_id, vendor_relationship_id, conversation_kind
  ) values (
    new.venue_id, new.id, v_vendor_relationship_id, 'couple_vendor'
  )
  on conflict (event_vendor_assignment_id, conversation_kind)
    where event_vendor_assignment_id is not null
  do nothing;

  return new;
end;
$$;

-- Backfill couple_vendor for every existing assignment that only has venue_vendor.
insert into public.conversations (
  venue_id, event_vendor_assignment_id, vendor_relationship_id, conversation_kind
)
select
  eva.venue_id,
  eva.id,
  (select vvr.id from public.venue_vendor_relationships vvr
    where vvr.venue_id = eva.venue_id and vvr.vendor_id = eva.vendor_id limit 1),
  'couple_vendor'
from public.event_vendor_assignments eva
where not exists (
  select 1 from public.conversations c
  where c.event_vendor_assignment_id = eva.id
    and c.conversation_kind = 'couple_vendor'
);

-- Also ensure venue_vendor rows carry the kind (already backfilled above).
-- Relationship provision should set kind going forward.
create or replace function public.provision_conversation_for_relationship()
returns trigger
language plpgsql
as $$
begin
  insert into public.conversations (venue_id, relationship_id, conversation_kind)
  values (new.venue_id, new.id, 'venue_couple')
  on conflict (relationship_id) where relationship_id is not null do nothing;
  return new;
end;
$$;

-- ── Venue resolve: always the ops (venue↔vendor) thread ──────────────────────

create or replace function public.get_conversation_id_for_event_vendor_assignment(p_assignment_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.conversations
  where event_vendor_assignment_id = p_assignment_id
    and conversation_kind = 'venue_vendor'
  limit 1;
$$;

-- ── Venue rollup: ops threads only (V1) ───────────────────────────────────────

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
          where c.vendor_relationship_id = p_vendor_relationship_id
            and c.venue_id = v_venue_id
            and c.conversation_kind = 'venue_vendor'
        ) t
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ── Vendor inbox: both kinds, labeled ─────────────────────────────────────────

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

-- ── Vendor get/send — kind-aware read receipts ────────────────────────────────

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
      and contact_read_at is null;
  else
    update public.conversation_messages set contact_read_at = now()
    where conversation_id = p_conversation_id
      and sender_type in ('venue_staff', 'system')
      and contact_read_at is null;
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
        ),
        '[]'::jsonb
      )
    )
    from public.conversations c
    where c.id = p_conversation_id
  );
end;
$$;

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
  where c.id = p_conversation_id
    and eva.vendor_id = v_vendor_id
    and c.conversation_kind in ('venue_vendor', 'couple_vendor');

  if v_venue_id is null then
    return '{"ok":false,"error":"not_found"}'::jsonb;
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body)
  values (p_conversation_id, v_venue_id, 'vendor', 'portal', trim(coalesce(p_body, '')))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

-- ── Couple portal: list / get / send couple↔vendor threads ───────────────────

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

  -- Couple's unread lives in venue_unread for couple_vendor threads.
  update public.conversation_messages set venue_read_at = now()
  where conversation_id = p_conversation_id
    and sender_type = 'vendor'
    and venue_read_at is null;

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
  v_event_id uuid;
  v_venue_id uuid;
  v_msg_id uuid;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select c.venue_id into v_venue_id
  from public.conversations c
  join public.event_vendor_assignments eva on eva.id = c.event_vendor_assignment_id
  where c.id = p_conversation_id
    and c.conversation_kind = 'couple_vendor'
    and eva.event_id = v_event_id
    and eva.venue_id = v_session_venue_id;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if length(trim(coalesce(p_body, ''))) = 0 and not p_has_attachment then
    return jsonb_build_object('ok', false, 'error', 'empty_body');
  end if;

  insert into public.conversation_messages (conversation_id, venue_id, sender_type, channel, body)
  values (p_conversation_id, v_venue_id, 'lead_or_client', 'portal', trim(coalesce(p_body, '')))
  returning id into v_msg_id;

  return jsonb_build_object('ok', true, 'message_id', v_msg_id);
end;
$$;

grant execute on function public.get_portal_couple_vendor_conversations(text, uuid)
  to anon, authenticated;
grant execute on function public.get_portal_couple_vendor_conversation(text, uuid, uuid)
  to anon, authenticated;
grant execute on function public.send_portal_couple_vendor_message(text, uuid, uuid, text, boolean)
  to anon, authenticated;

-- Include coupleVendorConversationId on assigned vendors in portal directory/recs
-- (shapes match 20261180000000; only the conversation id field is new).

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
  v_vendors jsonb;
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
      'instagramUrl',     vnd.instagram_url,
      'facebookUrl',      vnd.facebook_url,
      'pinterestUrl',     vnd.pinterest_url,
      'tiktokUrl',        vnd.tiktok_url,
      'preferenceLevel',  vvr.preference_level,
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
      'isClaimed',        vnd.is_claimed,
      'heroImageUrl',     case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl',    case when vnd.is_claimed then vnd.cover_image_url else null end,
      'pricingTier',      case when vnd.is_claimed then vnd.pricing_tier else null end,
      'serviceArea',      case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', case when vnd.is_claimed then vvr.promotion_headline else null end,
      'promotionDetails',  case when vnd.is_claimed then vvr.promotion_details else null end,
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
    ) order by case vvr.preference_level when 'featured' then 0 when 'preferred' then 1 else 2 end,
              vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_vendors
  from public.venue_vendor_relationships vvr
  join public.vendors vnd on vnd.id = vvr.vendor_id
  left join public.event_vendor_recommendations evr
    on evr.vendor_id = vnd.id and evr.event_id = v_event_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where vvr.venue_id = v_session_venue_id and vvr.status <> 'removed';

  return jsonb_build_object('vendors', coalesce(v_vendors, '[]'::jsonb));
end;
$$;

create or replace function public.get_event_vendor_recommendations(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_event_id         uuid;
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
      'instagramUrl', vnd.instagram_url,
      'facebookUrl',  vnd.facebook_url,
      'pinterestUrl', vnd.pinterest_url,
      'tiktokUrl',    vnd.tiktok_url,
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
      'isClaimed',    vnd.is_claimed,
      'heroImageUrl',  case when vnd.is_claimed then vnd.hero_image_url else null end,
      'coverImageUrl', case when vnd.is_claimed then vnd.cover_image_url else null end,
      'pricingTier',   case when vnd.is_claimed then vnd.pricing_tier else null end,
      'serviceArea',   case when vnd.is_claimed then vnd.service_area else null end,
      'availabilityNotes', case when vnd.is_claimed then vnd.availability_notes else null end,
      'promotionHeadline', case when vnd.is_claimed then vvr.promotion_headline else null end,
      'promotionDetails',  case when vnd.is_claimed then vvr.promotion_details else null end,
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
    ) order by vnd.category, vnd.business_name
  ), '[]'::jsonb) into v_recommendations
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  left join public.venue_vendor_relationships vvr
    on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  left join public.event_vendor_assignments eva
    on eva.vendor_id = vnd.id and eva.event_id = v_event_id
  where evr.event_id = v_event_id
    and (evr.source = 'venue' or evr.selected_at is not null or eva.id is not null);

  return jsonb_build_object('recommendations', coalesce(v_recommendations, '[]'::jsonb));
end;
$$;

notify pgrst, 'reload schema';
