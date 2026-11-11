# Financial agreement, payment plan, hold date ranges, contract schedule

## Status: GREEN — core paths + three residuals closed (Sandbox)

**Starting tip (prior core):** `a22429b520512eed077bcd97fb7e3cbcdc98731a`  
**Residuals + hold layout + rehearsal authority tip:** `9e59f2784dd330c2da6464219b7c6da89847cad4`  
**Layout/rehearsal intermediate tip:** `7bcd2eae4636a37507c94e791af7e8aa08e94b91`  
**Migration:** `20261417000000_financial_adjustments_and_hold_date_ranges.sql` — [apply 38209076930](https://github.com/jlcormier612/wevenu-website/actions/runs/38209076930) success  
**Core deploy:** [38209078846](https://github.com/jlcormier612/wevenu-website/actions/runs/38209078846) success  
**Layout/rehearsal deploy:** [38212319333](https://github.com/jlcormier612/wevenu-website/actions/runs/38212319333) success  
**Residuals credit UI deploy:** [38213971787](https://github.com/jlcormier612/wevenu-website/actions/runs/38213971787) success  

**Evidence (historical core):** `browser-results.json`, `lead-hold-range.png`  
**Evidence (residuals closure):** `residuals-browser-results.json`, `residuals-browser-run.log`, screenshots below

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
- Post-payment credit: `applyPostPaymentCredit` + invoice **Apply credit** UI (issued invoices only; does not rewrite paid installments; schedule regenerate stays explicit).

### Holds
- Inclusive `date_holds.end_date` (legacy backfill `end_date = hold_date`).
- Optional `preference_id` → `lead_event_space_preferences`.
- Occupancy / conflict / UI date-range aware; end-date field in Place Hold form.
- Date Hold form layout: title full width; Start/End date side-by-side; Start/End time side-by-side.
- Standalone Rehearsal Dinner `Date` input removed; hold-linked preference `scheduled_date` is authoritative (hold sync + contract merge fallback).

### Schedule / contract
- Holds never invent contract components. Preference `scheduled_date` + merge fields from tip `ee3b67a9` retained.
- Contract smart field for totals is `{{contract_total}}` (not `{{total_amount}}`).

## Verification performed (historical core — tip `a22429b5`)

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

## Residual closure (2026-10-12 — tip `9e59f278`)

Browser journey: `EXPECTED_TIP_PREFIX=9e59f278 npx tsx scripts/qa/financial-residuals-browser.mts`  
Result file: `residuals-browser-results.json` — **pass=true, 21/21 checks** at `2026-10-12T06:58:23.765Z`

### Residual 1 — Selected Package multi-adjustment UI — GREEN
- UI: Select package → Tax & discount → add Discount `$500` + Credit `$2,500` → tax 6.25% → preview shows taxed total `$23,375`.
- Persist: `package_amount=25000`, `discount_amount=3000`, `total_amount=23375`, two named adjustments.
- Leave → reload → reopen: both descriptions preserved once; deposit not in adjustments list.
- Screenshots: `r1-after-select-package.png`, `r1-financial-terms-reopen.png`

### Residual 2 — Post-payment credit → schedule regeneration — GREEN
- Offline pay via invoice **Record payment received** UI (`status=paid`, `$4000` Deposit).
- **Apply credit** UI: `$1000` “Post-payment referral credit” → invoice `total=9000`, `discount_amount=1000`, `balance_due=5000`.
- **Regenerate Schedule** UI: paid Deposit id/amount/status preserved; unpaid sum `$5000` = remaining.
- Screenshots: `r2-after-record-pay.png`, `r2-schedule-after.png`

### Residual 3 — Fresh multi-adjustment contract signing — GREEN
- Selection totals `$23,375` with two adjustments intact through lifecycle.
- Draft uses `{{contract_total}}`; materialize → send (no Resend) → client public token sign → venue countersign → `status=signed`.
- Screenshot: `r3-contract-after-sign.png`

### Hold layout + rehearsal Date — GREEN (same run)
- Three-row form geometry verified; rehearsal standalone Date absent; hold syncs `scheduled_date=2027-10-08`.
- Screenshot: `hold-form-layout.png`

### Unit / regression
```
npx tsx --test lib/invoices/post-payment-credit.test.ts lib/invoices/sent-invoice-edit-safety.test.ts lib/invoices/financial-adjustments.test.ts
npx tsx --test lib/availability/date-hold-form-layout.test.ts lib/leads/rehearsal-date-hold-authority.test.ts
```
All PASS.

## Safety

Sandbox only. No Production. No real payments/emails. Historical executed contracts not rewritten. Disposable `@hellotocheers-test.invalid` records cleaned after browser run.
