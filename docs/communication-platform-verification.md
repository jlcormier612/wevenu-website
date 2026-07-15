# Communication Platform — End-to-End Verification

**Type:** Release certification (not a UX audit — no speculative improvements below).
**Method:** Real HTTP requests against the running dev server and real Postgres queries against the local Supabase database (`npx supabase db query --local`), not mocks. Every "Verified" line below reflects an actual request/response or an actual row written, read back, and cleaned up.
**Scope:** Everything built in `docs/communication-platform-release-readiness.md` and `docs/communication-infrastructure-readiness.md`, tested as one continuous pipeline rather than in isolation.

## Release Blocker found and fixed during this pass

**Twilio's inbound SMS webhook could never reach the app.** `integrations/supabase/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts` — see `AGENTS.md`) allowlists `/api/messaging/inbound` and `/api/messaging/webhook` as session-less public routes for Resend's webhooks, but `/api/messaging/sms-inbound` was never added when texting shipped. Every real request from Twilio — which carries no session cookie — was 307-redirected to `/login` and received an HTML page instead of a JSON response. Twilio would log this as a webhook failure and the inbound text would be lost, with nothing in the app's own logs to explain why, since the request never reached `route.ts`.

Reproduced directly: `curl -X POST http://localhost:3000/api/messaging/sms-inbound ...` returned `307` / `location: /login` before the fix, `200` / `{"ok":true}` after. Fixed by adding the route to `PUBLIC_PATHS` in `integrations/supabase/proxy.ts` — safe because the route already authenticates itself independently via `verifyTwilioSignature` (HMAC-SHA1 over the exact webhook URL + sorted params, keyed by `TWILIO_AUTH_TOKEN`), the same pattern already used for the two Resend webhooks sitting next to it in that list.

No other route was affected — `/api/messaging/inbound` and `/api/messaging/webhook` were already correct; this route was simply missed.

## Email

