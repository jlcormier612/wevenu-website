# Vendor list reflects Approved preference

**Environment:** Sandbox only  
**Verdict:** GREEN

## Root cause

Selecting **Approved** persists as `venue_vendor_relationships.preference_level = 'standard'`. It does not change claim state.

Meadowbrook after the user’s session:

| Vendor | preference_level | is_claimed |
|---|---|---|
| Baker's Dozen | `standard` (Approved) | false |
| Nail Studio | `standard` (Approved) | false |
| Harah's Hair | `recommended` | false |
| Cuppity Cakes | `preferred` | false |

The Preference column rendered **no badge** for `standard`, so Approved looked unsaved while Relationship correctly showed **Not claimed**.

## Fix

Show an **Approved** badge for `preference_level === "standard"` on the venue Vendor list. Keep client-facing chips quiet for standard. Do not alter claim/invite writes.

## Evidence

- Commit: `97efb6658fdd34188dace69de887088cd0d64200`
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/38328933679
- Serving tip: `97efb6658fdd34188dace69de887088cd0d64200`
- Unit/regression: 38 pass
- Browser: `browser-results.json` — **13/13** (DB Approved+unclaimed for Baker’s/Nails; Fancy Cuppity unaffected; list shows Approved ×2 + Not claimed + Preferred/Recommended peers; survives reload)

Production untouched. Unrelated dirty/untracked work preserved.
