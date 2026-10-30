-- R2 / U3 — Venue-only inventory items.
-- client_visible controls couple visibility only; is_included stays the
-- commercial relationship. Default true: every existing row stays visible.
-- Venue-only rows remain in venue reads (RLS unchanged) and operational counts,
-- but never reach portal RPCs, the Event Order handoff, or invoices.

alter table public.inventory_template_items
  add column if not exists client_visible boolean not null default true;

alter table public.event_inventory_items
  add column if not exists client_visible boolean not null default true;

comment on column public.inventory_template_items.client_visible is
  'false = Venue only: copied onto event inventory as venue-only; never shown to the couple.';
comment on column public.event_inventory_items.client_visible is
  'false = Venue only: counts operationally, never returned to the couple, never handed to the Event Order or invoiced.';

-- A venue-only row can never be offered to the couple for selection.
alter table public.event_inventory_items
  drop constraint if exists event_inventory_items_venue_only_not_selectable;
alter table public.event_inventory_items
  add constraint event_inventory_items_venue_only_not_selectable
  check (client_visible or not client_selectable);

-- Finalized immutability: visibility is frozen with the rest of the row.
create or replace function public.event_inventory_items_enforce_finalized_immutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.event_inventory where id = coalesce(new.event_inventory_id, old.event_inventory_id);
  if v_status = 'finalized' then
    -- The one allowed post-finalization write: an UPDATE that changes
    -- added_to_event_order_at and nothing else.
    if TG_OP = 'UPDATE'
       and new.name is not distinct from old.name
       and new.category is not distinct from old.category
       and new.quantity is not distinct from old.quantity
       and new.unit_price is not distinct from old.unit_price
       and new.is_included is not distinct from old.is_included
       and new.notes is not distinct from old.notes
       and new.sort_order is not distinct from old.sort_order
       and new.inventory_item_id is not distinct from old.inventory_item_id
       and new.client_visible is not distinct from old.client_visible
    then
      return new;
    end if;
    raise exception 'This Event Inventory is finalized — reopen it to make changes.'
      using errcode = '23001'; -- restrict_violation
  end if;
  return coalesce(new, old);
end;
$$;

-- Portal read: venue-only rows are excluded at the join, so an inventory whose
-- rows are all venue-only still returns its header row with no items.
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
  item_client_submitted_quantity numeric,
  item_image_url text
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
    eii.client_submitted_quantity,
    coalesce(eii.image_url, ii.image_url) as item_image_url
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
   and eii.client_visible
  left join public.inventory_items ii
    on ii.id = eii.inventory_item_id
   and ii.venue_id = eii.venue_id
  where cps.access_token = p_token
    and cps.access_level in ('couple', 'planner')
  order by eii.sort_order nulls last, eii.created_at nulls last;
$$;

grant execute on function public.get_event_inventory_for_portal(text) to anon, authenticated;

-- Portal save: a venue-only id is indistinguishable from a missing one.
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
      and venue_id = v_session.venue_id
      and client_visible;
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

notify pgrst, 'reload schema';
