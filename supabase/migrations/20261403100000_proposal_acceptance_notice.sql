-- Couple proposal acceptance notifies the venue and writes one activity row.
--
-- accept_commercial_selection already persisted status and accepted_at.
-- It did not tell the venue, and it did not write relationship history.
-- The notice and the activity run only on the offered → accepted transition.
-- A second accept (already accepted) returns before either write.
--
-- This does not book the event. Booking stays in the application booking rule.

create or replace function public.accept_commercial_selection(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_selections%rowtype;
  v_who text;
  v_amount text;
  v_title text;
  v_link text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_selections
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'accepted' then
    return jsonb_build_object('ok', true, 'id', v_row.id, 'alreadyAccepted', true);
  end if;

  if v_row.status <> 'offered' then
    return jsonb_build_object('ok', false, 'error', 'not_offered');
  end if;

  update public.commercial_selections
  set status = 'accepted',
      accepted_at = now()
  where id = v_row.id;

  v_who := null;
  if v_row.lead_id is not null then
    select nullif(trim(concat_ws(' ',
      nullif(trim(l.first_name), ''),
      nullif(trim(l.last_name), '')
    )), '')
    into v_who
    from public.leads l
    where l.id = v_row.lead_id
      and l.venue_id = v_row.venue_id;
  end if;
  if v_who is null and v_row.client_id is not null then
    select nullif(trim(concat_ws(' ',
      nullif(trim(c.first_name), ''),
      nullif(trim(c.last_name), '')
    )), '')
    into v_who
    from public.clients c
    where c.id = v_row.client_id
      and c.venue_id = v_row.venue_id;
  end if;
  if v_who is null then
    v_who := 'A couple';
  end if;

  v_amount := trim(to_char(v_row.total_amount, 'FM$999,999,990.00'));
  v_title := v_who || ' accepted the ' || v_row.name || ' proposal.';

  if v_row.lead_id is not null then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (v_row.venue_id, v_row.lead_id, 'proposal_accepted', v_title, v_amount);
  elsif v_row.client_id is not null then
    insert into public.client_activities (venue_id, client_id, type, title, description)
    values (v_row.venue_id, v_row.client_id, 'proposal_accepted', v_title, v_amount);
  end if;

  if v_row.client_id is not null then
    v_link := '/clients/' || v_row.client_id::text;
  elsif v_row.lead_id is not null then
    v_link := '/leads/' || v_row.lead_id::text;
  else
    v_link := null;
  end if;

  perform public.create_venue_notification(
    v_row.venue_id,
    v_row.event_id,
    'proposal_accepted',
    v_title,
    v_amount,
    v_link,
    null
  );

  return jsonb_build_object('ok', true, 'id', v_row.id, 'alreadyAccepted', false);
end;
$$;

revoke all on function public.accept_commercial_selection(text) from public;
grant execute on function public.accept_commercial_selection(text) to anon, authenticated, service_role;

-- Public proposal lookup may show the venue name. It still must not return
-- client contact fields, notes, or other selections.
create or replace function public.get_commercial_selection_by_accept_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_selections%rowtype;
  v_venue_name text;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_row
  from public.commercial_selections
  where accept_token = p_token
    and status in ('offered', 'accepted')
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select v.name into v_venue_name
  from public.venues v
  where v.id = v_row.venue_id;

  return jsonb_build_object(
    'id', v_row.id,
    'venueId', v_row.venue_id,
    'venueName', v_venue_name,
    'name', v_row.name,
    'totalAmount', v_row.total_amount,
    'depositAmount', v_row.deposit_amount,
    'remainingAmount', v_row.total_amount - v_row.deposit_amount,
    'includedItems', v_row.included_items,
    'status', v_row.status,
    'offeredAt', v_row.offered_at,
    'acceptedAt', v_row.accepted_at,
    'offerMessage', v_row.offer_message
  );
end;
$$;

revoke all on function public.get_commercial_selection_by_accept_token(text) from public;
grant execute on function public.get_commercial_selection_by_accept_token(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
