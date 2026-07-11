-- ============================================================================
-- Client Identity Foundation — part 3: pre-auth invitation preview
--
-- Mirrors get_vendor_by_claim_token: the /client/accept and
-- /client/accept-participant pages need to show who invited this person and
-- to what, before they've signed in. Read-only, token-scoped, no PII beyond
-- what the invited person already knows (their own email + the couple/venue
-- name they were told they're joining).
-- ============================================================================

create or replace function public.get_client_invitation_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.client_invitations%rowtype;
  v_couple_name text;
  v_venue_name  text;
begin
  select * into v_inv from public.client_invitations where token = p_token;
  if not found then return null; end if;

  select trim(both ' ' from concat_ws(' & ', c.first_name, c.partner_first_name)),
         v.name
  into v_couple_name, v_venue_name
  from public.clients c
  join public.venues v on v.id = c.venue_id
  where c.id = v_inv.client_id;

  return jsonb_build_object(
    'email',      v_inv.email,
    'status',     v_inv.status,
    'expired',    v_inv.expires_at <= now(),
    'coupleName', v_couple_name,
    'venueName',  v_venue_name
  );
end;
$$;

grant execute on function public.get_client_invitation_by_token(uuid) to anon, authenticated;

create or replace function public.get_couple_participant_invitation_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.couple_portal_participants%rowtype;
  v_couple_name text;
  v_venue_name  text;
begin
  select * into v_p from public.couple_portal_participants where invite_token = p_token;
  if not found then return null; end if;

  select trim(both ' ' from concat_ws(' & ', c.first_name, c.partner_first_name)),
         v.name
  into v_couple_name, v_venue_name
  from public.clients c
  join public.venues v on v.id = c.venue_id
  where c.id = v_p.client_id;

  return jsonb_build_object(
    'email',       v_p.email,
    'firstName',   v_p.first_name,
    'inviteStatus', v_p.invite_status,
    'coupleName',  v_couple_name,
    'venueName',   v_venue_name
  );
end;
$$;

grant execute on function public.get_couple_participant_invitation_by_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
