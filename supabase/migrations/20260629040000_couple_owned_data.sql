-- ============================================================================
-- Sprint 50: Couple-Owned Data Foundation
--
-- The client portal is not the venue portal filtered for the couple.
-- It is the couple's own planning workspace that also contains a shared
-- section with the venue.
--
-- Two new tables owned by the couple:
--
-- 1. couple_guests — their guest list (venue does NOT see individual records)
--    The venue sees total count via events.guest_count.
--    The couple manages their full list: names, RSVPs, dietary, groups.
--
-- 2. couple_todos — personal planning to-dos, completely separate from
--    venue-assigned event_tasks.
--    "Book florist", "Choose dress" — things the couple owns.
--
-- All access via SECURITY DEFINER functions using the portal token.
-- No coordinator RLS — these tables belong to the couple.
-- ============================================================================

-- ── 1. couple_guests ─────────────────────────────────────────────────────────

create table public.couple_guests (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,

  -- Guest identity
  first_name      text not null check (char_length(trim(first_name)) > 0),
  last_name       text,
  email           text,
  phone           text,

  -- Plus one
  plus_one              boolean not null default false,
  plus_one_name         text,

  -- RSVP
  rsvp_status     text not null default 'pending' check (rsvp_status in (
    'pending',    -- no response yet
    'attending',  -- confirmed attending
    'declined',   -- cannot attend
    'maybe'       -- tentative
  )),
  rsvp_note       text,
  rsvp_at         timestamptz,

  -- Planning metadata
  dietary_restrictions  text,
  group_label     text,    -- "Family", "College Friends", "Work", "Wedding Party"
  table_number    text,    -- future: seating assignment
  notes           text,

  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- RLS: only the couple (via portal token SECURITY DEFINER functions) and venue owner access
alter table public.couple_guests enable row level security;

create policy "venue owner reads couple guests"
  on public.couple_guests for select
  using (exists (
    select 1 from public.venues
    where id = couple_guests.venue_id
      and owner_user_id = auth.uid()
  ));
-- Couple writes via SECURITY DEFINER functions — no direct authenticated insert policy

grant select on public.couple_guests to authenticated;

create index couple_guests_client  on public.couple_guests (client_id);
create index couple_guests_rsvp    on public.couple_guests (client_id, rsvp_status);

-- ── 2. couple_todos ──────────────────────────────────────────────────────────

create table public.couple_todos (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,

  title       text not null check (char_length(trim(title)) > 0),
  notes       text,
  due_date    date,
  category    text check (category in (
    'venue',      -- venue-related planning
    'attire',     -- wedding dress, suits, etc.
    'florals',    -- flowers, bouquets, centerpieces
    'music',      -- DJ, band, playlist
    'catering',   -- food, cake, bar
    'photography',-- photographer, videographer
    'travel',     -- honeymoon, guest travel
    'invitations',-- save-the-dates, invites
    'beauty',     -- hair, makeup
    'other'
  )),

  completed     boolean not null default false,
  completed_at  timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.couple_todos enable row level security;

create policy "venue owner reads couple todos"
  on public.couple_todos for select
  using (exists (
    select 1 from public.venues
    where id = couple_todos.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.couple_todos to authenticated;

create index couple_todos_client on public.couple_todos (client_id);
create index couple_todos_open   on public.couple_todos (client_id, due_date)
  where not completed;

-- ── SECURITY DEFINER functions ────────────────────────────────────────────────

-- get_couple_guests: returns all guests for this portal session
create or replace function public.get_couple_guests(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'guests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           g.id,
          'firstName',    g.first_name,
          'lastName',     g.last_name,
          'email',        g.email,
          'plusOne',      g.plus_one,
          'plusOneName',  g.plus_one_name,
          'rsvpStatus',   g.rsvp_status,
          'rsvpNote',     g.rsvp_note,
          'dietary',      g.dietary_restrictions,
          'groupLabel',   g.group_label,
          'notes',        g.notes
        ) order by g.sort_order, g.first_name
      )
      from public.couple_guests g
      where g.client_id = v_session.client_id
        and g.venue_id  = v_session.venue_id
    ), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'total',    count(*),
        'attending', count(*) filter (where rsvp_status = 'attending'),
        'declined',  count(*) filter (where rsvp_status = 'declined'),
        'pending',   count(*) filter (where rsvp_status = 'pending'),
        'withPlusOnes', count(*) filter (where plus_one = true and rsvp_status = 'attending')
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
    )
  );
