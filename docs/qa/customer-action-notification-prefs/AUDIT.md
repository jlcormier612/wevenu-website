# Customer-action email notification preferences — AUDIT

**Date:** 2026-09-23  
**Production:** untouched

## Existing architecture (reuse)

| Piece | Location |
|---|---|
| Preference storage | `venue_notification_preferences` |
| Gate | `create_venue_notification()` CASE → pref column; OFF = no insert |
| Email dispatch | `venue_notifications.needs_email` → `processVenueNotificationEmails()` cron |
| Email subject/body | `title` / `body` on the notification row |
| UI | `NotificationPreferencesSection` “Leads & clients” |
| Persist API | `POST /api/notifications/preferences` → `update_notification_preferences` |

## Canonical event paths found

| Preference | Canonical event | Already notified? |
|---|---|---|
| Tour scheduled | `AFTER INSERT` on `tour_appointments` (`notify_tour_scheduled`) via `book_tour` / `book_tour_for_lead` | Yes — ungated (`else true`) |
| Tour confirmed | `scheduled → confirmed` (`confirm_tour_by_token` prospect_link **or** `updateTourStatus` manual) | **No** — activity only |
| Proposal accepted | `accept_commercial_selection` / `approve_commercial_proposal` after transition | Yes — ungated |

## Not the trigger

- Tour form view / availability check / confirmation **request** send (`confirmation_requested_at` only)
- Proposal create / edit / send / view / package select (`proposal_selected` is a separate type)
- Staff lifecycle / Booked / payment / contract

## Idempotency already present

- `confirm_tour_by_token`: `alreadyConfirmed` early return under row lock
- Status UPDATE trigger only fires when OLD ≠ confirmed and NEW = confirmed
- `accept_commercial_selection` / `approve_commercial_proposal`: early return when already accepted/approved

## Gap closed by this work

1. Add `pref_tour_scheduled`, `pref_tour_confirmed`, `pref_proposal_accepted` (default ON)
2. Gate the three types in `create_venue_notification`
3. Add `notify_tour_confirmed` on status transition
4. Subject copy: `New tour scheduled — [Name]`, `Tour confirmed — [Name]`, `Proposal accepted — [Name]`
5. UI rows + API + TS defaults
