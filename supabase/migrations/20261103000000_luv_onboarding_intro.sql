-- ============================================================================
-- Luv Experience Completion — Work Stream 5: one-time, context-aware intro
--
-- No surface introduces Luv to a first-time user today — she's simply
-- ambient from day one (release-readiness-status.md's own finding). This
-- adds exactly one small persisted "seen" flag per audience, reusing the
-- existing venues.onboarding_dismissed boolean's shape rather than
-- inventing a new mechanism. Each flag is set once, by the audience's own
-- action (dismissing the card or following its one CTA), never reset.
-- ============================================================================

alter table public.venues  add column luv_intro_seen_at timestamptz;
alter table public.clients add column luv_intro_seen_at timestamptz;
alter table public.vendors add column luv_intro_seen_at timestamptz;

-- Backfill: an already-established venue/client/vendor (existing before
-- this column existed) should never suddenly see a "welcome, let's get you
-- set up" card mid-tenure — that's exactly the kind of unnecessary
-- interruption the approved brief asks Luv to avoid. Only genuinely new
-- records (created after this migration) start with a null flag and see
-- the real one-time intro.
update public.venues  set luv_intro_seen_at = created_at where luv_intro_seen_at is null;
update public.clients set luv_intro_seen_at = created_at where luv_intro_seen_at is null;
update public.vendors set luv_intro_seen_at = created_at where luv_intro_seen_at is null;

-- Couple-portal reads/writes go through SECURITY DEFINER RPCs, not a raw
-- anon-key read of client_portal_sessions — the exact class of gap TR-L6
-- closed (docs/trust-risk-register.md), not repeated here.
create or replace function public.get_luv_intro_seen(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_seen_at   timestamptz;
begin
  select client_id into v_client_id
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if v_client_id is null then return jsonb_build_object('seen', true); end if;

  select luv_intro_seen_at into v_seen_at from public.clients where id = v_client_id;
  return jsonb_build_object('seen', v_seen_at is not null);
end;
$$;

create or replace function public.mark_luv_intro_seen(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select client_id into v_client_id
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if v_client_id is null then return jsonb_build_object('ok', false); end if;

  update public.clients set luv_intro_seen_at = now() where id = v_client_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_luv_intro_seen(text) to anon, authenticated;
grant execute on function public.mark_luv_intro_seen(text) to anon, authenticated;
