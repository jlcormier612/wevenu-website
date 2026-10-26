# Implementation decisions

## Scope choice

**UX + contract hardening on existing fields.** No migration. No bulk rewrite of venue templates or event timelines.

## Why not named ceremony milestones

The only resolvable anchor in code today is `events.start_time`. Adding item-to-item or ceremony anchors needs new columns and apply logic. The brief forbids inventing those times. Relative UI therefore names **Day-of schedule start** explicitly; ceremony-like moments use **specific clock time**.

## Changes

1. **`resolveEntryTimeFromOffset`** — return `null` when `startTime` is missing (remove noon invent).
2. **`lib/timeline/timing-presentation.ts`** — shared labels, relative phrase formatting, mode helpers, template day labels.
3. **Template item editor** — timing mode (Specific / Relative to Day-of schedule start / None); plain-language relative controls; dual-legacy warning; clearer day labels.
4. **Event Timeline Setup editor** — pass `eventDate` / `eventEndDate`; replace “Day offset” with day selector from `timelineDayOptions`; short baked-time note.
5. **Tests + browser harness** under this QA folder for scenarios A–G (focused).

## Preserved

- Apply bake behavior when start is known.
- `time_of_day` precedence.
- Reapply replaces venue-owned only.
- Starters still ship with null times.
- Working Timeline entry form day picker (already correct).
- TL-03 presentation aliases unchanged.

## Rollback

Revert the tip; no data migration to undo. Rows saved under the new UI still use the same columns.
