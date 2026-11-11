-- ============================================================================
-- Team & Permissions — activation + Owner-invite accept semantics
-- ============================================================================

-- Accept team invitation: if owner_invite_pending, become Owner on accept.
create or replace function public.accept_team_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.venue_staff%rowtype;
begin
  select * into v_staff
  from public.venue_staff
  where invite_token = p_token
    and accepted_at  is null
    and is_active    = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  update public.venue_staff
  set user_id      = auth.uid(),
      accepted_at  = now(),
      invite_token = null,
      is_owner     = case when owner_invite_pending then true else is_owner end,
      owner_invite_pending = false,
      -- Ensure Owners get an operational title
      access_title = case
        when owner_invite_pending and (access_title is null or access_title = 'staff')
          then 'administrator'
        else coalesce(access_title, 'staff')
      end,
      title_basis = case
        when owner_invite_pending then coalesce(nullif(title_basis, ''), 'administrator')
        else coalesce(title_basis, access_title, 'staff')
      end
  where id = v_staff.id
  returning * into v_staff;

  -- If they became Owner and venues.owner_user_id still points at a non-owner
  -- purchaser, update account-contact pointer to the accepting Owner.
  if v_staff.is_owner and v_staff.user_id is not null then
    update public.venues
    set owner_user_id = v_staff.user_id
    where id = v_staff.venue_id
      and not exists (
        select 1 from public.venue_staff s
        where s.venue_id = v_staff.venue_id
          and s.user_id = public.venues.owner_user_id
          and s.is_owner = true
          and s.is_active = true
          and s.accepted_at is not null
      );
  end if;

  return jsonb_build_object(
    'ok',      true,
    'venueId', v_staff.venue_id,
    'role',    v_staff.role,
    'isOwner', v_staff.is_owner,
    'accessTitle', v_staff.access_title
  );
end;
$$;

grant execute on function public.accept_team_invitation(uuid) to authenticated;

-- Activation: purchaser_is_owner drives Owner vs Administrator+billing.
-- Optional Owner invite row when setting up on behalf.
create or replace function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid,
  p_purchaser_is_owner boolean default true,
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

  v_purchaser_is_owner := coalesce(
    p_purchaser_is_owner,
    v_enrollment.purchaser_is_owner,
    true
  );
  v_staff_name := coalesce(
    nullif(trim(both from concat_ws(' ', v_enrollment.owner_first_name, v_enrollment.owner_last_name)), ''),
    nullif(v_enrollment.venue_name, ''),
    'Administrator'
  );
  v_billing_overrides := case
    when v_purchaser_is_owner then '{}'::jsonb
    else jsonb_build_object('account.billing', true)
  end;

  -- Persist choice on enrollment for audit
  update public.venue_enrollments
  set purchaser_is_owner = v_purchaser_is_owner,
      invited_owner_name = case when v_purchaser_is_owner then null else coalesce(p_invited_owner_name, invited_owner_name) end,
      invited_owner_email = case when v_purchaser_is_owner then null else lower(trim(coalesce(p_invited_owner_email, invited_owner_email))) end
  where id = v_enrollment.id;

  if v_enrollment.status = 'activated' then
    if v_enrollment.venue_id is not null then
      -- Repair purchaser staff row if missing (idempotent retry)
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

  -- Pending Owner invite (not yet Owner until accept)
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

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
revoke all on function public.activate_venue_enrollment(text, uuid, boolean, text, text) from public;
grant execute on function public.activate_venue_enrollment(text, uuid, boolean, text, text) to service_role;

-- Keep 2-arg overload for older callers (defaults to Owner purchaser)
create or replace function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select * from public.activate_venue_enrollment(
      p_activation_token,
      p_owner_user_id,
      true,
      null,
      null
    );
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;
