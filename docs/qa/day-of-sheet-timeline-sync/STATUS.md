# Day-of Sheet Timeline sync — STATUS

**Verdict: GREEN**

| Item | Value |
| --- | --- |
| Product commit (Defect B) | `d8d6fdfbf626980f4772b5ba5ab8d75320790262` |
| Prior Defect A (cache + Unscheduled) | `ea1abda3fa3b31b59257c8c53e09a30bd0b3dc9e` |
| Sandbox deploy | [39713100139](https://github.com/jlcormier612/wevenu-website/actions/runs/39713100139) success |
| Serving `dpl=` | `d8d6fdfbf626980f4772b5ba5ab8d75320790262` (exact match) |
| Browser harness | 18/18 PASS — `docs/qa/day-of-sheet-timeline-sync/browser-results.json` |
| Production | untouched |
| Dirty tree | unrelated work preserved |

## Root cause (Defect B)

`TimeAmPmInput` committed only on blur. Save All while the time field was focused persisted a stale empty `entry_time` even though the input still showed AM/PM. Deletes synced because Remove updates draft state synchronously. See `ROOT-CAUSE.md`.

## Unit tests

```text
npx tsx --test lib/events/day-sheet-schedule.test.ts lib/timeline/time-ampm-save-race.test.ts
→ 9/9 pass
```

## Browser acceptance (exact SHA)

```text
EXPECTED_SHA=d8d6fdfbf626980f4772b5ba5ab8d75320790262 \
  npx tsx scripts/qa/day-of-sheet-timeline-sync-browser.mts
→ ok=true, 18/18, servingSha matches
```

Proven on rendered Day-of Sheet + DB:

- Assign time to formerly untimed → 2:00 PM on sheet; `entry_time` `14:00`
- Change Early → 8:00 PM on sheet
- Clear Late → Unscheduled (no invented time)
- Delete Mid → absent
- Add New @ 3:00 PM → present once, chronological order
- Batch Save All without explicit blur (race regression)
- Library templates + control event unchanged
- Screenshots: `01-` before, `02-` after edits, `03-` print CSS

## GREEN gate

Satisfied: deploy success, live SHA == product tip, harness PASS with rendered times, persisted/rendered agreement, isolation checks.
