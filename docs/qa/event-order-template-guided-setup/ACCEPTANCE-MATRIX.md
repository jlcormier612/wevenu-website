# Acceptance matrix — guided EO template setup

| Scenario | Criterion | Status |
|----------|-----------|--------|
| A | Outside catering/bar — skip categories; no forced options | Pending browser on serving tip |
| B | Plated only — no forced Buffet branch | Pending browser |
| C | Plated or buffet — separate branches; switch clears incompatible | Unit + conditional harness preserved |
| D | Optional rentals — preferred rentals filter; deliberate All | Unit (filter) + pending browser |
| E | Custom category persists in review/preview | Unit (custom names) + pending browser |
| F | Existing template open/save/reload preserves options & Offering IDs | Harness `persisted-*` checks |
| G | Client workflow / finance unchanged | Re-run financial fixture after deploy |
| — | Preferred Offering filter does not dump all categories | **PASS** unit |
| — | Wizard seams present | **PASS** unit (`builder-ux`, `guided-setup`) |

Update to PASS/FAIL after Sandbox browser run on tip `20a5d08c`.
