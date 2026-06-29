-- ============================================================================
-- Sprint 51.5: RSVP Schema Reservation
--
-- "Yes, Guest List and RSVP should be designed as part of the eventual
--  Wedding Website architecture from day one."
--
-- One source of truth:
--   Private Guest List (couple_guests)
--   → Public Website RSVP (future /rsvp/{rsvp_token})
--   → Guest Responds
--   → couple_guests.rsvp_status updated in real time
--   → Counts flow to Venue Intelligence
--
-- This migration reserves the schema so the Wedding Website feature never
-- requires a refactor of couple_guests. The guest list is the database.
-- The wedding website is the public presentation layer.
-- ============================================================================

-- ── RSVP invitation tracking on couple_guests ─────────────────────────────────

alter table public.couple_guests
  -- Unique per-guest token. Goes in the RSVP link: /rsvp/token
  -- Generated when guest is added. Never changes.
  add column rsvp_token text unique default encode(gen_random_bytes(12), 'hex'),

  -- When the couple sent the RSVP invitation to this guest
  -- (via email link, text, or shared link — tracked when couple marks "sent")
  add column rsvp_sent_at timestamptz,

  -- When the guest submitted their RSVP response via the public form
  add column rsvp_responded_at timestamptz,

  -- The wedding website slug for this couple's public RSVP page
  -- Eventually: couple_guests.couple_slug → /rsvp/{couple_slug}?r={rsvp_token}
  -- Stored on the client record or a future couple_website table, not here
  -- (reserved for documentation purposes only)
  add column rsvp_url text;  -- full URL override if needed

-- Index for public RSVP lookups by token
create index couple_guests_rsvp_token
  on public.couple_guests (rsvp_token)
  where rsvp_token is not null;

-- Index: guests waiting for RSVP (invited but no response yet)
create index couple_guests_awaiting_rsvp
  on public.couple_guests (client_id, rsvp_sent_at)
  where rsvp_sent_at is not null and rsvp_responded_at is null;

-- ── Public RSVP stub function ────────────────────────────────────────────────
-- No-op placeholder — body will be replaced when Wedding Website is built.
-- Reserving the function signature so API routes can call it without changes.

create or replace function public.submit_rsvp(
  p_rsvp_token  text,
  p_status      text,      -- attending | declined | maybe
  p_plus_one    boolean default false,
  p_plus_one_name text default null,
  p_dietary     text default null,
  p_note        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.couple_guests%rowtype;
begin
  select * into v_guest
  from public.couple_guests
  where rsvp_token = p_rsvp_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_rsvp_link');
  end if;

  if p_status not in ('attending', 'declined', 'maybe') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  update public.couple_guests
  set rsvp_status         = p_status,
      rsvp_responded_at   = now(),
      plus_one            = coalesce(p_plus_one, plus_one),
      plus_one_name       = coalesce(p_plus_one_name, plus_one_name),
      dietary_restrictions = coalesce(p_dietary, dietary_restrictions),
      rsvp_note           = coalesce(p_note, rsvp_note),
      rsvp_at             = now(),
      updated_at          = now()
  where rsvp_token = p_rsvp_token;

  -- Log the activity (non-critical — ignore errors)
  begin
    insert into public.couple_portal_events
      (venue_id, client_id, event_type, event_data)
    values
      (v_guest.venue_id, v_guest.client_id, 'rsvp_received',
       jsonb_build_object('guestId', v_guest.id, 'status', p_status));
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok',         true,
    'guestName',  v_guest.first_name || coalesce(' ' || v_guest.last_name, ''),
    'status',     p_status,
    'venueName',  (select name from public.venues where id = v_guest.venue_id)
  );
end;
$$;

grant execute on function public.submit_rsvp(text, text, boolean, text, text, text) to anon, authenticated;

-- Mark rsvp_sent (when couple sends invitations to a batch of guests)
create or replace function public.mark_rsvp_sent(p_token text, p_guest_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_count   integer;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  update public.couple_guests
  set rsvp_sent_at = now(), updated_at = now()
  where id = any(p_guest_ids)
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and rsvp_sent_at is null;  -- only mark unsent ones

  get diagnostics v_count = row_count;

  insert into public.couple_portal_events (venue_id, client_id, session_id, event_type, event_data)
  values (v_session.venue_id, v_session.client_id, v_session.id,
          'rsvp_sent', jsonb_build_object('count', v_count));

  return jsonb_build_object('ok', true, 'marked', v_count);
end;
$$;

grant execute on function public.mark_rsvp_sent(text, uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
