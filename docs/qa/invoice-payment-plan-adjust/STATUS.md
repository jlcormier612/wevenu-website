# Venue-controlled invoice / payment-plan adjustment — STATUS

**Environment:** Sandbox only  
**Overall:** FORENSIC COMPLETE · IMPLEMENTATION IN PROGRESS  
**Production:** not touched  
**Balance-fix lineage:** `0e9b572a` is an ancestor of tip; partial-payment balance GREEN on `b21337d1` (also ancestor). Tip at audit: `94a42bcb`.

## Forensic finding — what works today

| Capability | Reachable? | Notes |
|---|---|---|
| Record partial installment payment | YES | Offline mark-paid; Nicole/Colby proved |
| Canonical balance (total − net collections) | YES | Trigger + `computeInvoiceBalanceDue` |
| Draft line-item / plan edit | YES | Locked once invoice ≠ draft (`scheduleHasPaymentActivity`) |
| Post-payment credit on issued invoice | YES | Adds discount line; does **not** regenerate plan |
| Regenerate unpaid installments | PARTIAL | Only via Needs Review when schedule total ≠ invoice total; preset-only; over-allocates if `partially_paid` lines remain |
| Edit unpaid installment amounts/dates after send | NO | UI + `assertSchedulePlanEditable` lock |
| Redistribute remaining after partial pay (same invoice total) | NO | No entry point when totals still match |
| Preview revised arrangement after change | NO | Preview blocked once `invoice_email` accepted |
| Send / resend revised plan to client | NO | Send-once on `sourceType=invoice_email` |
| Amend invoice (EO-linked) | YES | Separate draft; not collection-plan adjust |
| Signed contract mutation from invoice edit | NO (good) | Contract stays separate |

## Authoritative sources of truth

- **Money received:** payment line `paid_amount` / refunds (net) — never a configured deposit alone  
- **Invoice balance:** `_compute_invoice_total_paid` / `computeInvoiceBalanceDue`  
- **Outbound send-once:** `conversation_messages` with `sourceType=invoice_email`  
- **Schedule structure after activity:** locked by design for accidental rewrite; regenerate only replaces `pending`/`overdue`

## Smallest safe plan

1. Add **Adjust invoice / payment plan** on issued invoices with a linked schedule (`sent` / `partially_paid`).  
2. Service replaces only unresolved (`pending`/`overdue`) lines; closes partial shortfalls by setting installment `amount = paid_amount` (status → `paid`) **without** mutating recorded receipts.  
3. Venue edits remaining installment amounts/dates or redistributes outstanding balance; preview must reconcile to `balanceDue`.  
4. **Send revised** uses a distinct outbound source (`invoice_plan_revision`) so initial payment-request send-once remains intact.  
5. Activity + tests + Sandbox browser on Nicole/Colby-style fixture.

## Gaps this closes

Venue can record a true partial ($7,164.06 of $9,164.06), revise the remaining collection arrangement without fabricating a full payment, preview, and send the client the updated plan.
