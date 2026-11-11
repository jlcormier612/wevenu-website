# STATUS — Event Order process completion

**Verdict: GREEN / CLOSED**

| Item | Value |
|------|-------|
| Commit | `20e9e3168c7e971533b6d95555d7d44d922319fa` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40239565138 (success) |
| Serving image | `htc-sandbox-venue-app:20e9e3168c7e971533b6d95555d7d44d922319fa` |
| Digest | `sha256:6575c2855b577e0c07975a07c78c28b65415f0b346c1251d22c6227f6d97b7ba` |
| Production | **Untouched** |
| Choice-tree CLOSED work | Preserved |

## Root cause

Booking Selected Package (`commercial_selections` + inclusion text) and Event Order start (Setup Profile EO template / panel `ensure`) were not joined. Inclusions required a manual import.

## Fix (smallest complete)

On `ensureEventOrder` / `replaceEventOrderFromTemplate` for **open, unshared** orders: seed missing Selected Package inclusions as included custom lines stamped `package-selection:{id}|{name}`. Panel reconciles `ensure` once even when an EO already exists. No Offering invention; no auto package fee.

## Verification

- Unit seed + panel wiring PASS  
- `verify-process.mts` GREEN (package → EO seed, idempotent, payable stable)  
- `verify-financial-fixture.mts` GREEN (EO↔invoice $2189.81, freeze rev 26)  
- Conditional choice unit regression PASS  

## Remaining blockers

None for the agreed process. Optional later: Library copy clarifying Packages vs Offerings; Offering price-readiness UI (catalog audit P1) — not required for this closure.
