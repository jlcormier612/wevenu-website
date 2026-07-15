# Booking Financial Architecture — Phase 1 Implementation Record

**Status: shipped.** Payment Plan always-linked-to-Invoice, per `docs/booking-financial-architecture-roadmap.md`. No migration — this phase was scoped as application-layer-only, and it stayed that way.

## What shipped

- `payment_schedules` can no longer be created without a linked invoice — enforced in `lib/payments/validation.ts::validateScheduleInput` and `lib/payments/service.ts::createPaymentSchedule`, at the application layer only (see "Decisions made," below, for why the DB constraint isn't added yet).
- A schedule's `total_amount` is never client-submitted. `createPaymentSchedule` now looks up the invoice server-side (`lib/payments/repository.ts::getInvoiceSummaryForSchedule`) and derives `totalAmount`, `clientId`, and `eventId` from it directly — the same discipline as everywhere else in this phase: a human decision gets entered once, everything downstream reads it.
- `/payments/new` requires an `invoiceId`. Without one, it now shows `InvoicePickerForSchedule` — pick an existing invoice, or a link to create one — instead of the old free-total, client-dropdown form. There is no path to an unlinked schedule left in the UI.
- The Invoice detail page's "Create Payment Plan →" link simplified to `?invoiceId=` only — the old `&clientId=&amount=` query params were a one-time prefill hack; the new page resolves everything itself from the invoice.
- **New: a one-click "Create Retainer Invoice" shortcut** (`components/payments/create-retainer-sheet.tsx`, `lib/payments/service.ts::createRetainerInvoiceAndSchedule`) on the Booking Workspace's Payments tab, shown when no invoice exists yet. Collapses what used to be three separate steps (create invoice → add line item → create schedule) into one: a single "Retainer" line item, a linked one-installment schedule, both real records from the moment of booking. Deliberately manual, not automated — Phase 7 is where this becomes system-triggered off `Booking.Confirmed`.
- `updateScheduleTotalAmount` deleted from `lib/payments/repository.ts` — it had zero callers (confirmed by repo-wide grep before removal), and the correct fix was removing manual total-editing entirely, not wiring the dead function up.

## Decisions made during implementation — surfaced, not silently assumed

Three small implementation-level calls came up that the roadmap didn't spell out to this level of detail. Documenting them here rather than deciding silently, per your instruction:

1. **The retainer's invoice line item uses type `"item"` ("Line Item"), not `"deposit"`.** `computeInvoiceTotals` treats `"deposit"`-typed lines as a *subtraction* from the subtotal (it's meant for recording a deposit already collected against a larger, separately-itemized invoice). A retainer invoice's one line **is** the whole invoice — typing it as a subtractive "deposit" would have produced a negative subtotal. If you'd rather the retainer line read as "Deposit" in the UI while still behaving as a normal charge, that's a label-only change (`description: "Retainer"` → whatever wording you prefer); the `type` should stay `"item"` regardless.
2. **No DB-level `NOT NULL` on `payment_schedules.invoice_id` yet.** Confirmed directly against the schema: the column is still nullable. This matches the roadmap's own "expand, then contract" sequencing — enforcement is application-layer only for now, so a bug in the new validation can't lock out legitimate data, and the hard constraint becomes a safe, separate, later step once the app-layer rule has run clean in practice for a while.
3. **`NewScheduleForm` no longer takes a `clients` prop or shows a client picker at all.** Once every schedule requires an invoice, the invoice already carries `clientId`/`eventId` — showing a redundant client dropdown would have reintroduced exactly the "same decision enterable twice" pattern this whole effort exists to remove. This is a direct application of Guiding Principle #1, not a UX simplification for its own sake.

## Verified

- `tsc --noEmit` and `eslint` clean on every file touched (two pre-existing issues elsewhere in `components/events/event-detail.tsx` and `lib/payments/service.ts` were confirmed via `git diff` to predate this phase and are untouched by it).
- Real local-database verification (self-cleaning transaction, all test data rolled back, confirmed zero leftover rows afterward):
  - A real invoice's `total`/`client_id`/`event_id` read back correctly through the same query shape `getInvoiceSummaryForSchedule` uses.
  - A schedule inserts correctly using that invoice-derived total — never a value supplied independently.
  - **The regression case that mattered most**: a schedule with `invoice_id IS NULL` (simulating every schedule that exists in production today, before this phase) still inserts and reads back correctly — confirming the grandfather decision from the roadmap holds and no existing payment collection is disrupted.
  - `payment_schedules.invoice_id` confirmed still nullable at the DB level, matching decision #2 above.

## Not in this phase, on purpose

- No automatic invoice/schedule creation at `Booking.Confirmed` — the shortcut is fast, but still coordinator-initiated. Automation is Phase 7.
- No backfill of existing unlinked schedules. They're permanently grandfathered per the roadmap, not migrated.
- No changes to `payment-schedule-detail.tsx`'s display logic — it already read `schedule.totalAmount` purely for display with no editable total anywhere, so nothing there needed to change; it now simply always reflects an invoice-derived number instead of a hand-typed one.

## Incidental finding, unrelated to this phase — surfacing per your standing instruction

While verifying the local database, the query tool's own advisory system flagged that **two unrelated tables have Row Level Security disabled**: `public.luv_rollups` and `public.vendor_health_scores`. Both are fully exposed to the `anon` and `authenticated` roles as a result — anyone with the (public) anon key could currently read or modify every row in either table. This has nothing to do with Payments/Invoices and I have not touched either table. I have **not** applied any remediation. If you want this fixed, the two most likely-correct policies (read-scoped to `current_user_venue_id()`, matching every other venue-scoped table in this schema) would need to be written and reviewed before enabling RLS — enabling it with zero policies would silently break whatever currently reads these tables. Flagging it here rather than in the middle of a Payments discussion so it doesn't get lost.

## Ready for Phase 2

Phase 1 leaves the platform fully functional — every existing invoice, payment schedule, and coordinator workflow behaves exactly as before, and new schedules are strictly more trustworthy. Phase 2 (Event Order authoring) is next per the roadmap, whenever you're ready.
