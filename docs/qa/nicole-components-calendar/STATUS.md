# Nicole components + Calendar-first layout — GREEN

**Status:** GREEN  
**Environment:** Sandbox only  
**Fix commit:** `c7e1fcf4a085c04400c19bb60c6a7a58eca01d5d`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38340186261  
**Serving tip:** `c7e1fcf4a085c04400c19bb60c6a7a58eca01d5d`

## Findings

Persisted Nicole assignments (unchanged) already projected correctly via `scheduled_date` (prior `d753eafb` work). Live May 9 showed four components under All spaces; Barn correctly showed Reception only.

This change makes components unmistakable (useLabel title + space name), keeps occupancy coverage, and moves Public/Tour availability cards below the calendar.

## Evidence

- `fix-browser-results.json` — VERIFY_GREEN  
- Screenshots: `fix-may8-all-spaces.png`, `fix-may9-all-spaces.png`, `fix-may9-barn.png`, `fix-day-may9.png`, `fix-week.png`, `fix-agenda.png`, `fix-layout-top.png`, `fix-cards-below.png`

## Availability

Nicole component occupancy matrix (evaluateEventOccupancy + repository `scheduled_date` load) rejects same-space overlaps and allows different-space / outside-interval requests under multi-space capacity.
