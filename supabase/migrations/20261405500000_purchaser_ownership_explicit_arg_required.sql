-- ============================================================================
-- Purchaser ownership — explicit RPC arg required (no enrollment coalesce)
--
-- Migration 054 removed `default true` and the 3-arg coalesce-to-true, but still
-- allowed `coalesce(p_purchaser_is_owner, v_enrollment.purchaser_is_owner)`.
-- That path silently treats a missing/null RPC arg as Owner whenever the
-- enrollment row already stored true — violating fail-closed.
--
-- Locked contract:
--   explicit true  → purchaser is Owner
--   explicit false → purchaser is non-owner Administrator (+ billing override)
--   null/omitted   → rejected (even if enrollment.purchaser_is_owner is set)
--   2-arg legacy   → rejected
--
-- Sandbox note: 054 is already recorded as applied. This migration is additive
-- and safe against the live 054 function body. Wrapped in one transaction so a
-- failed self-proof rolls back the recreated functions.
-- ============================================================================

begin;

drop function if exists public.activate_venue_enrollment(text, uuid, boolean, text, text);
drop function if exists public.activate_venue_enrollment(text, uuid);

create function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid,
  p_purchaser_is_owner boolean,
  p_invited_owner_name text default null,
  p_invited_owner_email text default null
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.venue_enrollments%rowtype;
  v_venue_id   uuid;
  v_purchaser_is_owner boolean;
  v_staff_name text;
  v_billing_overrides jsonb;
begin
  -- Fail closed before any lookup: omitted/null ownership is never Owner.
  if p_purchaser_is_owner is null then
    raise exception 'purchaser_ownership_choice_required: Purchaser ownership choice is required. Explicit p_purchaser_is_owner must be true or false.'
      using errcode = 'P0001';
  end if;
  v_purchaser_is_owner := p_purchaser_is_owner;

  select * into v_enrollment
    from public.venue_enrollments
    where activation_token = p_activation_token
    for update;

  if not found then
    raise exception 'invalid_or_expired_token' using errcode = '22023';
  end if;

  v_staff_name := coalesce(
    nullif(trim(both from concat_ws(' ', v_enrollment.owner_first_name, v_enrollment.owner_last_name)), ''),
    nullif(v_enrollment.venue_name, ''),
    'Administrator'
  );
  v_billing_overrides := case
    when v_purchaser_is_owner then '{}'::jsonb
    else jsonb_build_object('account.billing', true)
  end;

  update public.venue_enrollments
  set purchaser_is_owner = v_purchaser_is_owner,
      invited_owner_name = case when v_purchaser_is_owner then null else coalesce(p_invited_owner_name, invited_owner_name) end,
      invited_owner_email = case when v_purchaser_is_owner then null else lower(trim(coalesce(p_invited_owner_email, invited_owner_email))) end
  where id = v_enrollment.id;

  if v_enrollment.status = 'activated' then
    if v_enrollment.venue_id is not null then
      if not exists (
        select 1 from public.venue_staff
        where venue_id = v_enrollment.venue_id
          and user_id = p_owner_user_id
          and is_active = true
      ) then
        insert into public.venue_staff (
          venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active,
          access_title, title_basis, capability_overrides, owner_invite_pending
        )
        values (
          v_enrollment.venue_id,
          p_owner_user_id,
          v_staff_name,
          v_enrollment.owner_email,
          public.legacy_role_for_access('administrator', v_purchaser_is_owner),
          v_purchaser_is_owner,
          now(),
          true,
          'administrator',
          'administrator',
          v_billing_overrides,
          false
        );
      end if;
    end if;
    return query select v_enrollment.venue_id, true;
    return;
  end if;

  if v_enrollment.activation_token_created_at is null
     or v_enrollment.activation_token_created_at < now() - interval '30 days' then
    raise exception 'token_expired' using errcode = '22023';
  end if;

  insert into public.venues (owner_user_id, name, email)
    values (p_owner_user_id, v_enrollment.venue_name, v_enrollment.owner_email)
    returning id into v_venue_id;

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active,
    access_title, title_basis, capability_overrides, owner_invite_pending
  )
  values (
    v_venue_id,
    p_owner_user_id,
    v_staff_name,
    v_enrollment.owner_email,
    public.legacy_role_for_access('administrator', v_purchaser_is_owner),
    v_purchaser_is_owner,
    now(),
    true,
    'administrator',
    'administrator',
    v_billing_overrides,
    false
  );

  if not v_purchaser_is_owner
     and nullif(trim(coalesce(p_invited_owner_email, v_enrollment.invited_owner_email, '')), '') is not null
  then
    insert into public.venue_staff (
      venue_id, user_id, full_name, email, role, is_owner, is_active,
      invited_at, access_title, title_basis, capability_overrides, owner_invite_pending
    )
    values (
      v_venue_id,
      null,
      coalesce(nullif(trim(coalesce(p_invited_owner_name, v_enrollment.invited_owner_name, '')), ''), 'Owner'),
      lower(trim(coalesce(p_invited_owner_email, v_enrollment.invited_owner_email))),
      public.legacy_role_for_access('administrator', false),
      false,
      true,
      now(),
      'administrator',
      'administrator',
      '{}'::jsonb,
      true
    );
  end if;

  update public.venue_enrollments
    set status = 'activated',
        venue_id = v_venue_id
    where id = v_enrollment.id;

  return query select v_venue_id, false;
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid, boolean, text, text) from public;
grant execute on function public.activate_venue_enrollment(text, uuid, boolean, text, text) to service_role;

