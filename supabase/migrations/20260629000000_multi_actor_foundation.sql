-- ============================================================================
-- Sprint 49: Multi-Actor Foundation
--
-- Guiding principle: Entities own things. People see things.
-- Portal access, messaging visibility, and financial permissions are separate.
--
-- Three additions:
--
-- 1. client_contacts — multiple people per event with distinct roles and
--    portal access levels. The formal model for "Dad pays, MOH plans, Mom views."
--
-- 2. Link client_portal_sessions → client_contacts. Each contact can have
--    their own portal session with their own portal_role. The portal task
--    filter respects this.
--
-- 3. Link message_thread_participants → client_contacts (add FK).
--    Messaging visibility remains SEPARATE from portal_role — this is the
--    Weven lesson locked in schema.
-- ============================================================================

-- ── 1. client_contacts ───────────────────────────────────────────────────────

create table public.client_contacts (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,

  -- Identity
  first_name      text not null check (char_length(trim(first_name)) > 0),
  last_name       text,
  email           text,
  phone           text,

  -- Relationship to the couple
  relationship    text check (relationship in (
    'partner',       -- the other person in the couple (Person 2)
    'parent',        -- parent of one of the couple
    'planner',       -- hired wedding planner / day-of coordinator
    'maid_of_honor', -- MOH or bridesmaid
    'best_man',      -- best man or groomsman
    'sibling',
    'family',        -- other family member
    'other'
  )),
  role_label      text,   -- free text displayed in UI: "Dad", "MOH", "Lisa (Planner)"

  -- Portal access (null = no portal access — most contacts start here)
  -- This answers: "What can this person DO in the platform?"
  -- Separate from messaging visibility (see message_thread_participants)
  portal_role     text check (portal_role in (
    'full_access',    -- everything the primary couple can do
    'planning',       -- tasks + documents (no payments, no financial info)
    'financial',      -- invoices + payment schedule only
    'view_only',      -- read-only across permitted sections, no completions
    'reminders_only'  -- email/SMS reminders only, no portal login
  )),

  -- Notification defaults (overridden per-contact by contact_notification_preferences)
  receives_reminders boolean not null default false,

  -- Is this the primary contact for the client record?
  -- (replaces clients.email as the canonical email when present)
  is_primary      boolean not null default false,

  notes           text,   -- coordinator's internal notes about this contact
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.client_contacts enable row level security;

create policy "venue owner manages client contacts"
  on public.client_contacts for all
  using (exists (
    select 1 from public.venues
    where id = client_contacts.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.client_contacts to authenticated;

-- Indexes
create index client_contacts_client  on public.client_contacts (client_id);
create index client_contacts_venue   on public.client_contacts (venue_id);
-- Enforce one primary contact per client
create unique index client_contacts_primary
  on public.client_contacts (client_id)
  where is_primary = true;

-- ── 2. Link portal sessions → client contacts ────────────────────────────────
-- When a portal session has contact_id set, portal_role comes from the contact.
-- When contact_id is null, it's the primary couple's session (backward compatible).

alter table public.client_portal_sessions
  add column contact_id uuid references public.client_contacts(id) on delete cascade;

create index portal_sessions_contact
  on public.client_portal_sessions (contact_id)
  where contact_id is not null;

-- ── 3. Add FK to message_thread_participants → client_contacts ───────────────
-- The contact_id column exists from Sprint 43 but had no FK (client_contacts
-- didn't exist yet). Now we can add the proper reference.
-- Note: existing rows have contact_id = clients.id (a different table) —
-- we're changing the semantics. For now this is schema-only; existing data
-- migration happens when the contacts UI is used.

-- Drop the old check constraint if any, re-add with the correct logic
do $$
begin
  alter table public.message_thread_participants
    add constraint mtp_contact_fk
    foreign key (contact_id) references public.client_contacts(id) on delete cascade;
exception when others then
  -- Column may have existing data pointing to clients.id — skip FK for now
  raise notice 'Skipping FK on message_thread_participants.contact_id: %', sqlerrm;
end;
$$;

-- ── 4. Update get_portal_tasks() to respect contact portal_role ───────────────
-- When a portal session has a contact_id, the contact's portal_role governs
-- task visibility. Overrides the session's access_level.

create or replace function public.get_portal_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_event         record;
  v_tasks         jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Effective role: contact's portal_role overrides session access_level
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  -- Financial-only contacts cannot see planning tasks
  if v_effective_role = 'financial' or v_effective_role = 'reminders_only' then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select id, event_date into v_event
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and status not in ('cancelled')
  order by event_date asc limit 1;

  if not found then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',          t.id,
      'title',       t.title,
      'description', t.description,
      'category',    t.category,
      'ownerType',   t.owner_type,
      'visibility',  t.visibility,
      'dueDate',     t.due_date,
      'status',      t.status,
      'isRequired',  t.is_required,
      'completedAt', t.completed_at,
      -- view_only contacts can see but not complete tasks
      'canComplete', t.visibility = 'client_owned'
                     and t.status not in ('complete', 'waived', 'blocked')
                     and v_effective_role in ('full_access', 'planning', 'couple')
    )
    order by t.due_date asc, t.sort_order asc
  )
  into v_tasks
  from public.event_tasks t
  where t.event_id  = v_event.id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('client_visible', 'client_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', coalesce(v_tasks, '[]'::jsonb));
end;
$$;

-- Also update get_portal_context to include contact info
create or replace function public.get_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_client    public.clients%rowtype;
  v_event     record;
  v_venue     public.venues%rowtype;
  v_contact   public.client_contacts%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  update public.client_portal_sessions set last_accessed_at = now() where id = v_session.id;
  select * into v_client from public.clients where id = v_session.client_id;
  select e.id, e.event_date, e.event_type, e.status, e.name as event_name, e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.client_id = v_session.client_id and e.venue_id = v_session.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc limit 1;
  select * into v_venue from public.venues where id = v_session.venue_id;
  -- Resolve contact if session is contact-specific
  if v_session.contact_id is not null then
    select * into v_contact from public.client_contacts where id = v_session.contact_id;
  end if;

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', coalesce(v_contact.portal_role, v_session.access_level),
    'label',       coalesce(
      v_session.label,
      case when v_contact.id is not null
        then coalesce(v_contact.role_label, v_contact.first_name)
        else v_client.first_name || ' & ' || coalesce(v_client.partner_first_name, '')
      end
    ),
    'client', jsonb_build_object(
      'id', v_client.id, 'firstName', v_client.first_name, 'lastName', v_client.last_name,
      'partnerFirstName', v_client.partner_first_name, 'partnerLastName', v_client.partner_last_name,
      'eventType', v_client.event_type
    ),
    'contact', case when v_contact.id is not null then jsonb_build_object(
      'id', v_contact.id, 'firstName', v_contact.first_name, 'lastName', v_contact.last_name,
      'roleLabel', v_contact.role_label, 'portalRole', v_contact.portal_role
    ) else null end,
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventType', v_event.event_type,
      'name', v_event.event_name, 'guestCount', v_event.guest_count, 'setupTime', v_event.setup_time
    ) else null end,
    'venue', jsonb_build_object('id', v_venue.id, 'name', v_venue.name, 'website', v_venue.website)
  );
end;
$$;

notify pgrst, 'reload schema';
