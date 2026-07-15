# Booking Financial Architecture — Phase 3b Implementation Record

**Status: shipped and verified.** Commitment & Drift, per `docs/booking-financial-architecture-phase3-trust-design.md`. Ninth document in the series.

## What shipped

- **The freeze.** Sending an Event-Order-linked Draft invoice — via "Mark as Sent" or via the Email button — now copies Event Order's current lines into real, permanent `invoice_line_items` rows, tagged with `event_order_line_id` for provenance, before the status changes. This is Copy at Commitment, recognized one layer up: the same mechanic Event Order already applies to Package/Inventory, applied again where Invoice commits from Event Order.
- **Drift detection**, computed by diffing the frozen lines directly against Event Order's *current* lines — never a revision counter or timestamp proxy. Four categories, matching your requested structure: Added, Removed, Changed (quantity/description), Price Changes. A line with both a quantity and a price change appears in both lists — hiding either fact would work against "immediate comprehension."
- **The calm banner**, worded exactly as requested: *"Your Event Order has changed since this invoice was created."* — followed by an at-a-glance summary (e.g., "1 item added, 1 price changed") built before anyone opens the detail view, then the original reassurance line, then two actions: **Review Changes** and **Dismiss for now**. No alarming color treatment — a plain bordered card, the same register as the rest of the app's informational surfaces.
- **Review Changes** opens the four-category breakdown in a Sheet, each line item showing before → after where relevant.
- **Dismiss for now** records exactly which Event Order line-state was reviewed (a fingerprint, not a boolean) — if Event Order changes again afterward, the banner returns; if it doesn't, staying quiet is correct, not silent.

## A real bug found during verification, and the schema decision it forced

`invoice_line_items.event_order_line_id` was originally built as a real foreign key, `on delete set null` — consistent with every other provenance column in this schema (`package_id`, `inventory_item_id`, Event Order's own `floor_plan_id`). Testing it against the real database (not just reading the code) surfaced a real problem: the moment an Event Order line is deleted, `on delete set null` erases the exact fact drift detection most needs — that this frozen line *used to* trace to a line that no longer exists. A `null` reference is indistinguishable from "this was always an ad hoc line," so the "Removed" category would have silently failed to detect the single most important kind of change: something the client was already charged for disappearing from Event Order entirely.

**Fixed by removing the foreign key constraint** — `event_order_line_id` is now a plain, unconstrained `uuid` column. This is a deliberate departure from this schema's usual pattern, not an oversight: every other provenance column in this system points at something that's still expected to exist, or safely doesn't matter if it's gone. This one specifically needs to keep pointing at something even after that something is deleted, because the deletion itself is the fact being tracked. Documented directly in the migration so a future reader doesn't "fix" it back to a foreign key.

Re-verified after the fix: deleted the source Event Order line, confirmed the frozen invoice line's `event_order_line_id` survives unchanged, confirmed it correctly stops resolving to any live Event Order line — exactly the state "Removed" detection depends on.

## Verified

- `tsc --noEmit` and `eslint` clean on every new and touched file (the same two pre-existing warnings in `lib/invoices/repository.ts`, confirmed via `git diff` as predating this phase).
- Real-data verification as the simulated `authenticated` role: simulated the freeze (two lines copied with provenance tags), then drifted Event Order three ways at once (price change, deletion, addition) and confirmed the frozen data correctly retains everything the diff logic needs for all three — including, after the fix, the deletion case. Confirmed the dismissed-fingerprint column round-trips correctly. All test data cleaned up, confirmed zero leftovers.
- Did not attempt to invoke the actual Next.js Server Actions or render the banner in a browser (no browser tool in this environment, consistent with this session's established limitation) — the diff/summary logic itself was verified by tracing it against the real, corrected database behavior above, plus `tsc`'s type-level confirmation that every code path is internally consistent.

## Scoping notes, decided rather than silently assumed

- **No section-name mention in the summary** (e.g., a hypothetical "Catering updated"). Doing this reliably for *removed* lines would require looking up a section that may no longer exist by the time the diff runs, and doing it inconsistently (only for added/changed lines) felt more likely to confuse than clarify. The summary reports accurate counts only; revisit if real usage shows the section context is missed.
- **The freeze does not set a dismissed-fingerprint.** Immediately after sending, the frozen lines exactly match Event Order's current lines by construction — there is nothing to dismiss yet, so the column stays `null` until a real dismissal happens.
- **Emailing a draft, Event-Order-linked invoice now triggers the same freeze "Mark as Sent" does**, scoped specifically to that case — a plain (non-Event-Order) draft invoice's existing email behavior is untouched, since changing that would be a real, separate product decision outside this phase's scope.

## Ready for Phase 3c

The two calm actions are live and complete on their own. Phase 3c — Update Draft Invoice and Create Amended Invoice, plus the Payment Plan "Needs Review" status — is next, whenever you're ready. The open Payment Plan design question from the trust doc is already resolved (never automatic, always a status + human decision); what remains is building it.