end;
$$;

-- add_couple_guest
create or replace function public.add_couple_guest(
  p_token text, p_first_name text, p_last_name text,
  p_email text, p_plus_one boolean, p_group_label text, p_dietary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id uuid;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level = 'financial' or v_session.access_level = 'reminders_only' then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  insert into public.couple_guests
    (venue_id, client_id, first_name, last_name, email, plus_one, group_label, dietary_restrictions)
  values
    (v_session.venue_id, v_session.client_id,
     trim(p_first_name), nullif(trim(p_last_name), ''),
     nullif(trim(p_email), ''), coalesce(p_plus_one, false),
     nullif(trim(p_group_label), ''), nullif(trim(p_dietary), ''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'guestId', v_id);
end;
$$;

-- update_guest_rsvp
create or replace function public.update_guest_rsvp(
  p_token text, p_guest_id uuid, p_status text, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  update public.couple_guests
  set rsvp_status = p_status, rsvp_note = p_note, rsvp_at = now(), updated_at = now()
  where id = p_guest_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- delete_couple_guest
create or replace function public.delete_couple_guest(p_token text, p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  delete from public.couple_guests
  where id = p_guest_id and client_id = v_session.client_id and venue_id = v_session.venue_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- get_couple_todos
create or replace function public.get_couple_todos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'todos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id, 'title', t.title, 'notes', t.notes,
          'dueDate', t.due_date, 'category', t.category,
          'completed', t.completed, 'completedAt', t.completed_at
        ) order by t.completed asc, t.due_date asc nulls last, t.sort_order
      )
      from public.couple_todos t
      where t.client_id = v_session.client_id and t.venue_id = v_session.venue_id
    ), '[]'::jsonb)
  );
end;
$$;

-- add_couple_todo
create or replace function public.add_couple_todo(
  p_token text, p_title text, p_notes text, p_due_date date, p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id uuid;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  insert into public.couple_todos (venue_id, client_id, title, notes, due_date, category)
  values (v_session.venue_id, v_session.client_id,
          trim(p_title), nullif(trim(p_notes),''), p_due_date, nullif(p_category,''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'todoId', v_id);
end;
$$;

-- complete_couple_todo / reopen_couple_todo
create or replace function public.update_couple_todo(
  p_token text, p_todo_id uuid, p_completed boolean, p_title text, p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  update public.couple_todos
  set completed    = coalesce(p_completed, completed),
      completed_at = case when p_completed = true and completed = false then now()
                         when p_completed = false then null
                         else completed_at end,
      title    = coalesce(nullif(trim(p_title), ''), title),
      due_date = coalesce(p_due_date, due_date)
  where id = p_todo_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- delete_couple_todo
create or replace function public.delete_couple_todo(p_token text, p_todo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  delete from public.couple_todos
  where id = p_todo_id and client_id = v_session.client_id and venue_id = v_session.venue_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_couple_guests(text) to anon, authenticated;
grant execute on function public.add_couple_guest(text, text, text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.update_guest_rsvp(text, uuid, text, text) to anon, authenticated;
grant execute on function public.delete_couple_guest(text, uuid) to anon, authenticated;
grant execute on function public.get_couple_todos(text) to anon, authenticated;
grant execute on function public.add_couple_todo(text, text, text, date, text) to anon, authenticated;
grant execute on function public.update_couple_todo(text, uuid, boolean, text, date) to anon, authenticated;
grant execute on function public.delete_couple_todo(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
