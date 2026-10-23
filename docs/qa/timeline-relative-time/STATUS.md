# Timeline Relative Time — Anchor Verification

**STATUS: GREEN / COMPLETE**  
**Date:** 2026-10-23  
**Serving (at E2E):** `df95f7c4c17a3e522396df98df818754994d37b6`  
**Evidence:** `browser-results.json`, `browser-run.log`, `shots/`

## Anchor (implementation fact)

| Question | Answer |
| --- | --- |
| Field used | `events.start_time` — the event form **Day-of schedule → Start time** |
| Not used | Ceremony / reception / getting-ready `event_space_assignments.start_time` |
| Calculation | `resolveEntryTimeFromOffset(minutesOffset, eventStartTime)` in `lib/timeline/constants.ts` at **template apply** |
| Fixed Time | `timeOfDay` wins over `minutesOffset` when both set (`apply.ts`) |
| Null start | Falls back to **12:00** noon |
| Day N | `day_offset` relative to `event_date` (Day 1 = offset 0) |
| After apply | Offset is **baked** into `timeline_entries.entry_time`; changing Start time later does **not** recalculate |
| Client/vendor | Same entry_time; internal `notes` not shown on portal |

## Deterministic E2E (event start 16:00; getting-ready would be 10:00; reception 18:00)

| Item | Offset / fixed | Expected | Actual |
| --- | --- | --- | --- |
| m60 | −60 | 15:00 | 15:00 |
| 0 | 0 | 16:00 | 16:00 |
| p30 | +30 | 16:30 | 16:30 |
| p120 | +120 | 18:00 | 18:00 |
| fixed | Time 14:45 | 14:45 | 14:45 |
| day2 | +0 on Day 2 | 16:00 day_offset=1 | matched |

Wrong-anchor checks: −60 from 10:00 → 09:00; from 18:00 → 17:00 — **not** observed.

**Browser:** 13 PASS / 0 FAIL / 0 BLOCKED. Portal showed items without internal notes. Changing start to 12:00 left baked 16:00 entry unchanged.

## Product / UX

Helper copy in the template item editor now names **Day-of schedule Start time** explicitly and states bake-at-apply behavior (deploy with evidence tip).

## Units

```text
npx tsx --test lib/timeline/relative-time-anchor.test.ts lib/timeline-templates/starters.test.ts
→ pass
```
