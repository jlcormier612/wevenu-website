-- ============================================================================
-- Purchaser ownership choice — fail closed
-- Never default a missing ownership choice to Owner.
-- ============================================================================

-- Must DROP before recreate: CREATE OR REPLACE cannot remove the
-- `p_purchaser_is_owner boolean default true` from migration 053.
drop function if exists public.activate_venue_enrollment(text, uuid, boolean, text, text);
drop function if exists public.activate_venue_enrollment(text, uuid);

-- 5-arg activation: require explicit p_purchaser_is_owner or a previously
-- stored enrollment.purchaser_is_owner. Never coalesce to true.
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
  select * into v_enrollment
    from public.venue_enrollments
    where activation_token = p_activation_token
    for update;

  if not found then
    raise exception 'invalid_or_expired_token' using errcode = '22023';
  end if;

  -- Explicit arg wins; else previously persisted enrollment choice.
  -- Never invent Owner when neither is set.
  v_purchaser_is_owner := coalesce(p_purchaser_is_owner, v_enrollment.purchaser_is_owner);
  if v_purchaser_is_owner is null then
    raise exception 'purchaser_ownership_choice_required: Purchaser ownership choice is required. Explicit p_purchaser_is_owner must be true or false.'
      using errcode = 'P0001';
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

-- Legacy 2-arg overload: must NOT silently default purchaser to Owner.
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
  raise exception 'purchaser_ownership_choice_required'
    using errcode = 'P0001',
      message = 'Purchaser ownership choice is required. Call activate_venue_enrollment(text, uuid, boolean, text, text) with an explicit p_purchaser_is_owner.';
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;

comment on function public.activate_venue_enrollment(text, uuid) is
  'Deprecated fail-closed stub. Use the 5-arg overload with explicit p_purchaser_is_owner.';

-- Self-prove: live function defs never silently default purchaser to Owner.
do $$
declare
  def_5arg text;
  def_2arg text;
begin
  select pg_get_functiondef(
    'public.activate_venue_enrollment(text, uuid, boolean, text, text)'::regprocedure
  ) into def_5arg;
  select pg_get_functiondef(
    'public.activate_venue_enrollment(text, uuid)'::regprocedure
  ) into def_2arg;

  if def_5arg ~* 'coalesce\(\s*p_purchaser_is_owner\s*,\s*v_enrollment\.purchaser_is_owner\s*,\s*true\s*\)' then
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 5-arg still coalesce-defaults to true';
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

  begin
    perform * from public.activate_venue_enrollment(
      'prove-fail-closed-token-never-exists',
      '00000000-0000-4000-8000-000000000001'::uuid
    );
    raise exception 'purchaser_ownership_fail_closed_proof_failed: 2-arg overload did not raise';
  exception
    when sqlstate 'P0001' then
      if position('purchaser_ownership_choice_required' in sqlerrm) = 0
         and position('Purchaser ownership choice is required' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;
