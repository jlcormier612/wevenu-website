-- ============================================================================
-- Sprint 83: Keepsake & Anniversary Foundation
--
-- "Most platforms end on wedding day. Wevenu doesn't have to."
--
-- Changes:
--   1. venue_anniversary_messages — venue can send anniversary notes to couples
--   2. send_anniversary_message() — RPC for venue coordinator to record a note
--   3. get_portal_anniversary_messages() — couple portal fetches venue notes
-- ============================================================================

-- ── 1. venue_anniversary_messages ─────────────────────────────────────────────
-- Venue-initiated notes for couples post-wedding (anniversary wishes, testimonial
-- requests, etc.). Always opt-in — never auto-sent. Separate from journal (private).

create table public.venue_anniversary_messages (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  message      text not null,
  year_number  int not null default 1,  -- 1 = first anniversary, 2 = second, etc.
  sent_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

alter table public.venue_anniversary_messages enable row level security;

create policy "venue owner manages anniversary messages"
  on public.venue_anniversary_messages for all
  using (exists (
    select 1 from public.venues
    where id = venue_anniversary_messages.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.venue_anniversary_messages to authenticated;

-- ── 2. send_anniversary_message ───────────────────────────────────────────────

create or replace function public.send_anniversary_message(
  p_event_id   uuid,
  p_message    text,
  p_year       int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select v.id into v_venue_id
  from public.venues v
  join public.events e on e.id = p_event_id
  where v.owner_user_id = auth.uid()
    and e.venue_id = v.id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.venue_anniversary_messages (venue_id, event_id, message, year_number)
  values (v_venue_id, p_event_id, trim(p_message), p_year);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.send_anniversary_message(uuid, text, int) to authenticated;

-- ── 3. get_portal_anniversary_messages ───────────────────────────────────────
-- Couple portal fetches anniversary notes their venue has sent.

create or replace function public.get_portal_anniversary_messages(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_messages jsonb;
begin
  select cs.event_id, cs.venue_id into v_session
  from public.client_portal_sessions cs
  where cs.access_token = p_token
    and (cs.expires_at is null or cs.expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',         m.id,
      'message',    m.message,
      'yearNumber', m.year_number,
      'sentAt',     m.sent_at
    ) order by m.sent_at desc
  ), '[]'::jsonb)
  into v_messages
  from public.venue_anniversary_messages m
  where m.event_id = v_session.event_id
    and m.venue_id = v_session.venue_id;

  return jsonb_build_object('messages', v_messages);
end;
$$;

grant execute on function public.get_portal_anniversary_messages(text) to anon, authenticated;

notify pgrst, 'reload schema';
