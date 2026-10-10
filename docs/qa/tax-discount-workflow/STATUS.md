# Tax & discount workflow — forensic + discoverability

## Forensic summary (Phase 1)

| Layer | Finding |
|---|---|
| Settings | `useTaxes`, `defaultTaxPercent`, `useDiscounts` under **Invoice adjustments**. Enabling does **not** apply tax/discount; it unlocks apply UI. |
| Package catalog | Name/price/category only. No package-level tax. Correct: catalog is not the apply surface. |
| Selected Package | Canonical apply path: **Tax & discount** sheet (`SelectionFinancialTermsSheet`) → `computeAgreedFinancialTerms` → persisted on `commercial_selections` → contract merge + invoice/payment plan. |
| Invoice builder | Draft invoices can add **Tax** / **Discount** line types when prefs enabled (`invoiceLineTypesForVenue`). Totals via `computeInvoiceTotals`. |
| Rules (established) | Exclusive tax on discounted package amount; % discount freezes dollars at apply; deposits are not discounts; settings rate is a default input, not auto-apply. |

### Root cause of “can’t find tax/discount”

Not missing calculation. **Discoverability**: apply lived behind a quiet **Financial terms** button that disappears after contract/invoice, while Settings looked like the apply surface.

## Implementation (this change)

- Rename CTA to **Tax & discount**; sheet title **Invoice adjustments**.
- Locked-state hint points to prior Selected Package terms + draft invoice line items.
- Draft invoice editor: explicit **Invoice adjustments** with Add discount / Add tax.

## Runtime — GREEN

Deployed: `28ea251ae828ccaa1a940e0503d47625aa5ab617`  
Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/38017090393  
Health ok · ECS `:647`

Browser proof (`docs/qa/tax-discount-workflow/results.json`):

- Lead Selected Package shows **Tax & discount** CTA
- Sheet titled **Invoice adjustments**; save persists 10% discount + 6.25% tax → total $1,912.50
- Draft invoice shows **Invoice adjustments** with Add discount / Add tax
- Fixtures cleaned up

Unresolved product decisions: none for this discoverability fix — financial rules reused from existing `computeAgreedFinancialTerms` / settings copy.
