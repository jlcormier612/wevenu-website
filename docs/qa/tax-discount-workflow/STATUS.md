# Tax & discount + multi-date contract workflow

## Status

**Tax default prefill:** fixed (code) — pending Sandbox deploy verification  
**Tax/discount apply path:** unchanged product rule (manual apply; Settings unlock UI)  
**Rehearsal dinner / additional date on contract:** fixed (code + migration) — pending Sandbox verify  

## Root causes

### Tax rate shows 7%

Invoice “Add tax” left `taxRatePercent` blank and used `placeholder="7"`. Browsers show the placeholder as if it were the value. Venue `defaultTaxPercent` (6.25%) was never passed into `InvoiceLineItemsEditor`.

### Package / contract without tax breakdown

Enabling Use taxes / Use discounts does **not** auto-apply. Apply path remains Selected Package → **Tax & discount** sheet → persisted `commercial_selections` → contract merge. Draft invoices can add Tax/Discount lines when prefs are enabled.

### Rehearsal dinner missing from contract

1. `{{additional_event_spaces}}` listed bare space names (no use label).  
2. Pre-booking contracts only loaded ceremony/reception preferences — residual components (rehearsal dinner) were omitted.  
3. No agreed component date on preferences; calendar holds alone must not invent contract obligations.  
4. No `{{rehearsal_date}}` Smart Field.

## Corrections

- Prefill new Tax lines from `venue.commercialBookingPrefs.defaultTaxPercent`; remove misleading `7` placeholder.
- `resolveAdditionalEventSpacesLabel` → `Use: Space (Date)` when date set.
- Pre-booking: residual lead preferences feed `additional_event_spaces`.
- Migration `scheduled_date` on `lead_event_space_preferences` + UI date for Rehearsal Dinner.
- `{{rehearsal_date}}` merge field; starter section omitted when empty.
- On book, copy preference `scheduled_date` → `clients.rehearsal_date` when client date is null (not from holds).

## Calculation order (unchanged)

Package → discount (% or fixed, frozen $) → exclusive tax on discounted amount → final total. Deposit % of agreed total allocation (not a discount).

## Safety

Sandbox only. No auto-tax. Holds ≠ contractual components. Historical executed contracts not rewritten.
