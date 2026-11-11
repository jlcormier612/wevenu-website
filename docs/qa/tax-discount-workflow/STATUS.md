# Tax & discount + multi-date contract workflow

## Status: GREEN (Sandbox verified)

**Deployed tip:** `ee3b67a9ae3e2935355d191ffa209c209fd21718`  
**Migration:** `20261416000000_lead_space_preference_scheduled_date.sql` — [apply run 38204761174](https://github.com/jlcormier612/wevenu-website/actions/runs/38204761174) success  
**Deploy:** [38204762836](https://github.com/jlcormier612/wevenu-website/actions/runs/38204762836)  
**Browser evidence:** `tax-rehearsal-browser-results.json`, `tax-prefill.png`, `contract-rehearsal.png`

## Root causes

### Tax rate shows 7%

Invoice “Add tax” left `taxRatePercent` blank and used `placeholder="7"`. Venue `defaultTaxPercent` (6.25%) was never passed into `InvoiceLineItemsEditor`.

### Package / contract without tax breakdown

Enabling Use taxes / Use discounts does **not** auto-apply. Apply path remains Selected Package → **Tax & discount** sheet → persisted `commercial_selections` → contract merge. Draft invoices can add Tax/Discount lines when prefs are enabled.

### Rehearsal dinner missing from contract

1. `{{additional_event_spaces}}` listed bare space names (no use label).  
2. Pre-booking contracts only loaded ceremony/reception preferences — residual components omitted.  
3. No agreed component date on preferences; calendar holds alone must not invent contract obligations.  
4. No `{{rehearsal_date}}` Smart Field.

## Corrections

- Prefill new Tax lines from `venue.commercialBookingPrefs.defaultTaxPercent`.
- `resolveAdditionalEventSpacesLabel` → `Use: Space (Date)` when date set.
- Pre-booking residual lead preferences feed `additional_event_spaces`.
- `scheduled_date` on `lead_event_space_preferences` + UI date for Rehearsal Dinner.
- `{{rehearsal_date}}` merge field; starter section omitted when empty.
- On book, copy preference `scheduled_date` → `clients.rehearsal_date` when null (not from holds).

## Calculation order (unchanged)

Package → discount (% or fixed, frozen $) → exclusive tax on discounted amount → final total. Deposit is a payment allocation on the agreed total, not a discount.

## Browser / DB proof (disposable Fancy fixtures)

| Check | Result |
|---|---|
| Venue default 6.25 | PASS |
| Tip `ee3b67a9` | PASS |
| Add tax prefills 6.25 | PASS |
| Override 7 → persisted amount $70 | PASS |
| Second tax starts at 6.25 | PASS |
| Contract: Rehearsal Dinner: Barn (September 3, 2027) | PASS |
| Contract: Rehearsal Date September 3, 2027 | PASS |
| Main event September 4, 2027 | PASS |
| Persisted draft matches | PASS |

## Safety

Sandbox only. No auto-tax. Holds ≠ contractual components. Historical executed contracts not rewritten. Production untouched.
