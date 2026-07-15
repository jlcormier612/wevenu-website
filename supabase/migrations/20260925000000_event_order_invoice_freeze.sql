-- Event Order / Invoice freeze and drift — Booking Financial Architecture,
-- Phase 3b (docs/booking-financial-architecture-phase3-trust-design.md).
--
-- Sending a Draft, Event-Order-linked Invoice is the commitment moment:
-- the currently-live-projected Event Order lines get copied into real,
-- permanent invoice_line_items rows for the first time — "Copy at
-- Commitment," recognized one layer up from where Event Order itself
-- already applies it to Package/Inventory.
--
-- invoice_line_items.event_order_line_id: provenance on a real, frozen
-- row — which Event Order line this was copied from, at send time. Never
-- a live reference.
--
-- Deliberately NOT a foreign key, unlike every other provenance column in
-- this schema (package_id, inventory_item_id, etc.). Found by testing
-- against the real database, not assumed: a real foreign key here — even
-- with `on delete set null` — would silently erase exactly the fact drift
-- detection most needs the moment an Event Order line is deleted. Removing
-- a line from Event Order is a normal, expected edit (Event Order stays
-- fully free to change, always), but the frozen Invoice line still needs
-- to answer "did the thing I trace back to disappear?" after that delete
-- has already happened — which a nulled-out column can no longer say. A
-- plain, unconstrained uuid preserves that history; the trade is that this
-- column can point at a since-deleted row, which is correct and expected,
-- not a data-integrity problem to guard against.
alter table public.invoice_line_items
  add column if not exists event_order_line_id uuid;

create index if not exists invoice_line_items_event_order_line on public.invoice_line_items (event_order_line_id) where event_order_line_id is not null;

-- invoices.event_order_dismissed_fingerprint: records which exact state of
-- Event Order's lines a coordinator last reviewed and dismissed drift for
-- ("Dismiss for now"). Drift is computed by diffing the frozen lines above
-- against Event Order's current lines directly — this fingerprint only
-- answers "has anything changed since the last time a human looked,"
-- so a dismissal is scoped to what was actually reviewed, not permanent:
-- if Event Order changes again, the current fingerprint no longer matches
-- and the banner returns.
alter table public.invoices
  add column if not exists event_order_dismissed_fingerprint text;

notify pgrst, 'reload schema';
