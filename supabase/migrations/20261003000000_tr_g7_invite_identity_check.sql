-- ============================================================================
-- TR-G7 — Invite identity check
--
-- Manager Permissions Architecture Remediation (docs/manager-permissions-
-- architecture-remediation-plan.md). accept_team_invitation(p_token) matches
-- purely on invite_token and never compares the calling session's email to
-- the venue_staff.email the invite names. Live-tested during the Manager
-- Permissions Release Readiness audit: an invite addressed to one email was
-- successfully claimed by a completely unrelated, already-registered
-- account, which ended up holding two simultaneous, differently-roled rows
-- at the same venue — current_user_role()/current_user_venue_id() have no
-- ORDER BY on their underlying "limit 1" lookups, so which role governed a
-- given request in that state was Postgres's arbitrary choice.
--
-- Fix, two parts:
--   1. accept_team_invitation additionally requires the authenticated
--      user's auth.users.email to case-insensitively match the invited
--      venue_staff.email before binding user_id/accepted_at. The
--      v_staff.email is not null guard preserves current behavior for the
--      (currently unused) case of an invite created with no email.
--   2. A partial unique index makes "one user, two simultaneous active
--      roles at one venue" structurally impossible regardless of how it's
--      reached — closing both this bug and the adjacent edge case of the
--      same email being invited twice by mistake. Scoped to (venue_id,
--      user_id), so a user legitimately staff at two different venues is
--      unaffected.
-- ============================================================================

create unique index venue_staff_one_active_role_per_user
  on public.venue_staff (venue_id, user_id)
  where accepted_at is not null and is_active = true;

create or replace function public.accept_team_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.venue_staff%rowtype;
  v_email text;
begin
  select * into v_staff
  from public.venue_staff
  where invite_token = p_token
    and accepted_at  is null
    and is_active    = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  if v_staff.email is not null then
    select email into v_email from auth.users where id = auth.uid();
    if v_email is null or lower(trim(v_staff.email)) <> lower(trim(v_email)) then
      return jsonb_build_object('ok', false, 'error', 'email_mismatch');
    end if;
  end if;

  update public.venue_staff
  set user_id      = auth.uid(),
      accepted_at  = now(),
      invite_token = null
  where id = v_staff.id;

  return jsonb_build_object(
    'ok',      true,
    'venueId', v_staff.venue_id,
    'role',    v_staff.role
  );

exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_a_member');
end;
$$;
