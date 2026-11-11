# Permitted-use follow-up — FINAL REPORT

**Overall: GREEN**  
**Serving commit:** `7ffb231b484d99cc01dda37c920bac24f0c62c2e`  
**ECS:** `htc-sandbox-venue-app:7ffb231b484d99cc01dda37c920bac24f0c62c2e`  
**Migration applied:** `20261425500000_enforce_assignment_permitted_uses.sql` ([40721257072](https://github.com/jlcormier612/wevenu-website/actions/runs/40721257072))  
**Deploy:** [40721262417](https://github.com/jlcormier612/wevenu-website/actions/runs/40721262417) success  
**Production:** untouched  

---

## 1. Permitted-use enforcement

**Root cause:** `replace_event_space_assignments` only required the space to be an active row on the venue. It never checked `venue_spaces.permitted_uses`. The UI filtered via `spacesEligibleForUse`, so the defect showed up on RPC/bypass paths (as in the large-venue harness).

**Fix:**
- Migration updates the RPC to validate every assignment **before** `DELETE`, raise with `hint=permitted_use` and a clear message, and keep empty `permitted_uses` = unrestricted (existing SoT).
- App service calls `permittedUseAssignmentError` before the RPC (defense in depth).

**Server-side enforcement point:** Postgres `public.replace_event_space_assignments`.

**Regression:** Unit 93/93 (assignments + occupancy). RPC harness GREEN — reception on cocktail-only Stone Patio rejected; prior cocktail row preserved; valid cocktail and Barn reception succeed.

## 2. Large-venue regression

On Sandbox after the fix: Barn + Ballroom simultaneous overlapping Events still succeed; same-space overlap still returns `space_overlap`; capacity remains venue-scoped (`max=3` on Fancy). Occupancy unit suite still passes.

## 3. Fancy test configuration

**No action.** Ballroom, Lakeside Pavilion, and `max_simultaneous_events=3` are `venue_id`-scoped to Fancy. Other venues keep their own capacity rows. A differently owned space also named “Ballroom” is a separate tenant row, not a leak. See `FANCY-CONFIG-IMPACT.md`.

## 4. Public availability

Verified behavior unchanged. Date-level inquiry limitation documented in `docs/qa/large-venue-simultaneous-events/PUBLIC-AVAILABILITY-LIMITATION.md`. No code, default, or UI change.

## 5. Deployment / evidence

- `rpc-results.json`, `rpc-run.log`
- `browser-results.json` (serving tip, event edit reachable, no overflow)
- Shots under `shots/`

## 6. Production

Production was not deployed or modified.
