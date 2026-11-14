# Tour Scheduling — Safe, Forgiving Status Actions

**Branch:** `fix/tour-outcome-actions`  
**Base:** `origin/main` @ `7a6c2dfd` (PR #68 Tour button chrome)  
**Status:** STOP before merge/deployment — pre-merge corrections applied (Actually occurred + metadata clearing). Production untouched.

## Existing lifecycle (unchanged architecture)

| Capability | Storage / path |
|------------|----------------|
| Status | `tour_appointments.status` — `scheduled` \| `confirmed` \| `completed` \| `cancelled` \| `no_show` |
| Completion clock | `completed_at`, optional `actual_occurred_at` (never overwrites `scheduled_at`) |
| Cancel note | `cancellation_reason` |
| Staff notes | `tour_appointments.notes` (venue-only; not couple-facing) |
| Mutations | `updateTourStatus` in `lib/tours/service.ts` → Lead action + Tours PATCH |
| Side effects | Post-tour automation, signals, confirmation email on **confirmed** |

## What changed

Presentation/behavior only on the Lead Tour card. **PR #68 button heights, padding, fonts, gaps, and Refer a Venue were not modified** (hover/focus tokens added without changing dimensions).

1. **No Show / Completed / Cancel** open confirmation dialogs with exact copy, optional 500-char note, and Keep Scheduled / Keep Tour dismissals.
2. **Completed** restores optional **Actually occurred** date/time (prefill via `prefillActualFromScheduled`; both required together; never rewrites `scheduled_at`).
3. Terminal tours show a compact outcome line + note + **Edit outcome** / **Schedule another tour** (opens existing schedule sheet; does not overwrite history).
4. **Edit outcome** can set Scheduled / Completed / No Show / Cancelled with note via `staffCorrection: true` — status/note update **without** customer emails or post-tour enrollment.
5. Corrections away from Completed clear `completed_at` + `actual_occurred_at`; away from Cancelled clear `cancellation_reason` (notes may remain).
6. No-show toast includes real **Undo** (restores prior scheduled/confirmed via staffCorrection).

## Files

- `components/leads/tour-panel.tsx`
- `lib/tours/service.ts` (`notes`, `staffCorrection`)
- `app/(app)/leads/[id]/actions.ts`
- `lib/tours/types.ts` (`updatedAt`)
- `app/globals.css` (hover/focus + outcome links only)
- `lib/tours/tour-outcome-actions.test.ts`
- `lib/leads/tour-followup-card-layout.test.ts` (active-row assertion update)

## Missing backend capability

None requiring migration. Notes use existing `notes` / `cancellation_reason`. Quiet correction uses a flag on the existing updater.

## Focused tests

```
npx tsx --test \
  lib/tours/tour-outcome-actions.test.ts \
  lib/leads/tour-followup-card-layout.test.ts \
  lib/tours/occurrence-clock.test.ts \
  lib/tours/occupancy.test.ts
```

Focused suite including Actually occurred + metadata-clear assertions: pass (see latest run).

## Sandbox screenshots

Real Sandbox captures of the new dialogs require deploying this SHA after review approval (Sandbox-from-main). Not deployed in this stop.

## Boundaries

- No Floor Plans / Guest Seating / Refer a Venue changes
- No curated demo edits
- No Production
- No migrations
