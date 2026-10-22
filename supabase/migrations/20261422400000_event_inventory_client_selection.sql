-- Event Inventory couple-selection collaboration (Workflow C).
-- Additive: existing inventories stay collaboration_mode='view' (read-only share).
-- Select mode: draft → shared → submitted → changes_requested → confirmed → finalized.

alter table public.event_inventory
  add column if not exists collaboration_mode text not null default 'view'
    check (collaboration_mode in ('view', 'select'));

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'event_inventory'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.event_inventory drop constraint %I', cname);
  end if;
end $$;

alter table public.event_inventory
  add constraint event_inventory_status_check
  check (status in (
    'draft',
    'shared',
    'submitted',
    'changes_requested',
    'confirmed',
    'finalized'
  ));

alter table public.event_inventory_items
  add column if not exists client_selectable boolean not null default false;

alter table public.event_inventory_items
  add column if not exists max_quantity numeric(10,2)
    check (max_quantity is null or max_quantity > 0);

alter table public.event_inventory_items
  add column if not exists client_draft_quantity numeric(10,2)
    check (client_draft_quantity is null or client_draft_quantity >= 0);

alter table public.event_inventory_items
  add column if not exists client_submitted_quantity numeric(10,2)
    check (client_submitted_quantity is null or client_submitted_quantity >= 0);

comment on column public.event_inventory.collaboration_mode is
  'view = couple read-only when shared; select = couple may draft/submit quantities on client_selectable items.';

comment on column public.event_inventory_items.client_selectable is
  'When true and inventory is in select mode, couple may choose quantity 0..max_quantity (or quantity). Included items stay informational.';

