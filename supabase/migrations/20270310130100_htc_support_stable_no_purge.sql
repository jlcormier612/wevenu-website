-- Stage 1F hotfix: STABLE venue helpers must not DELETE.
--
-- Bug: htc_support_mode / htc_active_support_venue_id / htc_get_support_context
-- called htc_purge_expired_support_context() (DELETE). Those helpers are STABLE
-- and run inside PostgREST read-only transactions (including via
-- current_user_venue_id used by RLS). Result:
--   "cannot execute DELETE in a read-only transaction"
-- → current_user_venue_id returns null → bootstrap needs_selection forever
-- → select-venue appears stuck even with a valid active_venue_id.
--
-- Fix: filter expires_at > now() only on read paths. Purge remains available
-- for explicit write RPCs (htc_start_support_context).

create or replace function public.htc_support_mode()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
begin
  if uid is null then
    return null;
  end if;
  select c.mode into v_mode
  from public.htc_support_context c
  where c.user_id = uid
    and c.expires_at > now()
  limit 1;
  return v_mode;
end;
$$;

create or replace function public.htc_active_support_venue_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_venue uuid;
begin
  if uid is null then
    return null;
  end if;
  if not public.is_hq_admin() then
    return null;
  end if;
  select c.venue_id into v_venue
  from public.htc_support_context c
  where c.user_id = uid
    and c.expires_at > now()
    and c.venue_id is not null
  limit 1;
  return v_venue;
end;
$$;

create or replace function public.htc_get_support_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.htc_support_context%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'active', false);
  end if;
  select * into r from public.htc_support_context where user_id = uid and expires_at > now();
  if not found then
    return jsonb_build_object('ok', true, 'active', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'active', true,
    'portal', r.portal,
    'mode', r.mode,
    'venue_id', r.venue_id,
    'client_id', r.client_id,
    'vendor_id', r.vendor_id,
    'relationship_id', r.relationship_id,
    'actor_staff_email', r.actor_staff_email,
    'expires_at', r.expires_at
  );
end;
$$;

grant execute on function public.htc_support_mode() to authenticated, anon;
grant execute on function public.htc_active_support_venue_id() to authenticated, anon;
grant execute on function public.htc_get_support_context() to authenticated, service_role;

notify pgrst, 'reload schema';
