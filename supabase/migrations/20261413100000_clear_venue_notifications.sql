-- Clear / dismiss venue coordinator notifications (hard delete).
-- Empty array = clear all for the current active venue; otherwise delete
-- matching ids that belong to that venue. Mirrors mark_notifications_read
-- auth (current_user_venue_id). Does not touch vendor_notifications or
-- couple_notifications.

create or replace function public.clear_venue_notifications(p_notification_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then
    return jsonb_build_object('ok', false);
  end if;

  if array_length(p_notification_ids, 1) is null or array_length(p_notification_ids, 1) = 0 then
    delete from public.venue_notifications
    where venue_id = v_venue_id;
  else
    delete from public.venue_notifications
    where id = any(p_notification_ids)
      and venue_id = v_venue_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.clear_venue_notifications(uuid[]) to authenticated;

notify pgrst, 'reload schema';
