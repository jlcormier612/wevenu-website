# Email consistency — Group C (portal polish + dual-tour)

| Item | Status |
|------|--------|
| D5 Portal participant invite (#28) | **GREEN / CLOSED** |
| Dual tour coordinator emails | **PENDING SANDBOX VERIFY** of single-email fix (tests green locally) |

## D5 — Portal participant invite (#28)

| Field | Value |
|-------|--------|
| Commit | `3fe94472f245480cdc3135e6120be009d1887ec2` |
| Serving at verify | `3fe94472f245480cdc3135e6120be009d1887ec2` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38655340809 |
| Root cause | Thin inline HTML bypassing `renderBrandedEmailHtml` |
| Correction | `lib/portal/participant-invite-email.ts` + route wiring |
| Tests | `lib/portal/participant-invite-email.test.ts` PASS |
| Render | `group-c-render-results.json` **allPass** |
| Browser | `group-c-browser-results.json` — **ALL PASS** (no sends) |

## Dual tour coordinator emails — product decision locked

**Decision:** One booking → **one** coordinator email via preference-gated `tour_scheduled` queue only.

| Field | Value |
|-------|--------|
| Root cause | Immediate `sendCoordinatorNotification` (`New tour booked — {date}`) raced the DB trigger → `create_venue_notification(tour_scheduled)` → `processVenueNotificationEmails` (`New tour scheduled — {name}`) |
| Correction | Remove `sendCoordinatorNotification` from `runTourBookedSideEffects`; keep reminders + `trackTourBooked` |
| Sole email path | `_trigger_tour_scheduled_notification` → `create_venue_notification` (respects `pref_tour_scheduled`) → `processVenueNotificationEmails` (idempotent via `emailed_at`) |
| Pref OFF | `create_venue_notification` returns without insert → no in-app row and no email (existing gate) |
| Pref ON | In-app row + `needs_email`; cron sends branded HTML once, then stamps `emailed_at` |
| Client emails | Unchanged (`sendTourScheduled` in `lib/tours/service.ts`) |
| Protection alert | Unchanged (`notifyPaidUnbookedTour` — unpaid/unbooked failure path) |
| Tests | `lib/tours/tour-coordinator-dual-notify.test.ts` (single-email contract) |

## Production / Resend / DNS

Untouched. No real customer sends.
