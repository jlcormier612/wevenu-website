# Invoice partial-payment balance — STATUS

**Environment:** Sandbox only  
**Overall:** GREEN  
**Production:** not touched

## Root cause

DB helper `_compute_invoice_total_paid` (trigger-backed `balance_due` writer) omitted `partially_paid`, so a correct $7,164.06 installment collection was treated as $0 and `balance_due` stayed at the full invoice total $36,656.25 while Paid to date (live `computeNetPaid`) showed $7,164.06.

## Fix

| Area | Change |
|---|---|
| Migration | `20261417200000_invoice_balance_counts_partially_paid.sql` — count `partially_paid`; subtract cancelled; backfill |
| Invoice / print pages | Display balance via `computeInvoiceBalanceDue` when a schedule is linked |
| Invoice plan rows | Partially paid lines show received + amount still due |
| `reconcileInvoiceBalance` | Surface update errors |
| Tests | Nicole/Colby scenario + refund/duplicate/pending/rounding + migration SQL assert |

## Commits / deploy

| Item | Value |
|---|---|
| Fix commit | `87bce3bd4e8031917fc44a42e935ea9786dd48c2` |
| Installment UI commit | `b21337d1e4fffa946ca8fa0e3c51c5f938b0c1c7` |
| Serving tip (verified) | `b21337d1e4fffa946ca8fa0e3c51c5f938b0c1c7` |
| Migration apply | [38297239175](https://github.com/jlcormier612/wevenu-website/actions/runs/38297239175) success |
| Sandbox deploy | [38298512949](https://github.com/jlcormier612/wevenu-website/actions/runs/38298512949) success |

## Persisted before → after (INV-2026-3B9F4B)

| Field | Before | After |
|---|---|---|
| Invoice total | $36,656.25 | $36,656.25 |
| Payment received (`paid_amount`) | $7,164.06 | $7,164.06 |
| Installment status | `partially_paid` | `partially_paid` |
| Installment remainder | $2,000.00 | $2,000.00 |
| `_compute_invoice_total_paid` | $0 | $7,164.06 |
| `invoices.balance_due` | $36,656.25 | **$29,492.19** |

No extra payment, refund, or invoice line mutation was introduced.

## Automated tests

`npx tsx --test lib/payments/invoice-balance.test.ts lib/portal/payment-totals.test.ts lib/payments/offline-recording.test.ts lib/contracts/balance-remaining.test.ts lib/contracts/balance-consistency.test.ts lib/payments/manual-installment.test.ts` — **65 pass / 0 fail**

## Browser proof

`EXPECTED_SHA_PREFIX=b21337d1 npx tsx scripts/qa/invoice-partial-payment-balance-browser.mts` — **19/19 PASS**

Evidence: `browser-results.json`, `invoice-detail-1280.png`, `invoice-detail-390.png`, `invoice-print-1280.png`

Confirmed on deployed Sandbox:

- Total contracted $36,656.25
- Paid to date $7,164.06
- Balance remaining $29,492.19
- Initial Payment: Partially Paid · $7,164.06 received · $2,000 due
- Print document balance $29,492.19
- Refund / duplicate / historical payment protections unchanged (same payment row; idempotent mark-paid path preserved)
