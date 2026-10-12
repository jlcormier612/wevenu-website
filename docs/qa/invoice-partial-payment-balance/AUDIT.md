# Invoice partial-payment balance — AUDIT

**Environment:** Sandbox only  
**Invoice:** `3b9f4bb6-b44c-484a-b6dd-b2ee47c5d541` (INV-2026-3B9F4B)  
**Client:** Nicole Bethune / Colby Yagnesak — Meadowbrook Valley Venue

## Reported figures

| Field | Value |
|---|---|
| Invoice total | $36,656.25 |
| Initial installment | $9,164.06 |
| Payment received | $7,164.06 |
| Installment remainder | $2,000.00 |
| Correct balance | $29,492.19 |
| Incorrect displayed balance | $36,656.25 |

## Persisted state (before fix)

- `invoices.total` = 36656.25 (unchanged)
- `invoices.balance_due` = 36656.25 (**stale / wrong**)
- `invoices.status` = `partially_paid`
- Initial `payment_line_items`: status `partially_paid`, `paid_amount` = 7164.06
- `_compute_invoice_total_paid(invoice_id)` RPC returned **0**

## Trace

1. Offline recording correctly wrote `paid_amount = 7164.06` and `status = partially_paid` on the installment (did not round up to $9,164.06).
2. TS `computeNetPaid` / `computeInvoiceBalanceDue` correctly yield $7,164.06 / $29,492.19.
3. Invoice detail page shows **Paid to date** from live `computeNetPaid` ($7,164.06) but **Balance remaining** from stored `invoices.balance_due` ($36,656.25).
4. DB trigger `trg_payment_line_items_sync_balance_due` recomputes `balance_due = total − _compute_invoice_total_paid(...)`.
5. `_compute_invoice_total_paid` only included statuses `paid | partially_refunded | refunded` — **not `partially_paid`** — so net paid was treated as $0 and the trigger overwrote any correct reconcile write.

## Authoritative formula (unchanged TS; DB aligned)

`balance_due = max(0, invoice.total − cancelled_plan_amounts − net_retained_payments)`

Net retained includes `paid`, `partially_paid`, `partially_refunded`, `refunded`.
