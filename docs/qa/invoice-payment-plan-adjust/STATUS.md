# Venue-controlled invoice / payment-plan adjustment — STATUS

**Environment:** Sandbox only  
**Overall:** GREEN  
**Production:** not touched  
**Balance-fix lineage:** `0e9b572a` is an ancestor of tip; partial-payment balance GREEN on `b21337d1` (also ancestor).

## Forensic finding — what worked before this change

| Capability | Reachable? | Notes |
|---|---|---|
| Record partial installment payment | YES | Offline mark-paid; Nicole/Colby proved |
| Canonical balance (total − net collections) | YES | Trigger + `computeInvoiceBalanceDue` |
| Draft line-item / plan edit | YES | Locked once invoice ≠ draft (`scheduleHasPaymentActivity`) |
| Post-payment credit on issued invoice | YES | Adds discount line; does **not** regenerate plan |
| Regenerate unpaid installments | PARTIAL | Only via Needs Review when schedule total ≠ invoice total; preset-only; over-allocates if `partially_paid` lines remain |
| Edit unpaid installment amounts/dates after send | NO (before) | UI + `assertSchedulePlanEditable` lock |
| Redistribute remaining after partial pay (same invoice total) | NO (before) | No entry point when totals still match |
| Preview revised arrangement after change | NO (before) | Preview blocked once `invoice_email` accepted |
| Send / resend revised plan to client | NO (before) | Send-once on `sourceType=invoice_email` |
| Amend invoice (EO-linked) | YES | Separate draft; not collection-plan adjust |
| Signed contract mutation from invoice edit | NO (good) | Contract stays separate |

## What this change delivers

1. **Adjust invoice / payment plan** on sent / partially_paid invoices with balance due (`data-testid="adjust-invoice-payment-plan"`).
2. Closes `partially_paid` shortfalls by setting installment `amount = paid_amount` and `status = paid` — receipts unchanged.
3. Replaces only `pending` / `overdue` lines; venue edits amounts/dates or redistributes (equal / proportional); preview must reconcile to `balanceDue`.
4. Preview + **Send revised to client** via distinct outbound `sourceType=invoice_plan_revision` (first `invoice_email` send-once preserved).
5. Explicit copy that signed contracts are not changed.

## Authoritative sources of truth (unchanged)

- **Money received:** payment line `paid_amount` / refunds (net)  
- **Invoice balance:** `_compute_invoice_total_paid` / `computeInvoiceBalanceDue`  
- **First payment-request send-once:** `conversation_messages` with `sourceType=invoice_email`  
- **Revised plan sends:** `sourceType=invoice_plan_revision`

## Commits / deploy

| Item | Value |
|---|---|
| Feature commit | `462e5a9e` |
| Type-check fixes | `60fb4f9f`, `6a7a47b5` |
| Serving tip (verified) | `6a7a47b563670230e44b81fc7558dfd2486e6a97` |
| Sandbox deploy | [38306553603](https://github.com/jlcormier612/wevenu-website/actions/runs/38306553603) success |
| Production | not touched |

## Automated tests

`npx tsx --test lib/payments/adjust-remaining-plan.test.ts lib/invoices/payment-workflow-regression.test.ts` — **29 pass / 0 fail**

## Browser + DB proof (Sandbox)

`EXPECTED_SHA_PREFIX=6a7a47b5 npx tsx scripts/qa/invoice-payment-plan-adjust-browser.mts` — **all PASS**

Disposable Meadowbrook fixture (controlled recipient `jlcormier612@gmail.com`):

| Check | Result |
|---|---|
| Serving SHA | `6a7a47b5…` |
| Adjust entry + reconcile preview | PASS |
| Save revised plan | `$2,500` receipt immutable; shortfall closed; remaining sum = `$7,500` balance |
| Send preview totals / schedule / contract note | PASS |
| Revised email | `invoice_plan_revision` **delivered**; first `invoice_email` preserved |
| Nicole/Colby Adjust reachable (read-only) | PASS |

Evidence: `browser-results.json`, `browser-run.log`, `adjust-dialog.png`, `send-preview.png`, `invoice-after-adjust.png`, `nicole-adjust-entry.png`

Proof invoice: `998a51d5-e6be-4cec-a7da-d77daa33fd81`
