-- Amendment chain, Event Order traceability, and Payment Plan review status
-- — Booking Financial Architecture, Phase 3c
-- (docs/booking-financial-architecture-phase3-trust-design.md).
--
-- invoices.amends_invoice_id: a self-reference, set only on a newly-created
-- amended invoice, pointing back at the invoice it amends. The original
-- invoice's own status (sent/paid) is never touched — it remains the
-- active financial record, untouched and immutable, until the amended
-- invoice is itself explicitly reviewed and sent. No new invoice status
-- value was added for this (e.g. "superseded") — the original's real
-- history stays real; only a link says something newer exists.
alter table public.invoices
  add column if not exists amends_invoice_id uuid references public.invoices (id) on delete set null;

create index if not exists invoices_amends on public.invoices (amends_invoice_id) where amends_invoice_id is not null;

-- invoices.event_order_revision_at_freeze: stamped once, at the same
-- moment Phase 3b's freeze-on-send happens — a permanent, human-readable
-- trace ("this invoice was generated from Event Order v2") independent of
-- whatever revision Event Order has since moved to.
alter table public.invoices
  add column if not exists event_order_revision_at_freeze integer;

-- payment_schedules.acknowledged_invoice_total: the same "dismissal is
-- scoped to what was reviewed, not permanent" pattern already used for
-- Event Order drift (invoices.event_order_dismissed_fingerprint),
-- reapplied one layer down the chain. A Payment Plan's total never moves
-- automatically when its Invoice's total changes (Payment Plans are part
-- of the agreement with the client, never silently renegotiated) — instead
-- it surfaces "Needs Review" until a coordinator explicitly picks one of
-- Keep Existing Schedule / Regenerate Schedule / Add Additional
-- Installment / Collect Remaining Balance Manually. "Keep" and "Collect
-- Manually" both resolve by recording which invoice total was reviewed and
-- accepted here; "Regenerate" and "Add Installment" resolve by actually
-- making schedule.total_amount match again, at which point this column
-- becomes moot until the next real drift.
alter table public.payment_schedules
  add column if not exists acknowledged_invoice_total numeric(12,2);

notify pgrst, 'reload schema';
