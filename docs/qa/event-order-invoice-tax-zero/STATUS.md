# Launch blocker — EO-linked invoice tax shows $0 at 6.25%

**Verdict: NOT GREEN** — fix committed; Sandbox deploy + browser proof pending.

Production untouched. Unrelated dirty tree preserved.

## Root cause

Draft invoices linked to an Event Order **live-project** billable EO charges into the invoice UI (`getInvoice`), but those charges are **not stored** in `invoice_line_items` until freeze-on-send.

`addLineItem` computed percent tax from **stored rows only**. With a stored $250 discount and projected charges only in the UI, the taxable base became `max(0, 0 − 250) = 0`, so tax persisted as **$0** while the rate (6.25%) was saved.

## Expected amount (product rules)

Exclusive tax on `(charges − discounts)`. Deposits are not discounts.

Illustration from the reported UI: `($2,243 − $250) × 6.25% = $124.56` after cent rounding.

Harness uses the invoice’s actual billable EO projection total at runtime.

## Fix

| File | Change |
| --- | --- |
| `lib/invoices/exclusive-tax.ts` | Pure rollup → exclusive tax / percent discount |
| `lib/invoices/repository.ts` | `additionalRollupLines`; `refreshPercentTaxLines` |
| `lib/invoices/service.ts` | Pass EO projections; refresh on read/mutate; block duplicate percent tax |

## Verification

```text
npx tsx --test lib/invoices/exclusive-tax.test.ts
EXPECTED_SHA=<sha> npx tsx scripts/qa/event-order-invoice-tax-zero.mts
```
