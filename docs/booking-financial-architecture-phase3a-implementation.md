# Booking Financial Architecture — Phase 3a Implementation Record

**Status: shipped and verified.** Draft Invoice as a live projection of Event Order, per `docs/booking-financial-architecture-phase3-trust-design.md`. Eighth document in the series.

## What shipped

- **Schema** (`supabase/migrations/20260924000000_invoice_event_order_linkage.sql`): one column, `invoices.event_order_id` (nullable, `on delete set null`), plus its index. Nothing else — `invoice_line_items.event_order_line_id` deliberately waits for Phase 3b's own migration, when the freeze-on-send logic actually starts writing it.
- **The live projection itself** (`lib/invoices/service.ts::getInvoice`): when an invoice is `draft` and linked to an Event Order, its Event-Order-derived lines are computed fresh on every read — never stored, never synced. Ad hoc lines a coordinator adds directly (tax, fees, one-offs) remain real, stored `invoice_line_items` rows exactly as before; the projected lines are concatenated alongside them at read time only. Totals (`subtotal`/`discountAmount`/`taxAmount`/`total`/`balanceDue`) are recomputed to include the projection every time, correctly netting out whatever's already been paid.
- **Two new entry points** on the Event Order panel: create a brand-new invoice already linked, or — preferred whenever one exists — link an already-existing Draft invoice (most commonly Phase 1's retainer invoice), preserving "one Invoice per Event, growing over time."
- **The Phase 3a boundary, guarded explicitly, not left as a gap.** Sending an Event-Order-linked Draft invoice — by status transition *or* by email — is blocked with a clear message ("coming in the next update"). Phase 3b's freeze is what makes sending safe; shipping the ability to send before that exists would have produced an invoice that goes blank the moment it left Draft, since nothing would have materialized its projected lines into real rows. This is the single most important guard in this phase.
- **Visual distinction in the line-item editor**: a line traced back to Event Order carries an "Event Order" badge and has no remove control — that decision belongs to Event Order, not the Invoice screen.

## Verified

- `tsc --noEmit` and `eslint` clean on every new and touched file (the same two pre-existing, unrelated issues in `event-detail.tsx` confirmed again via `git diff`; two pre-existing unused-import warnings in `lib/invoices/repository.ts`, also confirmed via `git diff` as predating this change).
- Real-data verification as the simulated `authenticated` role: linked a real draft invoice to a real Event Order and confirmed the link persists; deleted the Event Order and confirmed the invoice **survived** with `event_order_id` correctly nulled out — proving a lost Event Order can never take a financial record down with it. All test data cleaned up, confirmed zero leftovers.
- Did not re-verify invoice-table RLS/cross-venue isolation from scratch — this migration only adds a column and an index to a table whose RLS policy and grants were already established and correct before this phase; there was nothing new to re-secure.

## Not in this phase, on purpose

- No freeze-on-send, no drift detection, no banner — Phase 3b.
- No `invoice_line_items.event_order_line_id` column yet — ships with 3b, when it's first written to.
- Sending or emailing an Event-Order-linked draft invoice is explicitly blocked, not partially supported.

## Ready for Phase 3b

The platform is fully functional — every invoice not linked to an Event Order behaves exactly as it always has, and a linked Draft invoice now answers "what would we invoice if we sent it right now" correctly and automatically, with nothing stored that could go stale. Phase 3b (the freeze on send, drift detection, and the calm two-action banner) is next.
