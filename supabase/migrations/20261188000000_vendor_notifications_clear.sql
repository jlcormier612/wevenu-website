-- Clear / dismiss vendor notifications (hard delete).
-- Empty array = clear all for the current vendor org; otherwise delete matching ids.
-- Mirrors mark_vendor_notifications_read auth (current_user_vendor_id).

create or replace function public.clear_vendor_notifications(p_notification_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false);
  end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    delete from public.vendor_notifications
    where vendor_id = v_vendor_id;
  else
    delete from public.vendor_notifications
    where id = any(p_notification_ids)
      and vendor_id = v_vendor_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.clear_vendor_notifications(uuid[]) to authenticated;

notify pgrst, 'reload schema';
