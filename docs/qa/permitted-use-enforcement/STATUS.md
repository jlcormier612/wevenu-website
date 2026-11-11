# Permitted-use enforcement — STATUS

**Overall:** GREEN  
**Commit / serving:** `7ffb231b484d99cc01dda37c920bac24f0c62c2e`  
**Migration:** `20261425500000_enforce_assignment_permitted_uses.sql` — [40721257072](https://github.com/jlcormier612/wevenu-website/actions/runs/40721257072) success  
**Deploy:** [40721262417](https://github.com/jlcormier612/wevenu-website/actions/runs/40721262417) success  
**RPC + browser:** GREEN (`rpc-results.json`, `browser-results.json`)  

## Root cause

`replace_event_space_assignments` joined `venue_spaces` only for active membership. It did **not** check `permitted_uses`. UI filtered via `spacesEligibleForUse`, so staff UI was safer than the RPC. Direct RPC (and any caller bypassing the UI) could assign Reception to a cocktail-only space.

## Fix

1. Migration: validate every assignment **before** `DELETE`; raise `hint=permitted_use` with a clear message; empty `permitted_uses` remains unrestricted.
2. App: `permittedUseAssignmentError` in `replaceEventSpaceAssignments` before the RPC (defense in depth).

## RPC proof (Sandbox)

See `rpc-results.json` — invalid reception on Stone Patio rejected; prior cocktail assignment preserved; Barn reception OK; Barn+Ballroom simultaneous OK; same-space conflict OK.

## Fancy config

Leave as-is — see `FANCY-CONFIG-IMPACT.md`.

## Public availability

Document only — `docs/qa/large-venue-simultaneous-events/PUBLIC-AVAILABILITY-LIMITATION.md`. No behavior change.
