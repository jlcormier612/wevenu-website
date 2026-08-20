-- Activation created the venues row but not the owner venue_staff row.
-- The wizard path (complete_venue_setup) always upserts that owner staff
-- record; Setup Hub and team reads expect it. Add the same upsert to the
-- enrollment activation RPC, including a repair on already-activated retries.

create or replace function public.activate_venue_enrollment(
  p_activation_token text,
  p_owner_user_id uuid
)
returns table(venue_id uuid, already_activated boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.venue_enrollments%rowtype;
  v_venue_id   uuid;
begin
  select * into v_enrollment
    from public.venue_enrollments
    where activation_token = p_activation_token
    for update;

  if not found then
    raise exception 'invalid_or_expired_token' using errcode = '22023';
  end if;

  if v_enrollment.status = 'activated' then
    if v_enrollment.venue_id is not null then
      insert into public.venue_staff (
        venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active
      )
      values (
        v_enrollment.venue_id,
        p_owner_user_id,
        coalesce(nullif(v_enrollment.venue_name, ''), 'Owner'),
        v_enrollment.owner_email,
        'owner',
        true,
        now(),
        true
      )
      on conflict (venue_id) where is_owner do update set
        user_id = excluded.user_id,
        email = excluded.email,
        accepted_at = coalesce(public.venue_staff.accepted_at, excluded.accepted_at),
        is_active = true
      where public.venue_staff.venue_id = v_enrollment.venue_id;
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

  -- Deliberately does NOT null out activation_token: a genuine retry of
  -- the same request must still look the row up by token and hit the
  -- already_activated branch above (including the staff repair).

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active
  )
  values (
    v_venue_id,
    p_owner_user_id,
    coalesce(nullif(v_enrollment.venue_name, ''), 'Owner'),
    v_enrollment.owner_email,
    'owner',
    true,
    now(),
    true
  )
  on conflict (venue_id) where is_owner do update set
    user_id = excluded.user_id,
    email = excluded.email,
    accepted_at = coalesce(public.venue_staff.accepted_at, excluded.accepted_at),
    is_active = true
  where public.venue_staff.venue_id = v_venue_id;

  update public.venue_enrollments
    set status = 'activated',
        venue_id = v_venue_id
    where id = v_enrollment.id;

  return query select v_venue_id, false;
end;
$$;

revoke all on function public.activate_venue_enrollment(text, uuid) from public;
grant execute on function public.activate_venue_enrollment(text, uuid) to service_role;
