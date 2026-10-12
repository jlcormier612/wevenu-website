# Invoice partial-payment balance — STATUS

**Environment:** Sandbox only  
**Overall:** IN PROGRESS (fix + tests committed; migration + deploy + browser next)

## Root cause

DB helper `_compute_invoice_total_paid` (trigger-backed `balance_due` writer) omitted `partially_paid`, so a correct $7,164.06 installment collection was treated as $0 and `balance_due` stayed at the full invoice total $36,656.25 while Paid to date (live `computeNetPaid`) showed $7,164.06.

## Fix

| Area | Change |
|---|---|
| Migration | `20261417200000_invoice_balance_counts_partially_paid.sql` — count `partially_paid`; subtract cancelled; backfill |
| Invoice / print pages | Display balance via `computeInvoiceBalanceDue` when a schedule is linked |
| `reconcileInvoiceBalance` | Surface update errors |
| Tests | Nicole/Colby scenario + refund/duplicate/pending/rounding + migration SQL assert |

## Deploy / tip

| Item | Value |
|---|---|
| Commit | _(pending)_ |
| Migration apply | _(pending)_ |
| Sandbox deploy | _(pending)_ |

## Verification targets

- Invoice total $36,656.25 unchanged
- Payment received $7,164.06 unchanged (single partial installment)
- Installment remainder $2,000.00 / status Partially Paid
- Invoice balance remaining $29,492.19
- Production not touched
