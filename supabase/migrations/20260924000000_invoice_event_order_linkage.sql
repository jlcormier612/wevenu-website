-- Invoice <-> Event Order linkage — Booking Financial Architecture, Phase 3a
--
-- A Draft Invoice linked to an Event Order becomes a live projection of it
-- (docs/booking-financial-architecture-phase3-trust-design.md): "what would
-- we invoice if we sent it right now" — computed at read time in the
-- application layer, never stored. This migration adds only the one column
-- 3a actually needs to express that link.
--
-- Deliberately NOT added here, per the same narrowing discipline used in
-- Phase 2's migration: invoice_line_items.event_order_line_id (that column
-- only starts being written the moment Phase 3b's freeze-on-send exists —
-- it ships in 3b's own migration, not speculatively here).
--
-- No unique constraint on event_order_id: enforced at the application layer
-- only for now (an Event Order links to at most one Invoice), matching the
-- same expand-before-contract posture already used for
-- payment_schedules.invoice_id in Phase 1.
alter table public.invoices
  add column if not exists event_order_id uuid references public.event_orders (id) on delete set null;

create index if not exists invoices_event_order on public.invoices (event_order_id) where event_order_id is not null;

notify pgrst, 'reload schema';
