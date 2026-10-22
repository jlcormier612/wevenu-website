# Invoice & Payment Plan — Amount Due Now contrast

**Verdict: NOT GREEN** — fix committed; Sandbox deploy + browser proof pending.

Production untouched. Unrelated dirty tree preserved.

## Root cause

`InvoicePrintDocument` painted financial amounts with raw venue **Accent** on the **Neutral** banner (and again on the white totals row). Meadowbrook uses cream Accent `#F2E9DC` on lavender Neutral `#EFDAF5` → cream-on-lavender, far below WCAG AA.

Venue invoice summary uses design-token `text-heading` / `text-muted-foreground` (not brand Accent) and was not the screenshot failure mode.

## Fix

| File | Change |
| --- | --- |
| `lib/collateral/print-brand.ts` | `resolvePrintBrandInk` — Neutral/white/primary ink via `readableInk` / `inkOn` / `mutedInkOn` |
| `components/invoices/invoice-print-document.tsx` | Use contrast-safe ink for hero amounts, totals Amount Due Now, section heads, header on-primary |

Brand Neutral background preserved; only foreground ink falls back when Accent fails 4.5:1.

## Verification (local)

```text
npx tsx --test lib/collateral/print-brand-contrast.test.ts \
  lib/theme/brand-colors-surfaces.test.ts \
  lib/theme/venue-brand-surface.test.ts \
  lib/theme/public-form-surface.test.ts \
  lib/invoices/payment-workflow-regression.test.ts \
  lib/invoices/exclusive-tax.test.ts \
  lib/contracts/venue-phone-display.test.ts
→ 74 pass / 0 fail
```

Browser (after deploy):

```text
EXPECTED_SHA=<sha> npx tsx scripts/qa/invoice-payment-plan-contrast.mts
```

Fixture: Meadowbrook invoice `3b9f4bb6-…` (read-only; no row deletes, no client email).
