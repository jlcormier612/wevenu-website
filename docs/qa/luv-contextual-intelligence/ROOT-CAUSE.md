# Root cause — Luv contextual intelligence failures

Serving baseline at audit start: `bf7875a6…` (digest `sha256:79fe0d55…`). Merge-lead deploy `5c7fc274` was in flight separately.

## Failure A — Redundant overdue-task interruption

**Path:** Dashboard Today's Focus (Tasks domain from overdue `lead_tasks`) → `selectLuvDashboardEntry` → `aggregateFocusEntry` → Luv card.

**Cause:** `lib/dashboard-system/luv-entry.ts` `DOMAIN_AGGREGATE.Tasks` produced  
`I noticed N tasks are past due.` + `Want to clear them?` whenever Tasks dominated Focus and no other L1 observation won.

Today's Focus already lists those overdue tasks with lead names. Leads were already excluded from this aggregate for the same “do not restate Focus” reason; Tasks were not. Luv received only an aggregate count, not a prioritized next step, and offered only `/tasks` — no useful interpretation beyond the list the owner already sees.

**Fix:** Omit Tasks from `DOMAIN_AGGREGATE` (same policy as Leads). Silence when Focus is Tasks-only unless a distinct live Level-1 observation exists.

## Failure B — False “all set” for unconfirmed tour

**Path:** `tour_appointments` (status `scheduled`) → `getLuvObservations` → `buildTourAllSetObservation` → lead Luv panel.

**Cause:** `buildTourAllSetObservation` gated on `isAuthoritativeTourScheduled`, which treats **both** `scheduled` and `confirmed` as eligible for  
`{couple} are all set for {weekday}. Good luck!`.

That confuses occupancy (a tour exists on the calendar) with confirmation (authoritative `status === "confirmed"`). UI correctly still offered “Send Confirmation Request” / “Mark as Confirmed” for `scheduled`, while Luv claimed the couple was all set.

`isAuthoritativeTourConfirmed` already existed and was unused by the all-set builder.

**Fix:** All-set requires `isAuthoritativeTourConfirmed`. Scheduled tours use `buildTourScheduledUnconfirmedObservation` (accurate language; confirmation-request ≠ recipient confirmed). Dispatcher: `buildUpcomingTourStatusObservation`. Query now selects `confirmation_requested_at`.

## Shared vs separate

Same product theme (facts before confidence) but **two seams**: Focus aggregate (dashboard L1) vs tour observation builder (lead context). Separate minimal fixes; shared regression suite under `lib/luv/contextual-intelligence-factuality.test.ts`.
