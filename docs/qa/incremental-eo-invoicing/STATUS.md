# Incremental EO Invoicing — STATUS

**Verdict: NOT GREEN** — awaiting Sandbox deploy serving SHA verification + browser acceptance.

## Implementation commit
`04ee374b92321a9a5862eb9e2c4da23c9ed3e13c` — *Implement incremental Event Order invoicing for new charges only.*

## Preflight (passed — no stop conditions)
- Draft projection / freeze now filter via `unbilledBillableEventOrderLines` + `loadFrozenEventOrderLineIds`.
- Void restores eligibility (non-void filter + clear `event_order_line_id` on void).
- Concurrent/retry: send-time double-check + insert de-dupe + unique index migration.
- Payment plans: `syncPaymentPlanToInvoiceCommitment(invoiceId)` only; no auto-create; scoped by `invoice_id`.
- Portal: `selectCanonicalPaymentSchedules` keeps one schedule per invoice; bare invoices listed separately.
- QBO: `enqueueQuickBooksSync` per invoice id.
- Package fee: `insertLineFromPackage` sets `is_included: true` → not EO-billable.

## Automated tests
- `lib/invoices/incremental-eo-invoice.test.ts` + related suites: **48 + 49 pass / 0 fail**.

## Sandbox ops
| Step | Run | Result |
|------|-----|--------|
| Migration `20261425400000_invoice_event_order_line_unique.sql` | [40613272282](https://github.com/jlcormier612/wevenu-website/actions/runs/40613272282) | **success** |
| Deploy Sandbox `@04ee374b` | [40613274846](https://github.com/jlcormier612/wevenu-website/actions/runs/40613274846) | **in progress** |
| Browser harness | `docs/qa/incremental-eo-invoicing/verify-browser.mts` | blocked on serving SHA |

## Production
Untouched.

## Unrelated dirty/untracked work
Preserved (not reset/stashed; commit scoped to incremental-billing files only).
