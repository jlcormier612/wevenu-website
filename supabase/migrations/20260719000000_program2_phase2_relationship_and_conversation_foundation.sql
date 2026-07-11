-- ============================================================================
-- Program 2, Phase 2 — Relationship + Conversation foundation
--
-- Per docs/lead-identity-architectural-exploration.md (confirmed): Lead now
-- represents one Opportunity, not the enduring identity. The enduring
-- counterparty — an individual, couple, family, corporation, or nonprofit —
-- is venue_customer_relationships, the deliberate mirror of the existing
-- vendors/venue_vendor_relationships split on the vendor side of the
-- platform. Conversation anchors to it, per docs/conversation-lifecycle-design.md.
--
-- Deliberately minimal, per explicit agreement:
--   - Matched by email only (the heuristic find_lead_by_email already used).
--   - No global cross-venue identity layer — customers haven't opted into
--     cross-venue correlation the way a claimed Vendor profile implies;
--     that's a separate, privacy-driven decision, not built here. The
--     schema stays additive-compatible with it (every FK below references
--     venue_customer_relationships.id, never email), but nothing here
--     assumes or requires it.
--   - Conversation participants/messages/message_events tables are created
--     per the documented target architecture, but this migration does not
--     backfill historical messages from message_threads/couple_threads,
--     build the couple-portal RPCs, or cut over any UI — those remain a
--     separate, higher-blast-radius pass (schema first, verified on its
--     own, before touching what a coordinator or couple actually sees).
-- ============================================================================

-- ---- venue_customer_relationships -------------------------------------------

