-- Event inventory item photos for client portal.
-- Snapshot image_url on event_inventory_items (same domain as name/category).
-- Portal RPC may coalesce to catalog when snapshot is null (legacy rows).
-- Visibility unchanged: get_event_inventory_for_portal still only returns
-- shared/submitted/changes_requested/confirmed/finalized inventories.

alter table public.event_inventory_items
  add column if not exists image_url text;

comment on column public.event_inventory_items.image_url is
  'Optional catalog photo snapshot for client-facing inventory. Null = no photo.';

-- Backfill from venue catalog where provenance exists.
update public.event_inventory_items eii
set image_url = ii.image_url
from public.inventory_items ii
where eii.inventory_item_id = ii.id
  and eii.venue_id = ii.venue_id
  and eii.image_url is null
  and ii.image_url is not null;

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
  left join public.inventory_items ii
    on ii.id = eii.inventory_item_id
   and ii.venue_id = eii.venue_id
  where cps.access_token = p_token
    and cps.access_level in ('couple', 'planner')
  order by eii.sort_order nulls last, eii.created_at nulls last;
$$;

grant execute on function public.get_event_inventory_for_portal(text) to anon, authenticated;