-- Portal save draft selections (token-scoped). Does not change status.
create or replace function public.save_event_inventory_selections_for_portal(
  p_token text,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_inv record;
  v_item record;
  v_sel jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_max numeric;
  v_updated int := 0;
begin
  select cps.* into v_session
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and cps.access_level in ('couple', 'planner')
  limit 1;
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Invalid session.');
  end if;

  select ei.* into v_inv
  from public.event_inventory ei
  join public.events e on e.id = ei.event_id
  where e.client_id = v_session.client_id
    and ei.venue_id = v_session.venue_id
    and (v_session.event_id is null or ei.event_id = v_session.event_id)
  limit 1;
  if v_inv.id is null then
    return jsonb_build_object('ok', false, 'message', 'Inventory not found.');
  end if;
  if v_inv.collaboration_mode <> 'select' then
    return jsonb_build_object('ok', false, 'message', 'This inventory is view-only.');
  end if;
  if v_inv.status not in ('shared', 'changes_requested') then
    return jsonb_build_object('ok', false, 'message', 'Selections are locked right now.');
  end if;

  for v_sel in select * from jsonb_array_elements(coalesce(p_selections, '[]'::jsonb))
  loop
    v_item_id := nullif(v_sel->>'itemId', '')::uuid;
    begin
      v_qty := (v_sel->>'quantity')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Invalid quantity.');
    end;
    if v_item_id is null or v_qty is null or v_qty < 0 then
      return jsonb_build_object('ok', false, 'message', 'Invalid selection.');
    end if;

    select * into v_item
    from public.event_inventory_items
    where id = v_item_id
      and event_inventory_id = v_inv.id
      and venue_id = v_session.venue_id;
    if v_item.id is null then
      return jsonb_build_object('ok', false, 'message', 'Item not found.');
    end if;
    if not v_item.client_selectable then
      return jsonb_build_object('ok', false, 'message', 'That item is not selectable.');
    end if;
    v_max := coalesce(v_item.max_quantity, v_item.quantity);
    if v_qty > v_max then
      return jsonb_build_object('ok', false, 'message', 'Quantity exceeds the allowed maximum.');
    end if;

    update public.event_inventory_items
    set client_draft_quantity = v_qty,
        updated_at = now()
    where id = v_item.id;
    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object('ok', true, 'updated', v_updated);
end;
$$;

revoke all on function public.save_event_inventory_selections_for_portal(text, jsonb) from public;
grant execute on function public.save_event_inventory_selections_for_portal(text, jsonb) to anon, authenticated;

-- Portal submit: freeze draft → submitted quantities; status → submitted.
create or replace function public.submit_event_inventory_selections_for_portal(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_inv record;
begin
  select cps.* into v_session
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and cps.access_level in ('couple', 'planner')
  limit 1;
  if v_session.id is null then
    return jsonb_build_object('ok', false, 'message', 'Invalid session.');
  end if;

  select ei.* into v_inv
  from public.event_inventory ei
  join public.events e on e.id = ei.event_id
  where e.client_id = v_session.client_id
    and ei.venue_id = v_session.venue_id
    and (v_session.event_id is null or ei.event_id = v_session.event_id)
  limit 1;
  if v_inv.id is null then
    return jsonb_build_object('ok', false, 'message', 'Inventory not found.');
  end if;
  if v_inv.collaboration_mode <> 'select' then
    return jsonb_build_object('ok', false, 'message', 'This inventory is view-only.');
  end if;
  if v_inv.status not in ('shared', 'changes_requested') then
    return jsonb_build_object('ok', false, 'message', 'Selections are locked right now.');
  end if;

  update public.event_inventory_items
  set client_submitted_quantity = coalesce(client_draft_quantity, 0),
      updated_at = now()
  where event_inventory_id = v_inv.id
    and venue_id = v_session.venue_id
    and client_selectable = true;

  update public.event_inventory
  set status = 'submitted',
      updated_at = now()
  where id = v_inv.id;

  insert into public.event_inventory_activities (event_inventory_id, venue_id, type, title, description)
  values (v_inv.id, v_session.venue_id, 'submitted', 'Client submitted inventory selections', null);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_event_inventory_selections_for_portal(text) from public;
grant execute on function public.submit_event_inventory_selections_for_portal(text) to anon, authenticated;

-- Extend portal read RPC with collaboration + selection columns.
-- Must drop first: CREATE OR REPLACE cannot change OUT/RETURNS TABLE columns.
drop function if exists public.get_event_inventory_for_portal(text);

create or replace function public.get_event_inventory_for_portal(p_token text)
returns table (
  id uuid,
  status text,
  finalized_at timestamptz,
  collaboration_mode text,
  item_id uuid,
  item_name text,
  item_category text,
  item_quantity numeric,
  item_unit_price numeric,
  item_is_included boolean,
  item_notes text,
  item_sort_order smallint,
  item_client_selectable boolean,
  item_max_quantity numeric,
  item_client_draft_quantity numeric,
  item_client_submitted_quantity numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ei.id,
    ei.status,
    ei.finalized_at,
    ei.collaboration_mode,
    eii.id,
    eii.name,
    eii.category,
    eii.quantity,
    eii.unit_price,
    eii.is_included,
    eii.notes,
    eii.sort_order,
    eii.client_selectable,
    eii.max_quantity,
    eii.client_draft_quantity,
    eii.client_submitted_quantity
  from public.client_portal_sessions cps
  join public.events e
    on e.client_id = cps.client_id
   and e.venue_id = cps.venue_id
   and (cps.event_id is null or e.id = cps.event_id)
  join public.event_inventory ei
    on ei.event_id = e.id
   and ei.venue_id = cps.venue_id
   and ei.status in ('shared', 'submitted', 'changes_requested', 'confirmed', 'finalized')
  left join public.event_inventory_items eii
    on eii.event_inventory_id = ei.id
  where cps.access_token = p_token
    and cps.access_level in ('couple', 'planner')
  order by eii.sort_order nulls last, eii.created_at nulls last;
$$;

grant execute on function public.get_event_inventory_for_portal(text) to anon, authenticated;
