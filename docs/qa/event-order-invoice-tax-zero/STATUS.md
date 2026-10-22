# Launch blocker — EO-linked invoice tax shows $0 at 6.25%

**Verdict: GREEN** — fix serving on Sandbox; browser proof passed.

Production untouched. Unrelated dirty tree preserved.

## Root cause

Draft invoices linked to an Event Order **live-project** billable EO charges into the invoice UI (`getInvoice`), but those charges are **not stored** in `invoice_line_items` until freeze-on-send.

`addLineItem` computed percent tax from **stored rows only**. With a stored $250 discount and projected charges only in the UI, the taxable base became `max(0, 0 − 250) = 0`, so tax persisted as **$0** while the rate (6.25%) was saved.

## Expected amount (product rules)

Exclusive tax on `(charges − discounts)`. Deposits are not discounts.

Harness fixture (Fancy draft `INV-2026-4489C8` / `4489c869-…`): EO billable **$1,793** − discount **$250** → base **$1,543** × 6.25% = **$96.44**. After discount removed → tax **$112.06**.

## Fix

| File | Change |
| --- | --- |
| `lib/invoices/exclusive-tax.ts` | Pure rollup → exclusive tax / percent discount |
| `lib/invoices/repository.ts` | `additionalRollupLines`; `refreshPercentTaxLines` |
| `lib/invoices/service.ts` | Pass EO projections; refresh on read/mutate; block duplicate percent tax |

Commit: `a11547be457ce5323e4d32fb2fda2d6ff7df0d53`

## Deploy / serving

| Step | Result |
| --- | --- |
| Contrast deploy `8da8f65f` | [39862760418](https://github.com/jlcormier612/wevenu-website/actions/runs/39862760418) SUCCESS |
| Tax deploy `a11547be` | [39863731072](https://github.com/jlcormier612/wevenu-website/actions/runs/39863731072) SUCCESS |
| Serving SHA | `a11547be457ce5323e4d32fb2fda2d6ff7df0d53` (verified on `/login`) |

## Fixture safety

Harness targets Fancy draft invoice `4489c869-…` only (`venue_id` = Fancy). It deletes **only** that invoice’s `discount`/`tax` line items, then re-adds via UI. Does not touch EO lines, charge projections, Meadowbrook, or other invoices.

## Verification

```text
npx tsx --test lib/invoices/exclusive-tax.test.ts
EXPECTED_SHA=a11547be457ce5323e4d32fb2fda2d6ff7df0d53 \
  npx tsx scripts/qa/event-order-invoice-tax-zero.mts
→ GREEN passed=11 failed=0
```

Proven: projected EO charges in taxable base, tax $96.44 at 6.25%, UI “6.25% applied”, persistence after reload, recalc to $112.06 when discount removed, duplicate tax blocked.
