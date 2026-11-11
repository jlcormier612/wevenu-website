# Venue Guest-List Import Removal — STATUS

**Verdict:** **GREEN / CLOSED**  
**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Product commit:** `c6452a5824de658f0391081c9d9b377b8799bd27`  
**Evidence commit:** _(this STATUS + runtime artifacts)_  

## Product decision implemented

Individual guest-list data is **client-owned**. Venue Migration Center must not import `guest_list` rows into `couple_guests` / `couple_households` or force `visibility_to_venue = true`.

## Code changes

| Layer | Change |
|-------|--------|
| UI | `guest_list` removed from `COMMITTABLE_ENTITIES` |
| Normalize | `generic-csv` rejects with shared message |
| addRows / addRowsToOwnSession | Reject / throw before inserts |
| commitOneRecord | Reject; no admin client / `commitOperationalGuest` |
| Batch list | Removed from `COMMITTABLE_ENTITY_TYPES` |
| Shared | `lib/migration/venue-guest-list-import.ts` |

## Unit / source tests

`npx tsx --test lib/migration/venue-guest-list-import.test.ts lib/migration/guest-list-admin-write.test.ts lib/import/migration-language.test.ts lib/import/migration-guidance.test.ts` → **22/22 pass**

## Sandbox deploy

| Item | Value |
|------|-------|
| Deploy run | [39529689140](https://github.com/jlcormier612/wevenu-website/actions/runs/39529689140) **success** |
| Serving SHA | `c6452a5824de658f0391081c9d9b377b8799bd27` |
| Task definition | `htc-sandbox-venue-app:818` |
| Image | `htc-sandbox-venue-app:c6452a5824de658f0391081c9d9b377b8799bd27` |
| Rollout | COMPLETED · 1/1 RUNNING |
| Production | **untouched** |

## Runtime verification

| Check | Result | Artifact |
|-------|--------|----------|
| MC picker has no Guest list; Clients/Events/Booked finances remain | **7/7** | `browser-results.json`, `mc-entity-picker-1280.png` |
| Normalize reject + stale session + visibility unchanged + no new guests/households | **7/7** | `server-reject-results.json` |
| Supported Vendors MC import persists | **5/5** | `supported-portal-results.json`, `mc-vendor-import-1280.png` |
| Portal Guest List still shows Import CSV | **pass** | `portal-guests-1280.png` |
| Venue JWT SELECT on `couple_guests` returns 0 rows (even if `visibility_to_venue=true`) | **denied** | `auth-jwt-results.json` |

## Audits (no new features built)

- `AUTHORIZATION.md` — intended vs effective vs verified  
- `CLIENT-IMPORT-EXPORT.md` — portal CSV import yes (narrow fields); **export not found**  
- `OPERATIONAL-HANDOFFS.md` — counts / seating / dietary aggregates / EO  

## Working tree

Unrelated dirty files preserved (~886 before/after product commit).

## Follow-ups (out of scope — documented only)

1. Client guest-list **export** gap.  
2. `getGuestReadinessSummary` may return empty under current RLS (stale Sprint 107 comment).  
3. `get_wedding_day_ops` dietary aggregates do not gate on `visibility_to_venue`.  
4. Do not re-wire `commitOperationalGuest` into venue MC.
