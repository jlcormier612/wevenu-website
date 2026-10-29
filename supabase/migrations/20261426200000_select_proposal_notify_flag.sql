-- Combined client approval calls select then approve. Selection is an internal
-- step of that one action, so it must not also emit proposal_selected.
-- A genuine standalone select still notifies (p_notify defaults to true).

drop function if exists public.select_commercial_proposal(text, jsonb);

create or replace function public.select_commercial_proposal(
  p_token text,
  p_choices jsonb,
  p_notify boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.commercial_proposals%rowtype;
  v_choice jsonb;
  v_option public.commercial_proposal_options%rowtype;
  v_primary_count int := 0;
  v_qty numeric;
  v_line numeric;
  v_option_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if p_choices is null or jsonb_typeof(p_choices) <> 'array' or jsonb_array_length(p_choices) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_selection');
  end if;

  select * into v_row
  from public.commercial_proposals
  where accept_token = p_token
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_row.status = 'approved' then
    return jsonb_build_object('ok', false, 'error', 'already_approved');
  end if;

  if v_row.status not in ('sent', 'selected') then
    return jsonb_build_object('ok', false, 'error', 'not_open');
  end if;

  for v_choice in select * from jsonb_array_elements(p_choices)
  loop
    begin
      v_option_id := (v_choice->>'optionId')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid_option');
    end;
    v_qty := coalesce((v_choice->>'quantity')::numeric, 1);
    if v_qty is null or v_qty <= 0 then
      return jsonb_build_object('ok', false, 'error', 'invalid_quantity');
    end if;

    select * into v_option
    from public.commercial_proposal_options
    where id = v_option_id
      and proposal_id = v_row.id;

    if v_option.id is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_option');
    end if;

    if v_option.offer_role = 'primary' then
      v_primary_count := v_primary_count + 1;
      if v_qty <> 1 then
        return jsonb_build_object('ok', false, 'error', 'primary_qty');
      end if;
    end if;
  end loop;

  if v_primary_count <> 1 then
    return jsonb_build_object('ok', false, 'error', 'need_one_primary');
  end if;

  delete from public.commercial_proposal_choices where proposal_id = v_row.id;

  for v_choice in select * from jsonb_array_elements(p_choices)
  loop
    v_option_id := (v_choice->>'optionId')::uuid;
    v_qty := coalesce((v_choice->>'quantity')::numeric, 1);
    select * into v_option
    from public.commercial_proposal_options
    where id = v_option_id and proposal_id = v_row.id;

    v_line := round((v_option.unit_price * v_qty)::numeric, 2);

    insert into public.commercial_proposal_choices (
      proposal_id, venue_id, option_id, quantity, unit_price, line_total, name, offer_role
    ) values (
      v_row.id, v_row.venue_id, v_option.id, v_qty, v_option.unit_price, v_line, v_option.name, v_option.offer_role
    );
  end loop;

  update public.commercial_proposals
  set status = 'selected',
      selected_at = coalesce(selected_at, now())
  where id = v_row.id;

  if p_notify is distinct from false then
    perform public._notify_proposal_selected(v_row.id);
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', 'selected');
end;
$$;

revoke all on function public.select_commercial_proposal(text, jsonb, boolean) from public;
grant execute on function public.select_commercial_proposal(text, jsonb, boolean) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