create table public.venue_customer_relationships (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues(id) on delete cascade,
  email      text,
  first_name text,
  last_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index venue_customer_relationships_venue_email
  on public.venue_customer_relationships (venue_id, lower(email))
  where email is not null;

create index venue_customer_relationships_venue
  on public.venue_customer_relationships (venue_id);

create trigger venue_customer_relationships_updated_at
  before update on public.venue_customer_relationships
  for each row execute function public.set_updated_at();

alter table public.venue_customer_relationships enable row level security;

create policy "venue_own_customer_relationships" on public.venue_customer_relationships
  for all using (venue_id = current_user_venue_id());

-- RLS alone is not enough — Postgres checks table-level GRANTs first, and
-- new tables get none by default in this project (no ALTER DEFAULT
-- PRIVILEGES is set up anywhere). Every other venue-scoped table explicitly
-- grants authenticated CRUD (see leads, venue_vendor_relationships); this
-- one needs the same or a real coordinator session gets "permission denied"
-- regardless of what the RLS policy above says.
grant select, insert, update, delete on public.venue_customer_relationships to authenticated;

-- ---- leads.relationship_id ---------------------------------------------------

alter table public.leads
  add column relationship_id uuid references public.venue_customer_relationships(id) on delete set null;

create index leads_relationship on public.leads (relationship_id) where relationship_id is not null;

-- ---- find_or_create_relationship: the shared resolver -----------------------
-- Every code path that creates a Lead must resolve a Relationship through
-- this single function — never a second, independently-written match.
create or replace function public.find_or_create_relationship(
  p_venue_id   uuid,
  p_email      text,
  p_first_name text,
  p_last_name  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := nullif(trim(p_email), '');
begin
  if v_email is not null then
    select id into v_id
    from public.venue_customer_relationships
    where venue_id = p_venue_id and lower(email) = lower(v_email)
    limit 1;
  end if;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (p_venue_id, v_email, nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.find_or_create_relationship(uuid, text, text, text) to anon, authenticated;

-- ---- conversations, and everything underneath --------------------------------

create table public.conversations (
  id                     uuid primary key default gen_random_uuid(),
  venue_id               uuid not null references public.venues(id) on delete cascade,
  relationship_id        uuid references public.venue_customer_relationships(id) on delete cascade,
  vendor_relationship_id uuid references public.venue_vendor_relationships(id) on delete cascade,
  last_message_at        timestamptz,
  venue_unread           int not null default 0,
  contact_unread         int not null default 0,
  created_at             timestamptz not null default now(),
  constraint conversations_one_anchor check (
    (relationship_id is not null)::int + (vendor_relationship_id is not null)::int = 1
  )
);
-- One conversation per customer Relationship / per vendor relationship —
-- not per Lead/Opportunity, not per Client, not per Event.
create unique index conversations_relationship_uniq
  on public.conversations (relationship_id) where relationship_id is not null;
create unique index conversations_vendor_uniq
  on public.conversations (vendor_relationship_id) where vendor_relationship_id is not null;
create index conversations_venue on public.conversations (venue_id);

create table public.conversation_participants (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  venue_id         uuid not null references public.venues(id) on delete cascade,
  participant_type text not null check (participant_type in ('venue_staff','lead_or_client','contact','vendor')),
  participant_id   uuid not null, -- venue_staff.id / clients.id / client_contacts.id / vendor_users.id, per participant_type
  created_at       timestamptz not null default now(),
  unique (conversation_id, participant_type, participant_id)
);
create index conversation_participants_conversation on public.conversation_participants (conversation_id);

create table public.conversation_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  venue_id         uuid not null references public.venues(id) on delete cascade,
  sender_type      text not null check (sender_type in ('venue_staff','lead_or_client','contact','vendor','system')),
  sender_id        uuid,
  channel          text not null check (channel in ('email','sms','portal','internal_note','phone_log','voicemail','push')),
  body             text not null,
  body_html        text,
  channel_metadata jsonb not null default '{}',
  sent_at          timestamptz not null default now(),
  venue_read_at    timestamptz,
  contact_read_at  timestamptz
);
create index conversation_messages_conversation on public.conversation_messages (conversation_id, sent_at);
create index conversation_messages_venue on public.conversation_messages (venue_id, sent_at desc);

create table public.conversation_message_events (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.conversation_messages(id) on delete cascade,
  event_type  text not null, -- delivered, bounced, opened, clicked, failed
  occurred_at timestamptz not null default now(),
  payload     jsonb
);
create index conversation_message_events_message on public.conversation_message_events (message_id);

-- last_message_at / unread counts are denormalized convenience fields,
-- maintained here by trigger — never a stored lifecycle state (no `status`
-- column exists on conversations, and none should be added later either).
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set last_message_at = new.sent_at,
      venue_unread   = case when new.sender_type in ('lead_or_client','contact','vendor')
                            then venue_unread + 1 else venue_unread end,
      contact_unread = case when new.sender_type in ('venue_staff','system')
                            then contact_unread + 1 else contact_unread end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger conversation_messages_touch
  after insert on public.conversation_messages
  for each row execute function public.touch_conversation_on_message();

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_message_events enable row level security;

create policy "venue_own_conversations" on public.conversations
  for all using (venue_id = current_user_venue_id());

create policy "venue_own_conversation_participants" on public.conversation_participants
  for all using (venue_id = current_user_venue_id());

create policy "venue_own_conversation_messages" on public.conversation_messages
  for all using (venue_id = current_user_venue_id());

create policy "venue_own_conversation_message_events" on public.conversation_message_events
  for all using (
    exists (
      select 1 from public.conversation_messages cm
      where cm.id = message_id and cm.venue_id = current_user_venue_id()
    )
  );

grant select, insert, update, delete on public.conversations                to authenticated;
grant select, insert, update, delete on public.conversation_participants     to authenticated;
grant select, insert, update, delete on public.conversation_messages        to authenticated;
grant select, insert, update, delete on public.conversation_message_events  to authenticated;

-- ---- Provisioning: a Conversation exists the moment a Relationship does -----
-- Never explicitly created by a person, never lazily created on first
-- message — matching Lead's own "always has an activity log" precedent.
-- Created before the backfill below so the backfill's inserts provision
-- their conversations automatically, with no separate script needed.
create or replace function public.provision_conversation_for_relationship()
returns trigger
language plpgsql
as $$
begin
  insert into public.conversations (venue_id, relationship_id)
  values (new.venue_id, new.id)
  on conflict (relationship_id) where relationship_id is not null do nothing;
  return new;
end;
$$;

create trigger venue_customer_relationships_provision_conversation
  after insert on public.venue_customer_relationships
  for each row execute function public.provision_conversation_for_relationship();

-- ---- Backfill: one Relationship per distinct (venue_id, email) among -------
-- existing Leads. Lossless — Program 2 Phase 1 dedup already guarantees
-- exactly one Lead per email per venue today, so this is a clean 1:1 map.
-- Each insert fires the trigger above, provisioning its Conversation too.
insert into public.venue_customer_relationships (venue_id, email, first_name, last_name, created_at)
select distinct on (l.venue_id, lower(l.email))
  l.venue_id, l.email, l.first_name, l.last_name, l.created_at
from public.leads l
where l.email is not null
order by l.venue_id, lower(l.email), l.created_at asc;

update public.leads l
set relationship_id = r.id
from public.venue_customer_relationships r
where r.venue_id = l.venue_id
  and l.email is not null
  and lower(r.email) = lower(l.email);

-- Leads with no email (manual entries without one — rare) each get their
-- own one-off Relationship; a per-row loop avoids relying on INSERT...
-- SELECT's RETURNING order to correlate back to the source rows.
do $$
declare
  r record;
  v_rel_id uuid;
begin
  for r in
    select id, venue_id, first_name, last_name, created_at
    from public.leads
    where email is null and relationship_id is null
  loop
    insert into public.venue_customer_relationships (venue_id, first_name, last_name, created_at)
    values (r.venue_id, r.first_name, r.last_name, r.created_at)
    returning id into v_rel_id;

    update public.leads set relationship_id = v_rel_id where id = r.id;
  end loop;
end $$;

-- ---- Wire the two automatic public entry points ------------------------------
-- Same shape as Program 2 Phase 1a's find_lead_by_email adoption: every
-- Lead-creating path resolves (or backfills) a relationship_id, never
-- leaves it null for new rows going forward.

create or replace function public.create_public_lead(
  p_embed_key        text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_partner_first    text,
  p_partner_last     text,
  p_partner_email    text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_estimated_budget numeric,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id       uuid;
  v_lead_id        uuid;
  v_relationship_id uuid;
  v_ref            text;
  v_is_new         boolean;
begin
  select id into v_venue_id
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  if nullif(trim(p_email), '') is not null then
    v_lead_id := public.find_lead_by_email(v_venue_id, p_email);
  end if;
  v_is_new := v_lead_id is null;

  v_relationship_id := public.find_or_create_relationship(v_venue_id, p_email, p_first_name, p_last_name);

  if v_is_new then
    insert into public.leads (
      venue_id, status, source, first_name, last_name,
      email, phone, partner_first_name, partner_last_name, partner_email,
      event_type, event_date, guest_count, estimated_budget,
      inquiry_message, inquiry_date, source_data, relationship_id
    ) values (
      v_venue_id, 'new', 'website_form', p_first_name, p_last_name,
      p_email, p_phone, nullif(p_partner_first, ''), nullif(p_partner_last, ''), nullif(p_partner_email, ''),
      nullif(p_event_type, ''), p_event_date, p_guest_count,
      case when p_estimated_budget > 0 then p_estimated_budget else null end,
      nullif(p_message, ''), now(),
      p_source_data || jsonb_build_object('submitted_at', now()),
      v_relationship_id
    )
    returning id into v_lead_id;
  else
    update public.leads
    set relationship_id = coalesce(relationship_id, v_relationship_id)
    where id = v_lead_id;
  end if;

  v_ref := upper(left(replace(v_lead_id::text, '-', ''), 8));

  insert into public.lead_activities (
    venue_id, lead_id, type, title, description
  ) values (
    v_venue_id, v_lead_id,
    'inquiry_received',
    case when v_is_new then 'Inquiry received via website form' else 'New inquiry from returning contact (website form)' end,
    'Submitted by ' || p_first_name || ' ' || p_last_name ||
    case when p_email != '' then ' (' || p_email || ')' else '' end
  );

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'reference_code', v_ref
  );
end;
$$;

create or replace function public.book_tour(
  p_embed_key    text,
  p_slot_start   timestamptz,
  p_first_name   text,
  p_last_name    text,
  p_partner_name text,
  p_email        text,
  p_phone        text,
  p_event_type   text,
  p_event_date   text,
  p_guest_count  integer,
  p_notes        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_lead_id      uuid;
  v_relationship_id uuid;
  v_appt_id      uuid;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  select exists(
    select 1 from public.tour_appointments ta
    where ta.venue_id = v_venue.id
      and ta.status not in ('cancelled')
      and ta.scheduled_at < v_slot_end
      and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id  = v_venue.id
      and cb.start_date <= p_slot_start::date
      and cb.end_date   >= p_slot_start::date
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'date_blocked');
  end if;

  select exists(
    select 1 from public.events e
    where e.venue_id   = v_venue.id
      and e.event_date = p_slot_start::date
      and e.status not in ('cancelled')
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'date_booked');
  end if;

  if nullif(trim(p_email), '') is not null then
    v_lead_id := public.find_lead_by_email(v_venue.id, p_email);
  end if;

  v_relationship_id := public.find_or_create_relationship(v_venue.id, p_email, p_first_name, p_last_name);

  if v_lead_id is null then
    insert into public.leads (
      venue_id, first_name, last_name, partner_first_name,
      email, phone, event_type, event_date, guest_count,
      status, source, source_data, relationship_id
    )
    values (
      v_venue.id, p_first_name, p_last_name, nullif(p_partner_name, ''),
      p_email, nullif(p_phone, ''), nullif(p_event_type, ''),
      nullif(p_event_date, '')::date, p_guest_count,
      'new', 'tour_scheduling', jsonb_build_object('booked_at', now(), 'slot', p_slot_start),
      v_relationship_id
    )
    returning id into v_lead_id;
  else
    update public.leads
    set relationship_id = coalesce(relationship_id, v_relationship_id)
    where id = v_lead_id;

    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (
      v_venue.id, v_lead_id, 'tour_scheduled', 'Tour booked (returning contact)',
      'Booked a tour through the public widget as an existing lead.'
    );
  end if;

  insert into public.tour_appointments (
    venue_id, lead_id, scheduled_at, duration_minutes, status,
    contact_name, contact_email, contact_phone,
    event_type, event_date, guest_count, notes
  )
  values (
    v_venue.id, v_lead_id, p_slot_start, v_venue.tour_duration_minutes, 'scheduled',
    trim(p_first_name || ' ' || p_last_name), p_email, p_phone,
    p_event_type, p_event_date, p_guest_count, p_notes
  )
  returning id into v_appt_id;

  return jsonb_build_object(
    'ok',            true,
    'leadId',        v_lead_id,
    'appointmentId', v_appt_id,
    'scheduledAt',   p_slot_start,
    'venueName',     v_venue.name,
    'duration',      v_venue.tour_duration_minutes
  );
end;
$$;

grant execute on function public.create_public_lead(text, text, text, text, text, text, text, text, text, date, integer, numeric, text, jsonb) to anon, authenticated;
grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text) to anon, authenticated;
