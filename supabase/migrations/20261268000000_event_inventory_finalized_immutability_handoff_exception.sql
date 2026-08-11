-- Work Package D8 — a critical bug caught by live testing, in the very fix
-- meant to close a different one. The D8 fix for addToEventOrder
-- (lib/event-inventory/repository.ts::markAddedToEventOrder) marks each
-- pushed item's added_to_event_order_at column right after inserting its
-- Event Order line — but that UPDATE only ever runs once the Event
-- Inventory is finalized (addToEventOrder's own precondition), and
-- event_inventory_items_enforce_finalized_immutability blocks *every*
-- write to event_inventory_items once finalized, with no exception. Live
-- testing reproduced the actual failure: the Event Order lines get
-- inserted successfully, then the mark-as-added update throws, which
-- would surface as an unhandled error to the venue AFTER the lines were
-- already created — and since the items were never marked, a retry would
-- re-add the exact same lines a second time. The trigger's core guarantee
-- (no quantity/price/name/inclusion changes once finalized) is still
-- correct and stays enforced; this carves out the one legitimate
-- exception — a financial-handoff bookkeeping stamp that changes nothing
-- else about the row.

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
    -- added_to_event_order_at and nothing else. Everything else about a
    -- finalized item (quantity, price, name, category, inclusion,
    -- notes, sort order) must still be provably identical to OLD.
    if TG_OP = 'UPDATE'
       and new.name is not distinct from old.name
       and new.category is not distinct from old.category
       and new.quantity is not distinct from old.quantity
       and new.unit_price is not distinct from old.unit_price
       and new.is_included is not distinct from old.is_included
       and new.notes is not distinct from old.notes
       and new.sort_order is not distinct from old.sort_order
       and new.inventory_item_id is not distinct from old.inventory_item_id
    then
      return new;
    end if;
    raise exception 'This Event Inventory is finalized — reopen it to make changes.'
      using errcode = '23001'; -- restrict_violation
  end if;
  return coalesce(new, old);
end;
$$;

notify pgrst, 'reload schema';
