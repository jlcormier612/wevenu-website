# Financial agreement, payment plan, hold date ranges, contract schedule

## Status: GREEN (core paths Sandbox-verified) with documented residuals

**Deployed tip:** `a22429b520512eed077bcd97fb7e3cbcdc98731a`  
**Migration:** `20261417000000_financial_adjustments_and_hold_date_ranges.sql` — [apply 38209076930](https://github.com/jlcormier612/wevenu-website/actions/runs/38209076930) success  
**Deploy:** [38209078846](https://github.com/jlcormier612/wevenu-website/actions/runs/38209078846) success  
**Evidence:** `browser-results.json`, `lead-hold-range.png`, unit suites

## Forensic findings (pre-change)

1. `computeAgreedFinancialTerms` supported a **single** discount + optional exclusive tax.
2. `date_holds` stored a single `hold_date` — weekend reservations required multiple daily holds.
3. Preferences already had `scheduled_date` (tip `ee3b67a9`) for rehearsal dinner contract merge; holds were not explicitly linkable to a preference.
4. Payment plan regenerate already preserved collected amounts and rebuilt unpaid installments from remaining balance.

## Implemented

### Financials
- `lib/invoices/financial-adjustments.ts` — multi adjustment model; `$25k − $500 − $2,500 = $22,000`; 6.25% exclusive tax; `redistributeUnpaidInstallments`.
- `commercial_selections.financial_adjustments` jsonb; legacy `discount_*` remain rollups.
- Selected Package sheet supports multiple named adjustments; deposit remains payment allocation.
- `redistributeRemainingAcrossUnpaid` on payment reconcile path (paid lines untouched).

### Holds
- Inclusive `date_holds.end_date` (legacy backfill `end_date = hold_date`).
- Optional `preference_id` → `lead_event_space_preferences`.
- Occupancy / conflict / UI date-range aware; end-date field in Place Hold form.

### Schedule / contract
- Holds never invent contract components. Preference `scheduled_date` + merge fields from tip `ee3b67a9` retained.

## Verification performed

| Check | Result |
|---|---|
| Unit: financial-adjustments + financial-terms + hold-date-range + hold suites | PASS |
| Migration applied on Sandbox | PASS |
| App tip `a22429b5` live | PASS |
| DB: selection total 22000 / discount 3000 / 2 adjustments | PASS |
| DB: hold Fri–Sun `2027-09-03`–`2027-09-05` | PASS |
| DB: range query covers Saturday | PASS |
| Browser: Place Hold shows End date field | PASS |
| Browser: active hold range visible on lead | PASS |
| Legacy hold rows have `end_date >= hold_date` | PASS |

## Residuals (not claiming full closure without further passes)

1. Full click-through of Selected Package “Add adjustment” UI rows (persistence proven via DB seed on tip).
2. End-to-end post-payment additional credit → amendment → regenerate schedule in browser (helpers + existing regenerate path present; not re-run as a signed-payment journey this pass).
3. Contract customer-facing signing lifecycle for multi-adjustment totals — relies on existing merge of `total_amount` / package section; rehearsal schedule already GREEN on tip `ee3b67a9`.

## Safety

Sandbox only. No Production. No real payments/emails. Historical executed contracts not rewritten. Disposable `@hellotocheers-test.invalid` records cleaned after browser run.
