# Day-of sheet venue control + remaining Timeline UI

**Verdict: PARTIALLY VERIFIED — code fix local; browser exclusion awaits Sandbox deploy**

**Serving (unchanged):** `f0a498be56b555bf56bc5f8b59e8609fbd45e9a3`  
**Health:** OK  
**Production:** untouched  
**Deploy this task:** not performed (needs separate authorization)  
**Fixtures:** `TEE-DOC-*` cleaned  

## Audit findings

### Root cause
Day-of Sheet loads `event.timeline` via `get_event_timeline_merged` (venue live + latest client **submission**), then `buildDaySheetSchedule` previously projected **all** rows. Client submit therefore auto-included couple items on the operational sheet.

### Existing inclusion mechanism (reused — no new workflow)
- **Owner axis:** venue-owned entries are the venue’s operational content.
- **Include:** venue uses existing Timeline **Add item** to create a **venue-owned** row (can mirror a couple idea). Client row stays `owner=client` (💗 on Timeline).
- **No** separate approve flag, schema field, or ownership conversion UI exists — and none was invented.

### Other outputs
| Surface | Change |
|---------|--------|
| Day-of Sheet | Filter to `owner === "venue"` + scope note |
| Timeline tab (merged) | Unchanged — client submissions still visible after Submit |
| Timeline print | Unchanged — collaborative full merged list |
| Schedule reconcile / D5 | Unchanged (smoke PASS) |

## Code changes (local, not yet serving)

| File | Change |
|------|--------|
| `lib/events/day-sheet-schedule.ts` | `selectDaySheetTimelineEntries` + filter inside `buildDaySheetSchedule` |
| `components/events/day-sheet/day-sheet-document.tsx` | Scope note: venue Timeline items only |
| `lib/events/day-sheet-schedule.test.ts` | Regression: client excluded, venue kept |

Unit: `npx tsx --test lib/events/day-sheet-schedule.test.ts` → **8/8 PASS**

## Evidence (run `DOCMVQ9M028`)

| Check | Result |
|-------|--------|
| Shared Timeline shows submitted client | PASS (merged RPC) |
| Selection helper excludes client before venue include | PASS (live merged rows + local helper) |
| Client ownership preserved | PASS |
| Venue Add creates venue-owned twin; client not converted | PASS |
| Selection includes venue twin; still excludes client title | PASS |
| Browser day-sheet shows venue include | PASS |
| Browser day-sheet excludes client | **PENDING_DEPLOY** (serving pre-fix; body still contained client title) |
| UI unlock schedule-generated | PASS (`lock_state=editable`, key kept) |
| UI drag-reorder persists | PASS (sort order changed) |
| D5 still blocks / reconcile preserves client | PASS |

Artifacts: `day-of-control-results.json`, `shots/day-of-control/*`

## Remaining gaps

1. **Deploy authorization** required to prove browser day-sheet exclusion + scope note on Sandbox.
2. **Product optional:** if you want “approve this client row onto the sheet” **without** adding a venue-owned twin, that needs a new persisted inclusion flag/UI — out of scope / not invented here.
3. Reconcile-failure runtime toast remains UNVERIFIED (unchanged).

## Completeness vs locked decision

Venue control is **implemented in code** and proven via selection against live Sandbox data + unit tests. **End-to-end browser exclusion** is not complete until the fix is deployed to Sandbox.
