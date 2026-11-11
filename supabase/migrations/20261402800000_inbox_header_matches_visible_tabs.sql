-- Header counts only conversations the Inbox tabs actually list.
-- couple_vendor_inquiry is a couple-to-vendor thread, not a venue Lead/Client/Vendor row.
-- A conversation with no messages is not an Inbox row, so it does not count.

create or replace function public.inbox_conversation_in_working_population(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.conversations c
     where c.id = p_conversation_id
       and c.venue_id = current_user_venue_id()
       and exists (
         select 1 from public.conversation_messages cm
          where cm.conversation_id = c.id
       )
       and (
         (
           c.conversation_kind = 'venue_vendor'
         )
         or (
           c.conversation_kind = 'venue_couple'
           and (
             exists (
               select 1 from public.leads ol
                where ol.venue_id = c.venue_id
                  and ol.relationship_id = c.relationship_id
                  and lower(coalesce(ol.sales_stage, '')) not in ('booked', 'lost', 'won', 'cancelled')
             )
             or (
               not exists (
                 select 1 from public.leads ol
                  where ol.venue_id = c.venue_id
                    and ol.relationship_id = c.relationship_id
                    and lower(coalesce(ol.sales_stage, '')) not in ('booked', 'lost', 'won', 'cancelled')
               )
               and exists (
                 select 1 from public.clients cl
                  where cl.venue_id = c.venue_id
                    and cl.relationship_id = c.relationship_id
                    and cl.status is distinct from 'cancelled'
                    and (
                      cl.lifecycle_booked_at is not null
                      or exists (
                        select 1 from public.events ev
                         where ev.client_id = cl.id
                           and ev.venue_id = c.venue_id
                           and ev.booked_at is not null
                           and ev.status is distinct from 'cancelled'
                      )
                    )
               )
             )
           )
         )
       )
  );
$$;

grant execute on function public.inbox_conversation_in_working_population(uuid) to authenticated;
