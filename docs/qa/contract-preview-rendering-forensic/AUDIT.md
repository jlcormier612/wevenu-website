# Contract Preview Rendering — Forensic Audit

## Observed defects → root cause

| # | Symptom | Root cause | Shared path? |
|---|---|---|---|
| 1 | HTC green band, no logo | `/contracts/new` omitted `venueBrand` → null brand → artifact defaults | Preview create path only; draft detail + `/sign` already branded |
| 2 | Raw `{{balance_remaining}}` etc. | Deferred tokens removed from merge map; Library content still uses them; `mergeContent` leaves unknowns | Preview **and** Send (`materializeAuthoredContractContent`) |
| 3 | Body says primary only | `client_name` from primary contact; signer seeds only fed signature blocks | Preview **and** Send |
| 4 | Fear of Preview≠Send | Same materialize function; inputs incomplete | N/A — keep single resolver |

## Sources of truth (post-fix)

| Token | Source |
|---|---|
| `venue_*` | Venue profile |
| `client_name` | Selected required client signer names (joined with `&`); else primary |
| `first_name` / `last_name` | Primary contact (unchanged for other workflows) |
| `venue_access_hours` | Event setup/start/end/teardown |
| `ceremony_summary` / `reception_summary` | Final Details questionnaire + ceremony/reception space assignments + client times |
| `balance_remaining` | Payment schedule `computePortalScheduleTotals.remaining` |
| `contract_total` | Selection / schedule total via `formatCurrency` |
| Branding | `captureContractBrandingSnapshot` / `resolveContractBrandPresentation` |
