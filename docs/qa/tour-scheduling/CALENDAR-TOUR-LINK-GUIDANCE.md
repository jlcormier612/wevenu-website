# Calendar tour link vs lead scheduling link

**Status:** GREEN on Sandbox  
**Deployed tip:** `0122911f32c20b33ea99321d1df4ad7306cea3ce`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38197204310  
**Preserved:** `553c8687` mode lock; `45290d6a` / `8e4f911e` / `c00749be` ancestry  
**Production:** untouched  
**Observed:** 2026-10-12T02:58Z

## Problem

Staff copied **Calendar → Copy tour link** (generic `/book/{key}`) for an existing prospect whose preferred event date was held. That form required Preferred event date via `choose_available`, where the held date is **not selectable**, so the prospect could not submit a tour.

**Correct link:** Lead → **Copy scheduling link** (`/book/{key}?o=…`).

## Fixes

1. Staff guidance on Calendar, Lead, and Settings tour surfaces.
2. Preferred event date is **optional** on `schedule_tour` (tour mode) so a generic link can complete without selecting a held date; email attach / `?o=` attach preserve the lead.
3. Request Information still enforces required preferred dates; other prospects still get `date_unavailable` for held dates.

## Verification on tip `0122911f`

| Suite | Result |
|---|---|
| Unit (tour context + public link + blocked dates + platform integrity) | **23/23** |
| `generic-tour-held-date-browser.mts` | **12/12 GREEN** |
| `existing-lead-tour-preferred-date-browser.mts` | **27/27 GREEN** |

Evidence: `generic-held-browser-results.json`, `browser-results.json`, screenshots under `docs/qa/tour-scheduling/`.
