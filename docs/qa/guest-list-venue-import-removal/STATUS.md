# Venue Guest-List Import Removal — STATUS

**Verdict:** PENDING Sandbox deploy + browser/DB verification  
**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Product decision:** Individual guest lists are client-owned; venue Migration Center must not import them.

## Implementation (local)

| Change | Detail |
|--------|--------|
| UI | `guest_list` removed from `COMMITTABLE_ENTITIES` in `migration-center.tsx` |
| Normalize | `generic-csv` rejects `guest_list` with shared message |
| addRows / addRowsToOwnSession | Reject / throw before any `migration_records` insert |
| commitOneRecord | Reject; no `createAdminClient`, no `commitOperationalGuest`, no visibility change |
| Batch commit list | `guest_list` removed from `COMMITTABLE_ENTITY_TYPES` |
| Shared message | `lib/migration/venue-guest-list-import.ts` |

## Unit / source tests

`npx tsx --test lib/migration/venue-guest-list-import.test.ts lib/migration/guest-list-admin-write.test.ts lib/import/migration-language.test.ts lib/import/migration-guidance.test.ts` → **22/22 pass**

## Audits (docs only)

- `AUTHORIZATION.md` — intended vs effective vs verified
- `CLIENT-IMPORT-EXPORT.md` — portal CSV import yes; export not found
- `OPERATIONAL-HANDOFFS.md` — counts / seating / dietary aggregates / EO

## Sandbox (fill after deploy)

| Item | Value |
|------|-------|
| Commit SHA | _pending_ |
| Deploy run | _pending_ |
| Serving SHA / TD | _pending_ |
| Browser | _pending_ |
| Server reject + DB | _pending_ |
| Production | untouched |
| Dirty tree | preserved |

## Closure criteria

GREEN only when deploy serving SHA matches, browser shows no guest-list option, supported options remain, server reject + DB prove no guest/household writes or visibility changes, audits documented.