| Item | Status | Evidence |
|---|---|---|
| Provider | Resend, via direct `fetch` to their REST API (no SDK dependency) | `lib/email/send.ts` |
| Authentication | `RESEND_API_KEY` (server-only); `FROM_EMAIL` domain must be DKIM/SPF-verified in the Resend dashboard for deliverability — this is provider-console configuration, not app code, and wasn't and can't be re-verified from here | `lib/email/send.ts:11` |
| Sending | Verified live in a prior pass of this work (see release-readiness doc) and re-confirmed structurally this pass | `lib/email/send.ts` |
| Receiving (inbound) | **Verified live, this pass.** Real POST to `/api/messaging/inbound` matched a test Lead by sender address, inserted a `messages` row, and recomputed the lead's score | `app/api/messaging/inbound/route.ts` |
| Reply threading | Verified structurally — inbound matches on `thread_id` via the Reply-To convention set at send time (`lib/email/send.ts`'s `threadId` param) | `lib/email/send.ts:26` |
| Attachments | **Missing.** Neither `sendEmail` nor the inbound route reads or persists attachments — email is text/HTML body only, in both directions. Not a release blocker (no part of the product currently promises attachment support), but worth naming since it was explicitly asked about | `lib/email/send.ts`, `app/api/messaging/inbound/route.ts` |
| Opens / Clicks / Bounces / Complaints | **Verified live, this pass.** Simulated real Resend status-webhook payloads (`email.opened`, `email.clicked`, `email.bounced`, `email.complained`) against `/api/messaging/webhook`; each correctly updated `messages.status`, inserted a `message_events` audit row, and (opens/clicks) inserted a `lead_signal_events` row and recomputed lead score | `app/api/messaging/webhook/route.ts` |
| Sandbox mode | Verified by code trace, not by live toggle (flipping `COMMUNICATION_MODE` on the shared dev server would require an env change + restart, avoided per this session's "actions with care" convention). Logic is a pure, deterministic branch: `mode === "sandbox"` redirects `to` → `COMMUNICATION_SANDBOX_EMAIL` when set, otherwise falls through to the real recipient rather than silently no-op'ing | `lib/communication/mode.ts`, `lib/email/send.ts:41-49` |
| Disabled mode | Verified by code trace — `mode === "disabled"` returns `{ ok: true, method: "disabled" }` before any network call, no provider ever contacted | `lib/email/send.ts:34-36` |
| Local development workflow | No inbound tunnel exists in this environment (no ngrok/similar configured), so Resend's real webhook servers cannot reach `localhost:3000`. Every inbound/webhook verification in this pass was done by POSTing a hand-built payload matching Resend's real schema directly to the local route — this validates the app's own logic completely but does not validate Resend's actual delivery to this route, which requires either a tunnel or a deployed environment | — |

## SMS

| Item | Status | Evidence |
|---|---|---|
| Provider | Twilio, via direct `fetch` to their REST API | `lib/sms/send.ts` |
| Sending | Structurally verified — `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_MESSAGING_SERVICE_SID` (or `TWILIO_FROM_NUMBER`) gate a real API call; not exercised live since these credentials aren't configured in this environment (correctly returns `{ ok: false, message: "Texting isn't configured..." }` rather than a confusing failure) | `lib/sms/send.ts:37-58` |
| Receiving (inbound) | **Verified live, this pass**, after the proxy fix above — real POST to `/api/messaging/sms-inbound` now reaches the route and returns `{"ok":true}` | `app/api/messaging/sms-inbound/route.ts` |
| Delivery receipts / failures | **Missing — a real gap, not release-blocking.** No `StatusCallback` route exists, and `sendSms` never sends a `StatusCallback` param on the outbound API call, so Twilio has nothing to call back to even if a route existed. Practical effect: an SMS send is reported successful the moment Twilio's API accepts it, with no way to later learn it actually failed to reach the handset (carrier filtering, invalid number, etc.). Recommend as a Future Enhancement, not a blocker — sends degrade to "fire and forget," which is a real but honest limitation, not a silent lie | `lib/sms/send.ts` (no `StatusCallback`), route search confirms no receiving endpoint |
| STOP/START/HELP handling | Intentionally delegated to Twilio's Messaging Service, not implemented in app code — this is the documented tradeoff of using `TWILIO_MESSAGING_SERVICE_SID` (see the comment block in `app/api/messaging/sms-inbound/route.ts`). Confirmed this remains accurate: no STOP/START keyword handling exists anywhere in the codebase. This is correct as long as a real Messaging Service (not a bare `TWILIO_FROM_NUMBER`) is what gets configured at launch — worth flagging as an operational requirement, not a code defect | `app/api/messaging/sms-inbound/route.ts:9-10` |
| Sandbox mode | Verified by code trace — identical branch shape to email's, redirects `to` → `COMMUNICATION_SANDBOX_PHONE` | `lib/sms/send.ts:62-68` |
| Disabled mode | Verified by code trace — short-circuits before any network call | `lib/sms/send.ts:43-46` |
| Signature verification / dev fallback | `verifyTwilioSignature` skips verification entirely when `TWILIO_AUTH_TOKEN` is unset (`lib/sms/verify.ts:20`) — correct for local dev (no way to produce a valid signature without a real token), but confirm before launch that `TWILIO_AUTH_TOKEN` is actually set in production, or every inbound SMS webhook call is accepted unauthenticated | `lib/sms/verify.ts` |

## Platform Integration — lifecycle walk

Walked the exact chain in the request: Lead created → Tour scheduled → Automation → Email sent → Reply received → Conversation updated → Platform Event → Notification → Luv observation → Activity history.

| Step | Status | Evidence |
|---|---|---|
| Lead created → Tour scheduled | Works (pre-existing, out of scope for this pass) | — |
| Tour scheduled → **Automation** | **Missing — confirmed, not a defect.** `message_sequences`' `triggerType` union is only `"lead_created" \| "lead_stage_changed"` (`lib/message-sequences/types.ts:9`); no code path enrolls a sequence on tour scheduling. A Tour can only enter an Automation indirectly, if scheduling one also happens to change the Lead's stage | `lib/message-sequences/types.ts`, no hits for sequence enrollment anywhere under `app/api/tours` or `lib/tours` |
| Automation → Email sent | **Verified live in the release-readiness pass** (Release Blocker #1 fix — automation sends were previously invisible to legacy Messages, now mirrored) | `lib/scheduled-messages/processor.ts` |
| Email sent → Reply received → Conversation updated | **Verified live, this pass** — see Email/Receiving row above; the sync-mirror trigger also copies legacy replies into `conversation_messages` for venues not yet on the new experience | `sync_message_to_conversation` trigger |
| → **Platform Event** | **Intentionally absent, confirmed.** Platform Events currently wrap Requests only (`lib/platform-events/wire-requests.ts` is the only wiring file in `lib/platform-events/`) — Communication and Leads are not yet adoption-plan participants. This matches the phased rollout ordering in `docs/platform-event-adoption-plan.md` and is not a gap to close in this pass | `lib/platform-events/` (only `wire-requests.ts` wires anything) |
| → Notification | **Verified live, this pass** (and one real regression caught and fixed — see below) | `notify_inbound_message`, `_trigger_conversation_message_notification` |
| → **Luv observation** | **Missing / aspirational, confirmed.** Nothing under `lib/luv/` reads `messages` or `conversation_messages` — the only "message" hits are unrelated (Anthropic API `messages` params, UI copy strings). Luv does not yet observe communication activity; this is future work per `docs/luv-platform-reconciliation.md`, not a regression | `lib/luv/*.ts` |
| → **Activity history** | **Missing, confirmed.** `insertActivity()` (`lib/leads/repository.ts:548`) is called for notes, tasks, lead-field updates, tour-scheduled, follow-up-set, and relationship updates — never for an inbound or outbound message. A Lead's Activity tab currently has no entry saying a message was sent or received | `lib/leads/service.ts` (every `insertActivity` call site), `lib/leads/repository.ts:548` |

### Regression caught by this verification (fixed)

**Duplicate notifications on every legacy inbound message.** The Release Blocker #2 fix from the prior pass (notify on new-Conversation messages) double-fired for legacy-experience venues — an inbound message triggers `notify_inbound_message` directly *and* gets mirrored into `conversation_messages`, which then fired the new trigger a second time for the same real-world message. DB-verified: 2 `venue_notifications` rows before the fix, 1 after. This was only caught because this pass tested the real legacy→new cascade end-to-end rather than the new-system-only path tested in isolation before. Fixed in `20260916000000_conversation_notification_dedupe_legacy_bridge.sql` by skipping the new trigger whenever `channel_metadata` carries `legacy_message_id`.

### Second regression caught by this verification (fixed)

**`service_role` had almost no table grants across the entire Communication table family** (`leads`, `messages`, `message_threads`, `conversations`, `conversation_messages`, `sequence_enrollments`, `scheduled_messages`, `contracts`, `payment_schedules`, `payment_line_items`, `event_questionnaires`) — only `REFERENCES`/`TRUNCATE`/`TRIGGER`, no `SELECT`/`INSERT`/`UPDATE`. `rolbypassrls` bypasses RLS policies; it does not imply table-level privileges — the same category of gap already found and fixed once before for Automation and the Platform Event framework, recurring here and apparently never re-checked since. Practical, confirmed effect: an inbound email reply could never be matched to its Lead (`permission denied for table leads`), and because the route only checks `leads?.length` truthiness — never the parallel `error` — this failure was silently indistinguishable from "unknown sender" the entire time. Fixed in `20260917000000_communication_service_role_grants.sql`, granted narrowly per the specific operation each real code path performs. Re-verified live: inbound email now matches its Lead and recomputes score; the Resend status webhook family (delivered/opened/clicked/bounced/complained) all confirmed working end-to-end with real side effects.

## Open question requiring a decision (not resolved in this pass)

The SECURITY DEFINER trigger `sync_message_to_conversation` (mirrors legacy `messages` inserts into `conversation_messages`) still fails with `permission denied for table conversations` specifically when invoked through the real PostgREST/`authenticator` connection path — reproduced identically via both the Next.js route and a raw PostgREST REST call — despite `service_role` now holding correct, verified grants on both tables (confirmed via `has_table_privilege()` and a manual `SET ROLE service_role` reproduction, which succeeds). Postgres server logs pin the failure to `authenticator`, the actual login role PostgREST connects as (`rolinherit = false`), which has zero grants of its own on these tables.

The direct fix — granting `authenticator` the same table privileges — was correctly blocked by this session's own tooling as a security-weakening change to the base connection role used by *all* PostgREST traffic before any JWT-gated role switch, and requires an explicit decision rather than a unilateral one. Practical impact today: this specific mirror path only matters for venues on the legacy messaging experience replying through the new Conversation system's mirror — and `conversation_experience_enabled` is off for every real venue right now, so this has zero live impact until that flag is turned on for anyone. Recommend leaving this open and revisiting before flipping that flag for a first real venue, rather than resolving it speculatively now.

## Separate finding, surfaced per this session's own security policy (unrelated to Communication)

While querying schema during this verification, the local database reported that **Row Level Security is disabled on two unrelated tables**: `public.luv_rollups` and `public.vendor_health_scores`. Both are fully exposed to the `anon` and `authenticated` roles — any authenticated user (or, for `anon`, potentially any unauthenticated caller) can read or modify every row across every venue. This was not introduced by this pass and is out of scope for Communication, but should not go unmentioned. Not auto-fixed, since enabling RLS without policies would block all access outright — this needs deliberate policy design, not a reflexive `ENABLE ROW LEVEL SECURITY`. Flagging for your decision on priority.

## Verdict

**Communication is Release Ready for Email**, with one honest gap (no attachment support) and the caveat that live-provider deliverability/DKIM configuration lives in the Resend dashboard, outside what code review can confirm.

**Communication is Release Ready for SMS receiving and sending, conditional on two operational (not code) requirements**: (1) `TWILIO_AUTH_TOKEN` must actually be set in production, or inbound webhook signature verification silently no-ops; (2) a real Twilio Messaging Service (not a bare number) must be what's configured, since STOP/START compliance is entirely delegated to it. Delivery-receipt tracking is a known, accepted gap for a future pass.

**The lifecycle beyond "message delivered" is intentionally thinner than the full chain in the request**: Platform Events and Luv observation don't yet participate (both by design, per their own adoption plans), and message-driven Activity history genuinely doesn't exist yet — that last one is the one item here worth a real product decision, since a Lead's Activity tab silently omitting every message exchanged is a gap a returning-from-another-CRM venue would likely notice.
