# Multi-day booking summary + task waiver + questionnaire selectors

**Status:** GREEN — Sandbox serving tip verified with 390/1280 browser proof

| Field | Value |
|---|---|
| Feature commit | `d1531f9e823b702f87262552928116ed4547d827` |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/38301712810 (rerun of failed venue-app prefetch; success) |
| Serving tip | `d1531f9e823b702f87262552928116ed4547d827` (`dpl=` match) |
| Browser script | `scripts/qa/multi-day-summary-tasks-questionnaires-browser.mts` |
| Evidence | `docs/qa/multi-day-summary-tasks-questionnaires/` |
| QA event | Ellie `ef980240-359a-439b-a731-5ef80d1f1471` / client `406d7558-8293-43c3-802d-f2ad6fd6913c` (Meadowbrook) |

## Root causes

1. **Event summary** — space-assignment load/save omitted `scheduledDate`; hero card showed one Overall window from `event.startTime`/`endTime`.
2. **Task waiver** — readiness counted waived inside `completedRequired` and UI labeled it “complete”; waived rows still offered Complete.
3. **Questionnaire selectors** — Library starters only ensured on Library page; Base UI `SelectValue` fell back to raw UUID without a name formatter.

## Runtime proof (serving `d1531f9e`)

- Summary shows Fri Sep 3 Rehearsal Dinner 5–10 PM · Meadowbrook Barn and Sat Sep 4 Getting Ready / Cocktail / Ceremony / Reception with distinct times/spaces — no Overall 2:00 PM–10:00 PM.
- Persists after reload; same at 390px.
- Task list counts reconcile (`listed=total`); after waive: `0 completed · 1 waived of 6 required` (waive restored after proof).
- All three questionnaire templates selectable with human labels before any send.
- Setup Profile includes Vendors; vendor-directory default copy verified on edit form.

## Automated

Focused suites green: booking-summary, space-assignments scheduledDate, task-waiver-counts, questionnaire selector-availability, setup-profile readiness-detail, booking-workspace slices.

## Notes

- First deploy attempt failed venue-app ECR public rate limit (`toomanyrequests`); failed-job rerun succeeded.
- Rehearsal `scheduled_date` was null in DB; seeded to `2027-09-03` (matching event start / hold day) so persisted distinction is visible — times were already saved; summary no longer invents wedding-day hours for rehearsal.
