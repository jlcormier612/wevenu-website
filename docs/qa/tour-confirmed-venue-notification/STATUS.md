# Tour confirmed venue notification — prefs gate email only

**Date:** 2026-10-16  
**Status:** IMPLEMENTING → verify after Sandbox migration `202614190` + deploy

## Product contract (locked)

Settings copy (`app/(app)/settings/communications/page.tsx`):

> These are optional extras — your important activity and alerts will still appear in Hello to Cheers.

**Intended:** Notification preferences control optional **email** (`needs_email` → `processVenueNotificationEmails`). They must **not** suppress in-app `venue_notifications` rows.

## Forensic root cause (prior audit)

`create_venue_notification` early-returned when the per-type preference was OFF, so no in-app row was inserted. Meadowbrook `pref_tour_confirmed=false` therefore hid Tour confirmed from the bell while customer confirm email still worked.

Evidence: `runtime-probe.json`, `prefs-and-history.json`, `rpc-confirm-probe.json`, `trigger-probe.json`.

## Shared defect scope

Affects **every** preference-gated type in `create_venue_notification` (not only `tour_confirmed`): new_lead, message_received, tour_scheduled, tour_confirmed, proposal_accepted, payments, contracts, etc. RSVP / task-completed remain gated the same way (no Settings UI rows, but same function).

## Fix

| Change | Purpose |
|---|---|
| `supabase/migrations/20261419000000_venue_notification_prefs_email_only.sql` | Always insert in-app row; set `needs_email` from preference CASE |
| Focused tests | `lib/notifications/venue-notification-email-pref-contract.test.ts` + matrix / customer-action / tour-coordinator updates |
| Prove script | OFF cases expect in-app + `needs_email=false` |

No Settings copy change. No new controls. Gina prefs/tour/lead untouched by the fix.

## Verification checklist

- [ ] Focused unit tests PASS
- [ ] Migration `202614190` applied on Sandbox
- [ ] Serving commit includes migration + tests
- [ ] Runtime: Meadowbrook pref OFF → in-app `tour_confirmed` with `needs_email=false`
- [ ] Runtime: Fancy pref ON → in-app with `needs_email=true` (no real staff email send)
- [ ] Gina records unchanged
- [ ] Ledger updated
