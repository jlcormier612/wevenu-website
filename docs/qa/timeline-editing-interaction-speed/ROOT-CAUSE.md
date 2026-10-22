# Timeline editing + interaction speed — root cause

## Product commit

`b910759d` — Fix Timeline AM/PM times, Save All draft edits, and schedule save feedback.

## Workstream 1 — Time format

**Cause:** Timeline display already used `formatTime` (en-US 12-hour AM/PM). The setup editor and Timeline entry form still used military presentation (`placeholder="HH:MM"` free text or `type="time"`), so coordinators saw and typed 24-hour values while the rest of HTC shows `6:00 PM`.

**Fix:** Shared `lib/timeline/time-format.ts` + `TimeAmPmInput`. Storage remains `HH:MM`. Round-trip preserves midnight/noon/near-midnight meaning.

## Workstream 2 — Batch Save All

**Cause:** `EventTimelineSetupEditor` called `updateEntryAction` / `deleteEntryAction` / `addEntryAction` per row, each with `router.refresh()` and (for delete) a confirm dialog. Multi-row edits were N serial server round-trips plus full RSC refreshes.

**Fix:** Local draft (add / edit / pending-remove + undo) + `saveEventTimelineDraft` / `saveEventTimelineDraftAction` (one venue-scoped call, one revalidate). Optional per-row Save retained for existing dirty rows. Failed batch keeps the draft. No-op when nothing changed.

**Ordering:** Unchanged domain contract — `compareTimelineEntries` (dayOffset → entryTime → sortOrder → createdAt). Editor re-sorts the draft when time/day changes. Day-of sheet / Timeline view already sort with the same comparator.

**Atomicity:** Sequential deletes → updates → inserts (no new RPC transaction). On failure, earlier ops may have committed; draft is retained for retry. Documented limitation.

## Workstream 3 — Interaction speed

### Timeline

Measured cause: N client→server actions + N `router.refresh()` cycles. Batch save reduces to **1** persistence action + **1** refresh.

### Space / location (Edit schedule)

**Cause:** Save waited inside `useTransition` until `router.refresh()` finished, so the Saving spinner tracked RSC remount, not persistence. `EventSpaceAssignmentsEditor` rematerialize effect also depended on the full `value` object (re-ran on every time keystroke).

**Fix:** Honest Saving state ends when the server action returns; refresh continues after close. Materialize effect keyed on scheduled-date fingerprint. Persistence path (`replace_event_space_assignments` + timeline sync) unchanged — still required for correctness.

### Wider audit (this pass)

| Action | Likely shared pattern | Fixed here? |
|--------|----------------------|-------------|
| Timeline setup multi-save | Serial actions + refresh | Yes |
| Edit schedule save | Spinner gated on full refresh | Yes (feedback) |
| Planning / Inventory / EO setup editors | Same per-row save + refresh pattern | Deferred — separate pass |
| Status / notes toggles on event page | `router.refresh()` after each | Deferred |

## Isolation

- Draft apply is event-scoped venue-owned rows only.
- Library templates not written.
- No invite / questionnaire / invoice / payment / contract / communication sends.
