# Inbound reply attention / email notification — forensic

**Date:** 2026-10-14 (observation) · **Fix pass:** 2026-10-15  
**Production / Resend / DNS:** untouched  
**Application code:** Decisions A/B/C implemented (see STATUS)

## Exact reproduction (baseline — pre-fix)

| Field | Value |
|-------|--------|
| Venue | **Meadowbrook Valley Venue** `05f16a15-1752-4855-8a3b-aad5c593d8d9` |
| Lead | Rory Gilmore `09d26751-f184-461f-9cdb-8891b676cd61` |
| Conversation | `dcba7cbc-77d7-4707-ac0d-e615016c186f` |
| Inbound message | `07df6ca5-5bfe-4346-9b9a-77886eb75118` @ `2026-10-15T02:01:29.538Z` |
| After open | `venue_unread=0`, **`needs_response=true`** (~12s) |
| In-app notification | `101cc67d-…` · `message_received` · `needs_email=true` |
| Email log (pre-fix) | to **`venues.email`** · `emailed_at` ~28.6 min later · `delivered_at=null` |

## Root causes (confirmed)

1. **Recipient (A):** `processVenueNotificationEmails` sent every preference-gated venue email to **`venues.email` only**, not owner auth email (`venues.owner_user_id` → `auth.users`) or `leads.assigned_staff_id` → `venue_staff`. Meadowbrook’s `venues.email` equals the customer Gmail in this fixture — false-positive routing, not intended production model.
2. **Latency (B):** Eligible rows waited for cron `/api/notifications/process` (`*/30`). Inbound webhook created the notification but did not dispatch email.
3. **Lead attention (C):** Lead list/detail only had `venue_seen_at` “New/unseen”; already-seen leads with `needs_response` inbound had no distinct message-attention cue. Inbox unread≠needs_response is intentional and unchanged.

## Preference model (existing — not inventing)

- New Message email gate is **venue-level** `venue_notification_preferences.pref_message_received` (no per-person email prefs).
- `create_venue_notification` already sets `needs_email` from that pref.
- Decision A applies that gate to **eligible people** (owner + lead assignee), not to invent a parallel preference system. Opt-out = venue pref off → no email work.

## Minimal fix (implemented)

| Decision | Change |
|----------|--------|
| **A** | `lib/notifications/message-received-recipients.ts` + `message_received` branch in `processVenueNotificationEmails` — owner auth email + lead assignee; dedupe; never use `venues.email` as owner substitute; customer addresses not selected as internal recipients. Other notification types keep `venues.email`. |
| **B** | `dispatchPendingMessageReceivedEmails(venueId)` from inbound email + SMS routes after successful insert; cron remains catch-up. Per-recipient `notification_log` skip prevents duplicate sends on retry. |
| **C** | `LeadMessageAttentionIndicator` driven by `conversations.needs_response`; list + detail; link to lead Conversation; independent of `venue_seen_at` / `venue_unread`. |

## Files / functions

- `lib/notifications/message-received-recipients.ts` (+ test)
- `lib/notifications/obligation-engine.ts` — `dispatchMessageReceivedEmail`, `dispatchPendingMessageReceivedEmails`, scoped `processVenueNotificationEmails`
- `app/api/messaging/inbound/route.ts`, `app/api/messaging/sms-inbound/route.ts`
- `lib/leads/message-attention.ts` (+ test)
- `components/leads/lead-message-attention-indicator.tsx`
- `components/leads/lead-list.tsx`, `lead-detail.tsx`
- `app/(app)/leads/page.tsx`, `app/(app)/leads/[id]/page.tsx`

## Safe limitations

- No inventable owner/assignee email → skip + set `emailed_at` (same pattern as missing `venues.email`).
- Provider `status=sent` ≠ mailbox delivery (`delivered_at`).
- Sandbox `COMMUNICATION_MODE=sandbox` may redirect actual SMTP delivery; intended recipients are recorded on `notification_log.recipient_email`.
