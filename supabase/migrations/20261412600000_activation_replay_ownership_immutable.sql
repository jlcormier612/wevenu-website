-- Activation replay: purchaser_is_owner is immutable once activated.
-- Already-activated calls must not rewrite ownership, invitations, or staff
-- from a later request. Missing-staff repair uses the stored choice only.

create or replace function public.activate_venue_enrollment(
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
begin
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

  -- Already activated: ownership decision is locked. Do not rewrite
  -- purchaser_is_owner, invited owner fields, or invitation rows from this
  -- request. Repair missing staff only with the stored choice.
  if v_enrollment.status = 'activated' then
    if v_enrollment.venue_id is not null then
      if v_enrollment.purchaser_is_owner is not null then
        perform public.provision_enrollment_venue(
          v_enrollment.id,
          p_owner_user_id,
          v_enrollment.purchaser_is_owner
        );
      end if;
      return query select v_enrollment.venue_id, true;
      return;
    end if;

    v_venue_id := public.provision_enrollment_venue(
      v_enrollment.id,
      p_owner_user_id,
      null
    );
    return query select v_venue_id, true;
    return;
  end if;

  if v_enrollment.activation_token_created_at is null
     or v_enrollment.activation_token_created_at < now() - interval '30 days' then
    raise exception 'token_expired' using errcode = '22023';
  end if;

  update public.venue_enrollments
  set purchaser_is_owner = v_purchaser_is_owner,
      invited_owner_name = case when v_purchaser_is_owner then null else coalesce(p_invited_owner_name, invited_owner_name) end,
      invited_owner_email = case when v_purchaser_is_owner then null else lower(trim(coalesce(p_invited_owner_email, invited_owner_email))) end
  where id = v_enrollment.id;

  v_venue_id := public.provision_enrollment_venue(
    v_enrollment.id,
    p_owner_user_id,
    v_purchaser_is_owner
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

-- 2-arg overload stays fail-closed (ownership choice required).
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
  raise exception 'purchaser_ownership_choice_required: Purchaser ownership choice is required. Call activate_venue_enrollment(text, uuid, boolean, text, text) with an explicit p_purchaser_is_owner.'
    using errcode = 'P0001';
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;
