# Tax/discount guidance copy + booked schedule → timeline

## Status: GREEN (Sandbox verified)

**Commit tip:** `fd2c01a2614bcc6624659636df2bb3a48acd2b51`  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Migration:** `20261418200000_timeline_schedule_source_use_key.sql` — [apply run 38316655064](https://github.com/jlcormier612/wevenu-website/actions/runs/38316655064) success  
**Deploy:** [38316699193](https://github.com/jlcormier612/wevenu-website/actions/runs/38316699193) success — serving `dpl=fd2c01a2614bcc6624659636df2bb3a48acd2b51`  
**Browser evidence:** `browser-results.json`, `contract-builder-guidance.png`, `lead-overview-copy.png`, `timeline-after-sync.png`, `browser-run.log`  
**Protected financial workflow:** invoice/payment-plan calc, revision, send-once, redistribute — **not modified**.

## Workstream A — Exact copy

| ID | Change | Location |
|----|--------|----------|
| A1 | Removed locked Selected Package tax/discount paragraph entirely | `components/booking-journey/commercial-facts.tsx` |
| A2 | Added “Your agreement, your venue's terms” banner above editor (not in contract body) | `components/contracts/contract-builder.tsx` |
| A3 | Contract responsibility note on lead Overview Contract row | `commercial-facts.tsx` |
| A4 | Exact Invoice / Payment Plan responsibility copy on Overview row only | `commercial-facts.tsx` |
| A5 | Legal inspection only — see gap note below | `marketing/lib/marketing/legal.ts` (no edits) |

### A5 — Existing legal disclosures (inspection only; no rewrites)

**Present (related, not tax-specific):**
- Venue Subscription Agreement §6 / §9: venue responsible for Customer Data accuracy and for communications/content/consent compliance.
- Acceptable Use §3: venues remain responsible for content of messages and documents sent through HTC.
- Guest/client terms: HTC is not a party to venue–client contracts; not responsible for venue pricing/planning.

**Gap for separate legal review (not changed in this task):**
- Venue Subscription Agreement does **not** explicitly state that venues are responsible for determining and applying taxes, discounts, fees, or payment terms in their client agreements.
- No “not legal or tax advice” disclaimer appears in the formal Terms for agreement/invoice tax-and-discount tooling (product UI now carries that language; legal docs do not mirror it).
- The only “taxes” language in the Venue Subscription Agreement concerns HTC subscription billing charges, not venue–client event taxation.

## Workstream B — Schedule → timeline

**Root cause:** Saving `event_space_assignments` (replace RPC) did not create or update `timeline_entries`. Timeline load also did not materialize schedule-derived activities. Assignment row IDs churn on every replace, so identity must be `use_key`.

**Fix:**
- Migration adds `timeline_entries.source_space_use_key` + unique index per event.
- `lib/timeline/schedule-sync.ts` plans idempotent upserts/deletes from assignments; skips locked generated rows; never invents dates/times; leaves manual rows (`source_space_use_key` null) untouched.
- Hook after `replaceEventSpaceAssignments` and on `getTimelineEntries`.

## Regression tests (local)

- `lib/booking-journey/booking-details-layout.test.ts` — PASS
- `lib/invoices/tax-discount-discoverability.test.ts` — PASS
- `lib/timeline/schedule-sync.test.ts` — PASS (multi-day fixture, idempotency, missing date/time, locked skip, manual preserve)
- Protected invoice suite (`financial-terms`, `financial-adjustments`, `tax-discount-controls`, `payment-workflow-regression`, `payment-request-send-once`, `sent-invoice-edit-safety`) — **53/53 PASS**
- Note: `invoice-payment-plan-customer-journey.test.ts` fails on pre-existing `$8,000` vs `$8,000.00` money-display assertion (unrelated; `payment-workflow-regression` already allows optional `.00`). Not modified.

## Browser / DB proof (disposable Meadowbrook)

Script: `scripts/qa/tax-discount-schedule-timeline-browser.mts`

All checks PASS on exact tip `fd2c01a2…`:
- A1–A4 copy visible; locked Selected Package paragraph absent; Contract Builder guidance outside `#cb-content`
- Five schedule-derived timeline activities with component dates/times/spaces preserved (including unusual ceremony/reception order)
- Manual timeline entry preserved; reload creates no duplicates

## Production

Untouched. No production deploy or configuration changes.
