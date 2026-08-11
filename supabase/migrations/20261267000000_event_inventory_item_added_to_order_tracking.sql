-- Work Package D8 — two real bugs found together in "Add to Event Order"
-- (lib/event-inventory/service.ts::addToEventOrder), both fixed by the same
-- column:
--
-- 1. P0 (duplicated financial impact): addToEventOrder had no server-side
--    guard against re-adding the same billable item twice — every call
--    re-pushed every currently-billable item as a brand-new Event Order
--    line, unconditionally. Only client-side button-hiding stood between a
--    venue and a doubled Event Order total (a double-click, a retry, or a
--    second browser tab would have duplicated every line).
-- 2. P1 (workflow blocker): the button's own visibility check
--    (`alreadyPushedToEventOrder`) was a permanent, all-time flag derived
--    from "does any activity of type added_to_event_order exist" — so once
--    used once, it never reappeared, even after Reopen → add new items →
--    Finalize again. Items added after the first push had no way to ever
--    reach the Event Order through this action again.
--
-- Fix: track "already pushed" per item, not per Event Inventory. Both the
-- dedupe check and the button-visibility check now key off this same,
-- correct, per-item fact.

alter table public.event_inventory_items
  add column added_to_event_order_at timestamptz;

notify pgrst, 'reload schema';
