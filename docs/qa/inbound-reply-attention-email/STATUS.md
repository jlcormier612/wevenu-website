# Inbound reply attention / email notification — STATUS

**STATUS:** NOT GREEN / BLOCKED — awaiting exact serving SHA browser proof  
**Date:** 2026-10-15  
**Implementation commit:** `149b7f5fda1857b696de5fa1e91350bb5521cc0b`  
**Sandbox deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38674625261 (in progress at status write)  
**Production / Resend / DNS:** untouched  

## Root causes (confirmed)

1. **A — Recipients:** `processVenueNotificationEmails` used `venues.email` only.
2. **B — Latency:** Inbound webhook enqueued `needs_email` but waited for `*/30` cron (~28.6 min).
3. **C — Lead attention:** No distinct cue for `needs_response` when `venue_seen_at` already set.
4. Inbox unread≠needs_response is intentional (not a defect).

## Exact behavior implemented

- **A:** Owner via `owner_user_id` → auth email; lead assignee via `assigned_staff_id` → staff/auth email; venue-level `pref_message_received`; dedupe; never invent from `venues.email`/customer fields alone.
- **B:** `dispatchPendingMessageReceivedEmails` from inbound email + SMS routes; cron catch-up; per-recipient log skip for idempotency.
- **C:** `LeadMessageAttentionIndicator` from `conversations.needs_response` on list + detail.

## Recipient + dispatch proof (Sandbox DB, local dispatcher on commit code)

See `recipient-resolution-proof.json`, `dispatch-proof.json`.

| Check | Result |
|-------|--------|
| Owner `jlcormier612@gmail.com` (auth) included | PASS |
| Assignee Ellie `jyagnesak@yahoo.com` included | PASS |
| Both eligible → both logged | PASS (`3d848f25-…`, `4f099f9f-…`) |
| Owner=assignee dedupe | PASS (unit) |
| Pref off → empty | PASS (unit) |
| Customer alone / venues.email alone → empty | PASS |
| Unassigned staff excluded | PASS (only owner+Ellie; Meadowbrook has 2 staff) |
| Same-address fixture (owner=customer Gmail) | Owner via ownership, not customer field |
| Insert→dispatch elapsed | **~1991 ms** (notif `e5c7720e-…`, msg `bdd0b33b-…`) |
| Redispatch no duplicate logs | PASS (2→2) |
| `status=sent`, `delivered_at=null` | PASS — delivery not claimed |
| Lead attention with `venue_seen_at` set | PASS (map → conv `dcba7cbc-…`) |
| `needs_response=true` after insert | PASS |

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

**71/71 PASS**

## Remaining blocker (exact-runtime)

1. Deploy `149b7f5f` must reach sole RUNNING venue-app (task def / image SHA).
2. Run `EXPECTED_SHA=149b7f5f… npx tsx scripts/qa/inbound-reply-attention-verify.mts` for browser Message indicator + open-clears-unread-keeps-needs_response on that SHA.
3. Confirm webhook path on serving runtime (inbound route contains prompt dispatch) — dispatcher timing already proven against Sandbox DB.

Until (1)–(2) pass: **NOT GREEN**.
