# Contract Preview / Send — vendors_on_file + package currency

**Status:** FIX READY FOR SANDBOX VERIFY  
**Production:** untouched  
**Base image containing f7c81423:** `9e0a56a2` (already live)  
**This fix:** (commit pending)

## Root cause

1. **`{{vendors_on_file}}`** is a **deferred** Smart Field (`DEFERRED_MERGE_FIELD_KEYS`) — not in the Contract Builder picker and not a contract-time SoT. The code starter already omits it. The Sandbox Library copy of “Wedding Venue Agreement” and draft `5a5f8117…` still contained the obsolete token after static “No outside vendors.” wording. `mergeContent` left it raw → Preview showed `{{vendors_on_file}}` → Send failed `assertCustomerSafeContractContent`.

2. **Package currency:** `formatPackageSection` used `toFixed(2)` (`$25000.00`) while `contract_total` uses `formatCurrency` (`$25,000.00`).

## Fix

- Always materialize deferred `vendors_on_file` to honest fallback: “Vendors on file are not listed yet.” (no invented vendors; still **not** in `MERGE_FIELDS` picker).
- Strip `{{vendors_on_file}}` from Sandbox Library template `6260b3e1…` and draft `5a5f8117…` (keep “No outside vendors.”).
- `formatPackageSection` uses canonical `formatCurrency`.

## Tests

`npx tsx --test 'lib/contracts/*.test.ts'` → **129/129 pass**  
Also package currency / proposal journey asserts updated.

Typecheck: no new errors (baseline only: cross-surface-contract TS2322, inbox-needs-response TS2345).
