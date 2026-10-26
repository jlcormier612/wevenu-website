# STATUS — Timeline timing simplification

**Verdict: IN PROGRESS**

Awaiting Sandbox serve of `62fa1f9eb208a9af8c0bc35a41aeb30a986c4e26`, then browser harness.

## Root causes

1. Template editor showed clock time and raw **Relative Time (min)** together; the control did not name the reference.
2. Event Timeline Setup used a bare **Day offset** number instead of this event’s calendar days.
3. Relative apply invented **12:00 noon** when Day-of schedule start was missing.

## Timing contract

Documented in `TIMING-CONTRACT.md`:

- Day = `day_offset` from `event_date` (Day 1 = event date).
- Default = specific clock (`time_of_day` / `entry_time`).
- Relative = minutes before/after **Day-of schedule start** (`events.start_time`) only; bake at apply; no live recalculation.
- Missing start → no invented clock.

## Files changed

| File | Why |
|------|-----|
| `lib/timeline/timing-presentation.ts` | Shared labels, modes, relative phrases |
| `lib/timeline/constants.ts` | Remove noon invent |
| `lib/timeline-templates/constants.ts` | Plain day/relative labels |
| `timeline-template-editor.tsx` | Timing modes + named anchor |
| `event-timeline-setup-editor.tsx` | Day selector with dates |
| `event-setup-panel.tsx` / `event-detail.tsx` | Pass `eventEndDate` |
| `timeline-setup-card.tsx` | Honest missing-start copy |

## Tests

```text
npx tsx --test lib/timeline/timing-presentation.test.ts \
  lib/timeline/relative-time-anchor.test.ts \
  lib/timeline-templates/starters.test.ts \
  lib/timeline/chronological-order.test.ts \
  lib/timeline/save-event-timeline-draft.test.ts
→ 28 pass / 0 fail (unit-test.log)
```

## Deploy

- Commit: `62fa1f9eb208a9af8c0bc35a41aeb30a986c4e26`
- Run: https://github.com/jlcormier612/wevenu-website/actions/runs/40256987860 (queued)
- Browser: `EXPECTED_SHA=62fa1f9eb208a9af8c0bc35a41aeb30a986c4e26 npx tsx docs/qa/timeline-timing-simplification/verify-browser.mts` — **not run yet** (image not serving)

## Production

**Untouched.**
