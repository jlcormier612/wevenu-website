# Inbound reply attention / email notification — STATUS

**STATUS:** IMPLEMENTATION COMMITTED — awaiting exact Sandbox runtime proof  
**Date:** 2026-10-15  
**Production / Resend / DNS:** untouched  

## Root causes

1. `message_received` emails went only to `venues.email` (~28.6 min via cron).
2. No lead-level message attention distinct from `venue_seen_at`.
3. Inbox unread≠needs_response is intentional (not a defect).

## Fix (Decisions A/B/C)

- Recipients: owner auth email + lead assignee; venue-level `pref_message_received`; dedupe; no customer-as-internal-recipient; no invent.
- Prompt dispatch from inbound email/SMS via shared `processVenueNotificationEmails` path.
- Lead Message indicator from `conversations.needs_response`.

## Tests

```
npx tsx --test lib/notifications/message-received-recipients.test.ts \
  lib/leads/message-attention.test.ts \
  lib/notifications/venue-notification-email.test.ts \
  lib/tours/tour-coordinator-dual-notify.test.ts \
  lib/conversations/inbox-needs-response.test.ts \
  lib/leads/lead-unseen-indicator.test.ts \
  lib/notifications/preference-matrix.test.ts
```

**Result:** 71/71 PASS (local).

## Deploy / runtime proof

Pending — fill after Sandbox deploy of this commit.

## Evidence

- `FORENSIC.md`
- `db-evidence.json` (baseline)