create function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'purchaser_ownership_choice_required: Purchaser ownership choice is required. Call activate_venue_enrollment(text, uuid, boolean, text, text) with an explicit p_purchaser_is_owner.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;

comment on function public.activate_venue_enrollment(text, uuid) is
  'Deprecated fail-closed stub. Use the 5-arg overload with explicit p_purchaser_is_owner.';

comment on function public.activate_venue_enrollment(text, uuid, boolean, text, text) is
  'Activate enrollment. p_purchaser_is_owner must be explicit true/false; null is rejected (never defaults from enrollment or to Owner).';

-- Self-prove: defs + live behavior for null/true/false/2-arg.
do $$
declare
  def_5arg text;
  def_2arg text;
  v_user_id uuid;
  v_token_null text := 'proof-own-055-null-' || gen_random_uuid()::text;
  v_token_true text := 'proof-own-055-true-' || gen_random_uuid()::text;
  v_token_false text := 'proof-own-055-false-' || gen_random_uuid()::text;
  v_enroll_null uuid;
  v_enroll_true uuid;
  v_enroll_false uuid;
  v_venue_true uuid;
  v_venue_false uuid;
  v_staff_owner boolean;
  v_staff_overrides jsonb;
  v_invite_pending boolean;
begin
  select pg_get_functiondef(
    'public.activate_venue_enrollment(text, uuid, boolean, text, text)'::regprocedure
  ) into def_5arg;
  select pg_get_functiondef(
    'public.activate_venue_enrollment(text, uuid)'::regprocedure
  ) into def_2arg;

  if def_5arg ~* 'p_purchaser_is_owner\s+boolean\s+default\s+true' then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 5-arg still has default true';
  end if;
  if def_5arg ~* 'coalesce\s*\(\s*p_purchaser_is_owner\s*,' then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 5-arg still coalesces p_purchaser_is_owner';
  end if;
  if position('if p_purchaser_is_owner is null then' in def_5arg) = 0 then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 5-arg missing explicit null reject';
  end if;
  if position('purchaser_ownership_choice_required' in def_5arg) = 0 then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 5-arg missing choice_required raise';
  end if;
  if position('purchaser_ownership_choice_required' in def_2arg) = 0 then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 2-arg missing choice_required raise';
  end if;
  if def_2arg ~* 'activate_venue_enrollment\(\s*p_activation_token\s*,\s*p_owner_user_id\s*,\s*true' then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 2-arg still forwards true';
  end if;

  -- 2-arg legacy invocation must raise (never Owner).
  begin
    perform * from public.activate_venue_enrollment(
      'prove-fail-closed-token-never-exists',
      '00000000-0000-4000-8000-000000000001'::uuid
    );
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 2-arg overload did not raise';
  exception
    when sqlstate 'P0001' then
      if position('purchaser_ownership_choice_required' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- 5-arg null before lookup must raise (even with invalid token).
  begin
    perform * from public.activate_venue_enrollment(
      'prove-null-arg-never-exists',
      '00000000-0000-4000-8000-000000000001'::uuid,
      null,
      null,
      null
    );
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 5-arg null did not raise';
  exception
    when sqlstate 'P0001' then
      if position('purchaser_ownership_choice_required' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- Pick a free auth user (not already venues.owner_user_id).
  select u.id into v_user_id
  from auth.users u
  where not exists (
    select 1 from public.venues v where v.owner_user_id = u.id
  )
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: no free auth.users row for membership proof';
  end if;

  -- Enrollment with stored purchaser_is_owner=true + null RPC arg → still rejected.
  insert into public.venue_enrollments (
    venue_name, owner_email, owner_first_name, owner_last_name,
    status, onboarding_type, activation_token, activation_token_created_at,
    purchaser_is_owner
  ) values (
    'Proof 055 Null Reject',
    'proof-055-null-' || replace(gen_random_uuid()::text, '-', '') || '@example.com',
    'Proof', 'Null',
    'pending', 'self_setup', v_token_null, now(),
    true
  ) returning id into v_enroll_null;

  begin
    perform * from public.activate_venue_enrollment(
      v_token_null, v_user_id, null, null, null
    );
    raise exception 'purchaser_ownership_fail_closed_proof_failed: null arg with enrollment.true still activated';
  exception
    when sqlstate 'P0001' then
      if position('purchaser_ownership_choice_required' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  -- Explicit true → Owner staff, empty billing overrides.
  insert into public.venue_enrollments (
    venue_name, owner_email, owner_first_name, owner_last_name,
    status, onboarding_type, activation_token, activation_token_created_at,
    purchaser_is_owner
  ) values (
    'Proof 055 Owner',
    'proof-055-true-' || replace(gen_random_uuid()::text, '-', '') || '@example.com',
    'Proof', 'Owner',
    'pending', 'self_setup', v_token_true, now(),
    null
  ) returning id into v_enroll_true;

  select venue_id into v_venue_true
  from public.activate_venue_enrollment(v_token_true, v_user_id, true, null, null);

  select is_owner, capability_overrides
    into v_staff_owner, v_staff_overrides
  from public.venue_staff
  where venue_id = v_venue_true and user_id = v_user_id and is_active = true;

  if v_staff_owner is distinct from true then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: explicit true did not create Owner staff';
  end if;
  if coalesce(v_staff_overrides, '{}'::jsonb) <> '{}'::jsonb then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: Owner staff has unexpected billing overrides';
  end if;

  -- Explicit false → non-owner Administrator + billing override + pending Owner invite.
  -- Need a second free user (first is now venues.owner_user_id from true case).
  select u.id into v_user_id
  from auth.users u
  where not exists (
    select 1 from public.venues v where v.owner_user_id = u.id
  )
  order by u.created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: no second free auth.users row for on-behalf proof';
  end if;

  insert into public.venue_enrollments (
    venue_name, owner_email, owner_first_name, owner_last_name,
    status, onboarding_type, activation_token, activation_token_created_at,
    purchaser_is_owner
  ) values (
    'Proof 055 On Behalf',
    'proof-055-false-' || replace(gen_random_uuid()::text, '-', '') || '@example.com',
    'Proof', 'Admin',
    'pending', 'self_setup', v_token_false, now(),
    null
  ) returning id into v_enroll_false;

  select venue_id into v_venue_false
  from public.activate_venue_enrollment(
    v_token_false,
    v_user_id,
    false,
    'Invited Owner',
    'invited-owner-055-' || replace(gen_random_uuid()::text, '-', '') || '@example.com'
  );

  select is_owner, capability_overrides
    into v_staff_owner, v_staff_overrides
  from public.venue_staff
  where venue_id = v_venue_false and user_id = v_user_id and is_active = true;

  if v_staff_owner is distinct from false then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: explicit false created Owner staff';
  end if;
  if coalesce(v_staff_overrides ->> 'account.billing', '') <> 'true' then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: on-behalf missing account.billing override';
  end if;

  select owner_invite_pending into v_invite_pending
  from public.venue_staff
  where venue_id = v_venue_false
    and user_id is null
    and owner_invite_pending = true
  limit 1;

  if v_invite_pending is distinct from true then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: on-behalf missing pending Owner invite row';
  end if;

  -- Cleanup proof rows (transaction still commits the function defs).
  delete from public.venue_staff where venue_id in (v_venue_true, v_venue_false);
  delete from public.venues where id in (v_venue_true, v_venue_false);
  delete from public.venue_enrollments where id in (v_enroll_null, v_enroll_true, v_enroll_false);
end;
$$;

commit;
