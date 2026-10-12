# Financial agreement, payment plan, hold date ranges, contract schedule

## Status: IN PROGRESS (implementation + Sandbox verification)

**Branch tip (local):** pending deploy  
**Migration:** `20261417000000_financial_adjustments_and_hold_date_ranges.sql`

## Forensic findings (pre-change)

1. `computeAgreedFinancialTerms` supported a **single** discount + optional exclusive tax. Multiple named reductions/charges were not first-class on Selected Package.
2. `date_holds` stored a single `hold_date` — weekend reservations required multiple daily holds.
3. Lead preferences already had `scheduled_date` (tip `ee3b67a9`) for rehearsal dinner contract merge; holds were not explicitly linkable to a preference.
4. Payment plan regenerate already preserved collected amounts and rebuilt unpaid installments from remaining balance.

## Implemented

### Financials
- `lib/invoices/financial-adjustments.ts` — multi adjustment model (discount/credit/charge/fee), `$25k − $500 − $2,500 = $22,000`, 6.25% tax, redistribute unpaid installments.
- `commercial_selections.financial_adjustments` jsonb + rollup into legacy `discount_*`.
- Selected Package sheet supports multiple named adjustments; deposit remains payment allocation.

### Holds
- `date_holds.end_date` inclusive; single-day legacy = `end_date = hold_date`.
- `date_holds.preference_id` optional link to `lead_event_space_preferences`.
- Occupancy / conflict / UI updated for ranges; all-day vs timed distinguished.
- Preference ids loaded for hold→component association UI.

### Schedule / contract
- Existing `scheduled_date` + `{{additional_event_spaces}}` / `{{rehearsal_date}}` path retained (holds never invent components).

## Tests run
- `lib/invoices/financial-adjustments.test.ts` + financial-terms + hold-date-range + related hold suites — PASS (local).

## Safety
Sandbox only. No Production. No real payments/emails. Historical executed contracts not rewritten.
