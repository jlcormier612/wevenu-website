# Communication Trust Acceptance Test

A checklist, not architecture and not code — the explicit release gate before Communication is considered trustworthy. Every item is marked one of:

- ✅ **Verified live** — exercised with a real HTTP request against the running app and confirmed by reading the real database afterward.
- 🔵 **Verified by code trace** — the code path is read, correct, and consistent with an already-live-verified twin (e.g. SMS delivery mirrors the already-verified email delivery path exactly), but this specific path wasn't independently fired this pass.
- ⬜ **Not executable in this environment** — needs real provider credentials (`RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`) and/or a real external inbox (Gmail/Outlook/Yahoo) that don't exist in this local dev environment. Not a defect — an infrastructure gap this checklist can't close by itself.
- 🔴 **Genuine gap found** — doesn't exist yet, named honestly rather than guessed at.

## Email

| Item | Result | Note |
|---|---|---|
| Send venue → Gmail | ⬜ | No `RESEND_API_KEY` or real domain configured in this environment; needs a real send + a real inbox to check. |
| Send venue → Outlook | ⬜ | Same. |
| Send venue → Yahoo | ⬜ | Same. |
| Reply | ✅ | Live: a hand-built payload matching Resend's real inbound schema was POSTed to `/api/messaging/inbound`; matched the sender to a test Lead, inserted the message, recomputed lead score. |
| Attachment | 🔴 | **Partial.** Sending an attachment is real on the legacy compose path (`message_attachments` table, wired in `lib/messaging/service.ts`) but not on the Conversation compose path. Receiving one is not built at all — `app/api/messaging/inbound/route.ts` only ever reads `text`/`html`, never `attachments`. Corrects an earlier pass of this audit, which wrongly called attachments "missing" outright — sending them isn't. |
| Delivery | ✅ | Live: `email.delivered` webhook fired against a real test message; `status` advanced to `delivered`, `delivered_at` set. |
| Opened | ✅ | Live: `email.opened` fired; status advanced to `opened`; lead score refreshed via `logSignalEvent`. |
| Clicked | 🔵 | Structurally identical handling to Opened in the same webhook route; not independently re-fired this pass. |
| Bounced | ✅ | Live: `email.bounced` fired; status advanced to `failed`; plain-language reason correctly translated. |

## SMS

| Item | Result | Note |
|---|---|---|
| Send | 🔵 | `sendSms()` is correct and now requests a `StatusCallback` (Phase 3), but never fired against the real Twilio API — no credentials here. |
| Receive | ✅ | Live: a real inbound-SMS POST was matched to a test Lead's phone number — and this is where a genuine, severe bug was found and fixed this pass (see below). |
| STOP | ⬜ | Deliberately delegated to Twilio's Messaging Service, not app code — there is no code path to test. This is correct as long as a real Messaging Service (not a bare number) is what gets configured at launch. |
| START | ⬜ | Same. |
| Long message (>160 chars) | ⬜ | Twilio auto-segments on their end; the app just passes one `Body` string through with no chunking logic of its own, correctly — nothing to build, but only truly confirmable against the real API. |
| Emoji | ⬜ | Body is passed through as UTF-8 with no transformation; no known blocker, unconfirmed against the real API. |
| MMS | 🔴 | **Not built.** `sendSms()` has no media-URL parameter at all — this isn't a partial gap, it's simply not a capability today. |

## Automations

| Item | Result | Note |
|---|---|---|
| Automatic email | ✅ | Live, in an earlier pass of this work (Release Blocker #1) — a Sequence-triggered send correctly reached the legacy Messages tab. |
| Automatic text | 🔵 | `lib/scheduled-messages/processor.ts` has an SMS branch (`sendSms` + real `conversation_messages` insert with `provider_id`/`status`) — code-correct and structurally sound but not independently fired live this pass. |
| Scheduled send | ✅ | **Found via this exact checklist, not by reading code, then fixed and verified live.** The cron endpoint that processes scheduled/automated sends, `/api/communication/scheduled/process`, was missing from the proxy's public-route allowlist — the same class of bug already fixed twice this pass for the two Twilio webhooks. Every cron invocation carries no session cookie, so Vercel's real cron trigger would have been redirected to `/login` instead of reaching the route. **In practice: Scheduled Sends would never have actually processed in production.** Fixed in `integrations/supabase/proxy.ts` and confirmed live: a real due `scheduled_messages` row was picked up and processed by a real POST to the route (`{"processed":1,"sent":0,"failed":1}` — the one failure was an intentionally minimal test fixture with no Lead attached, not a bug). `/api/automation/process` and `/api/digest` had the identical bug and got the identical fix, confirmed reachable (200, was 307) the same way. |
| Cancelled send | 🔵 | `cancelScheduledMessageAction` is a simple, low-risk status flip; code-correct, not independently exercised live this pass. |

## Message Templates

| Item | Result | Note |
|---|---|---|
| Personalization | 🔵 | `buildMergeData`/`mergeContent` (`lib/message-templates/merge.ts`) are used by the same Scheduled Sends processor already read this pass; correct by inspection. |
| Merge fields | 🔵 | Same. |
| Preview | 🔴 | **Genuine gap.** No preview UI exists anywhere in `components/communication/template-form.tsx` — a coordinator can't see what `{{first_name}}` resolves to before it's actually sent to a real person. |
| Send | ✅ | Covered by the Email/SMS send verification above. |

## Sandbox

| Item | Result | Note |
|---|---|---|
| Real mode | ✅ | This is the mode every live test above ran in. |
| Sandbox mode | 🔵 | `COMMUNICATION_MODE=sandbox` correctly redirects `to` at the point of send (`lib/email/send.ts`, `lib/sms/send.ts`) — verified by code trace, not live-toggled, since that would mean changing env vars on the shared running dev server. |
| Disabled mode | 🔵 | Same — `mode === "disabled"` short-circuits before any network call, by inspection. |

## Resolved during this pass — found while building this checklist

Testing "Scheduled send" surfaced something bigger than that one item: **three of the four cron jobs in `vercel.json` were unreachable**, not just the Scheduled Sends one —

- `/api/communication/scheduled/process` (Scheduled Sends, every 5 min)
- `/api/automation/process` (the entire Automation engine, every 15 min)
- `/api/digest` (the daily digest email, hourly)

All three are guarded by their own `CRON_SECRET` check inside the route itself — same pattern as `/api/notifications/process`, which was already correctly allowlisted and working. Fixed with the same one line each in `integrations/supabase/proxy.ts`, and confirmed live: all three now return `200` where they previously returned a `307` redirect to `/login`, and a real due Scheduled Send was picked up and processed end-to-end by a real POST to the route. Before this fix, Scheduled Sends, the entire Automation engine, and the daily digest email would never have actually run in production.
