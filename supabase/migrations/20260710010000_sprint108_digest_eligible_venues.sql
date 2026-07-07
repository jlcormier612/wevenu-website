-- Sprint 108: Daily Digest — eligible venues lookup
--
-- get_digest_eligible_venues() powers the /api/digest cron job. It runs
-- under the service role (no user session — see lib/notifications/digest-engine.ts),
-- so this is a SECURITY DEFINER function scoped to the service role only:
-- it exposes every venue's owner email, so it must never be reachable by
-- anon/authenticated callers.

create or replace function public.get_digest_eligible_venues()
returns table (
  venue_id            uuid,
  venue_name          text,
  owner_email         text,
  owner_name          text,
  timezone            text,
  last_digest_hash    text,
  last_digest_sent_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.name,
    u.email,
    s.full_name,
    v.timezone,
    np.last_digest_hash,
    np.last_digest_sent_at
  from public.venues v
  join auth.users u on u.id = v.owner_user_id
  left join public.venue_staff s
    on s.venue_id = v.id and s.is_owner = true
  left join public.venue_notification_preferences np
    on np.venue_id = v.id
  where coalesce(np.daily_digest_enabled, true) = true
    and (np.last_digest_sent_at is null or np.last_digest_sent_at < date_trunc('day', now()));
$$;

-- Explicitly lock this down to service_role only — do NOT grant to anon/authenticated.
revoke all on function public.get_digest_eligible_venues() from public;
grant execute on function public.get_digest_eligible_venues() to service_role;

notify pgrst, 'reload schema';
