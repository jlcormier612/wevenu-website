-- Nav Inbox badge unread count must match the Inbox working population.
--
-- Unread (venue_unread) and needs_response remain independent concepts.
-- Inbox header totals already filter with inbox_conversation_in_working_population.
-- get_conversation_unread_count previously summed venue-wide unread, so
-- orphan / deleted-lead conversations inflated the pink nav badge while the
-- Inbox itself correctly showed "No unread messages".

create or replace function public.get_conversation_unread_count()
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
    return '{"count":0}'::jsonb;
  end if;

  return jsonb_build_object(
    'count', (
      select coalesce(sum(c.venue_unread), 0)
        from public.conversations c
       where c.venue_id = v_venue_id
         and public.inbox_conversation_in_working_population(c.id)
    )
  );
end;
$$;

comment on function public.get_conversation_unread_count() is
  'Venue Inbox unread message count for the nav badge — working population only (same filter as Inbox header total_unread). Not a needs_response count.';

revoke all on function public.get_conversation_unread_count() from public;
grant execute on function public.get_conversation_unread_count() to authenticated;
