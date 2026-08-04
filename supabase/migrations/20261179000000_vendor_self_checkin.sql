-- Vendor self check-in / setup complete
-- Mirrors venue toggle_vendor_checkin, but authorizes via current_user_vendor_id()
-- so authenticated vendors can update their own assignment flags. Direct table
-- UPDATE is blocked by eva_all (venue_id = current_user_venue_id()).

create or replace function public.vendor_toggle_assignment_checkin(
  p_assignment_id uuid,
  p_field text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_row public.event_vendor_assignments%rowtype;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_field not in ('checked_in', 'setup_complete') then
    return jsonb_build_object('ok', false, 'error', 'invalid_field');
  end if;

  select * into v_row
  from public.event_vendor_assignments
  where id = p_assignment_id
    and vendor_id = v_vendor_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_field = 'checked_in' then
    update public.event_vendor_assignments
    set checked_in_at = case when checked_in_at is null then now() else null end
    where id = p_assignment_id
      and vendor_id = v_vendor_id
    returning checked_in_at into v_row.checked_in_at;

    return jsonb_build_object(
      'ok', true,
      'field', 'checked_in',
      'checkedInAt', v_row.checked_in_at
    );
  end if;

  update public.event_vendor_assignments
  set setup_complete_at = case when setup_complete_at is null then now() else null end
  where id = p_assignment_id
    and vendor_id = v_vendor_id
  returning setup_complete_at into v_row.setup_complete_at;

  return jsonb_build_object(
    'ok', true,
    'field', 'setup_complete',
    'setupCompleteAt', v_row.setup_complete_at
  );
end;
$$;

grant execute on function public.vendor_toggle_assignment_checkin(uuid, text) to authenticated;

notify pgrst, 'reload schema';
