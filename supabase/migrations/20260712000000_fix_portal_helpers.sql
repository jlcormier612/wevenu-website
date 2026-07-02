-- Fix two broken portal helper functions.
--
-- Both used `cps.token` (column is `access_token`) and `cps.event_id`
-- (column doesn't exist on client_portal_sessions). Every feature that
-- called them — RSVP questions, budget setup, seating, docs — silently
-- returned "invalid_token" on every write.
--
-- The fix joins events on (client_id, venue_id) from the session row
-- and picks the earliest upcoming event for this couple.

-- ── _resolve_portal_ids ───────────────────────────────────────────────────────

create or replace function public._resolve_portal_ids(p_token text)
returns table(event_id uuid, client_id uuid, venue_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select e.id as event_id, cps.client_id, cps.venue_id
  from public.client_portal_sessions cps
  join public.events e
    on e.client_id = cps.client_id
   and e.venue_id  = cps.venue_id
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  order by e.event_date asc nulls last
  limit 1;
end;
$$;

-- ── _resolve_portal_event_id ──────────────────────────────────────────────────

create or replace function public._resolve_portal_event_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_event_id uuid;
begin
  select e.id into v_event_id
  from public.client_portal_sessions cps
  join public.events e
    on e.client_id = cps.client_id
   and e.venue_id  = cps.venue_id
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now())
  order by e.event_date asc nulls last
  limit 1;
  return v_event_id;
end;
$$;

grant execute on function public._resolve_portal_ids(text)          to anon, authenticated;
grant execute on function public._resolve_portal_event_id(text)     to anon, authenticated;
