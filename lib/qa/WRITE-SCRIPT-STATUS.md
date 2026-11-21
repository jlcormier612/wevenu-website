# QA write-script status (PR #123 corrective)

Protected venues (by verified ID): Willow Grove, Jen's Fancy Venue, Sweet Daisy Barn & Farm.

## Disposable-ready

| Script | Notes |
|---|---|
| `scripts/qa/public-forms-wave1-fixture.ts` | Requires `DISPOSABLE_VENUE_ID`; uses `createGuardedQaAdmin` |
| `scripts/qa/public-forms-starters-disposable-acceptance.mts` | Creates disposable venue + teardown |

## Explicitly blocked (fail before mutation)

56 write-capable scripts under `scripts/qa/` call `refuseProtectedVenueHardcodes` with hardcoded curated venue IDs at startup. They throw `REFUSED` unless dual-key founder maintenance env is set. **Not converted to disposables in this PR.**

## Read-only

Scripts that only select/read curated venues remain allowed when they do not call refuse/guarded write helpers.

## Override policy

`HTC_ALLOW_PROTECTED_QA_WRITES=1` alone does **not** disable protection.  
Both `HTC_FOUNDER_PROTECTED_QA_MAINTENANCE=1` and `HTC_ALLOW_PROTECTED_QA_WRITES=1` are required for founder maintenance writes.
