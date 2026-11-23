-- Stage 1G: HTC support sessions must open real customer portals.
-- Extend vendor identity helpers so HQ support context can read vendor portal
-- data without impersonating the vendor auth user or exposing service role.

create or replace function public.current_user_vendor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    return null;
  end if;

  -- Active HTC vendor-portal support session (HQ admin keeps own auth.uid()).
  if public.is_hq_admin() then
    select c.vendor_id into v_id
    from public.htc_support_context c
    where c.user_id = uid
      and c.expires_at > now()
      and c.portal = 'vendor'
      and c.vendor_id is not null
    limit 1;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  select vendor_id into v_id
  from public.vendor_users
  where user_id = uid and is_active = true
  limit 1;
  return v_id;
end;
$$;

create or replace function public.current_user_vendor_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_role text;
begin
  if uid is null then
    return null;
  end if;

  if public.is_hq_admin() then
    if exists (
      select 1
      from public.htc_support_context c
      where c.user_id = uid
        and c.expires_at > now()
        and c.portal = 'vendor'
        and c.vendor_id is not null
    ) then
      -- Read-oriented support view; mutations still gated by app mutation-guard.
      return 'owner';
    end if;
  end if;

  select role into v_role
  from public.vendor_users
  where user_id = uid and is_active = true
  limit 1;
  return v_role;
end;
$$;

grant execute on function public.current_user_vendor_id() to authenticated;
grant execute on function public.current_user_vendor_role() to authenticated;

comment on function public.current_user_vendor_id() is
  'Active vendor_users row, or HTC support vendor_id when HQ support context is active.';
