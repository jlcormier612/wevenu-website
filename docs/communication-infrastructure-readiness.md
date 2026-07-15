# Communication Infrastructure & Deliverability — Readiness Audit

**Status:** Audit complete. This document answers the questions named explicitly in the commissioning request — provider architecture, outbound/inbound pipeline, webhook handling, delivery status, conversation threading, attachment handling, testing strategy, sandbox vs. production, local development workflow — before any Communication UX polish is attempted. Per explicit instruction, this document does not assume the existing infrastructure is sufficient; every claim below is verified against live code, not the platform's own prior comments about itself.
**Relationship to `docs/communication-platform-release-readiness.md`:** that document audits the *product* (conversation model, ownership, lifecycle, UX). This document audits the *plumbing* underneath it — the part that talks to Resend and Twilio, the real world, and can fail in ways a database transaction cannot.
**Method:** every provider claim below is read directly from `lib/email/send.ts`, `lib/sms/send.ts`, and the live webhook route handlers — not inferred from a docstring. Where a docstring's own claim was checked against the actual implementation and found accurate, that's stated; nothing here repeats a comment uncritically.

---

## Executive summary — what surprised this audit most

Communication infrastructure here is **considerably more built than a typical pre-launch platform** — real providers, real signed webhooks, real inbound routing, a real cron-driven outbound queue. It is not, however, safely testable end-to-end without touching real Resend/Twilio infrastructure, and it has exactly one structural gap serious enough to block a confident multi-venue launch: **there is no per-venue sending identity** — every venue on the platform sends from the same single `FROM_EMAIL`/Twilio number today. Everything else named below is a real, bounded gap, not a foundational one.

---

## 1. Email

**Which provider? Resend — confirmed, not a decision this document reopens.** `lib/email/send.ts` calls `https://api.resend.com/emails` directly via `fetch`, no SDK dependency (a deliberate pattern, matching how Twilio is called — see §2). This is a settled architectural choice already in production code, not an open question.

**Can we swap providers?** Not without touching `lib/email/send.ts` and `app/api/messaging/webhook/route.ts` directly — there is no `EmailProvider` abstraction/interface today; Resend's request/response shape (`from`/`to`/`text`/`html`/`open_tracking`/`click_tracking`) is inlined into the send function, and the webhook route's payload type (`ResendWebhookPayload`) is Resend-specific. Swapping providers today means rewriting both files, not implementing a new adapter behind an existing interface. Recommended, not implemented in this pass (§7).

**Credentials:** `RESEND_API_KEY`, `FROM_EMAIL`, `RESEND_INBOUND_ADDRESS`, `RESEND_WEBHOOK_SECRET` — all server-only env vars (confirmed never referenced from client-accessible code, consistent with `lib/env.ts`'s own stated discipline), all documented in `.env.example` with setup instructions.

**Sandbox vs. Production:** Implicit, not explicit. There is no `EMAIL_MODE=sandbox|real|disabled` switch anywhere in the codebase (confirmed by grep — no match for any sandbox/dev-mode concept). What exists instead: `sendEmail` checks `if (apiKey)` — unset `RESEND_API_KEY` silently falls back to generating a `mailto:` URL rather than sending. This is a real, working degraded mode, but it is an *absence-of-configuration* behavior, not a *deliberate, visible, switchable* mode a developer or venue owner chooses. A developer with a real `RESEND_API_KEY` in `.env.local` (needed to test delivery/webhooks at all) has no way to also prevent that key from sending to a real inbox — the only sandbox is "don't configure the key," which also prevents testing anything past the send call.

**Can we send real mail? Yes**, confirmed working code path, real API call, real response handling.

**Can we receive mail? Yes** — `app/api/messaging/inbound/route.ts`, real Resend Inbound routing, three-tier thread matching (subaddressing → In-Reply-To header → sender-email lookup), confirmed writing real rows.

**Bounce handling: Yes, partial.** `email.bounced` → `messages.status = 'failed'`, `error_message` set, logged to `message_events`. **Not surfaced anywhere in the UI** — a bounced message sits in the database correctly flagged and is never shown to a coordinator as failed (confirmed: no component reads `message.status === 'failed'` to render a visible warning — this is a UX gap layered on top of a real data gap, not a data gap alone).

**Spam complaints: Logged, not acted on.** `email.complained` is written to `message_events` for audit purposes only — no automatic suppression, no flag on the lead/client record, no venue-facing indicator. A real compliance risk if volume ever grows: repeated complaints against the same recipient should eventually suppress future sends, and nothing does that today.

**Open tracking / Click tracking: Yes, real, already wired into lead scoring** — `open_tracking`/`click_tracking: true` on every send, `email.opened`/`email.clicked` webhook events feed `logSignalEvent` and trigger an immediate `computeAndSaveLeadScores` refresh. This is genuinely more sophisticated than most of this audit expected going in.

**Reply handling: Yes**, three-tier matching described above, confirmed real.

**The one structural gap: `app/api/messaging/webhook/route.ts` (delivery/bounce/open/click) only ever looks up `messages.provider_id` — the legacy table.** It has zero awareness of `conversation_messages`. Any email sent while a venue is on the new Conversation experience (or any email whose only record is a `conversation_messages` row — see Release Blocker #2 in the platform document) has its delivery/bounce/open/click status silently un-trackable, because the webhook can never find the message it's about. This is the infrastructure-layer twin of the platform document's Release Blocker #1/#2 — same root cause (the new system doesn't yet inherit something the old one had), different layer.

---

## 2. SMS

**Which provider? Twilio — confirmed, not reopened.** `lib/sms/send.ts`, direct `fetch` to the Twilio REST API, no SDK, mirroring the email pattern exactly (a deliberate, stated consistency in the file's own header comment, confirmed true in the code).

**Can we swap providers?** Same answer as Email — no abstraction exists; the Twilio request shape (`To`/`Body`/`MessagingServiceSid`/`From`, Basic Auth via SID:Token) is inlined.

**Credentials:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` (preferred) or `TWILIO_FROM_NUMBER` (fallback) — documented, server-only.

**Sandbox vs. Production:** Same implicit pattern as email — `isConfigured()` gates whether a send is attempted at all; unlike email, there is genuinely no fallback (`sendSms` returns `{ok: false}` outright when unconfigured, correctly, per the file's own comment: "there is no 'safe' fallback for SMS"). No dev/sandbox toggle beyond "don't configure Twilio."

**Can inbound SMS continue a conversation? Yes** — `app/api/messaging/sms-inbound/route.ts`, matched by phone number via `find_relationship_by_phone`, writes directly into `conversation_messages` (the new system — notably *not* mirroring email's legacy-first path; see §5's threading note).

**STOP/START handling:** **Delegated entirely to Twilio, not built in this codebase.** The recommended path (a Messaging Service SID) gets Twilio's own opt-out compliance "for free," per the send file's own comment — meaning Wevenu never sees or records a STOP/START event itself. If a venue uses the `TWILIO_FROM_NUMBER` fallback instead of a Messaging Service, **opt-out compliance is not handled at all** — the code comment says as much plainly ("opt-out handling must be built separately if used long-term"). This is a real compliance exposure for any venue not using a Messaging Service, named honestly in the code already, worth re-confirming here as a live risk, not a hypothetical one.

**Delivery receipts:** **Not implemented.** Confirmed via grep — no `StatusCallback` route, no delivery-status webhook for outbound SMS anywhere. A text can fail after Twilio accepts it (invalid number, carrier rejection, opt-out) and Wevenu never finds out. This is a real, unaddressed gap — email has bounce handling; SMS has none.

**Carrier failures:** Same gap — no visibility past the initial Twilio API response (`res.ok`).

---

## 3. Domain

**Does Wevenu support `venue.com`, `notifications.wevenu.com`, `venue@venue.com`, or both? Neither, today — confirmed, not assumed.** `FROM_EMAIL` is one process-level environment variable, shared by every venue on the platform (`lib/email/send.ts` line 29: `process.env.FROM_EMAIL ?? "Wevenu <onboarding@resend.dev>"`). There is no per-venue column, no per-venue Resend domain configuration, nothing in `lib/venue/types.ts` resembling a sending identity. Every venue's outbound email today comes from the same address. This is the single most consequential infrastructure gap this audit found — not because anything is broken (every venue's mail sends correctly today), but because it caps the platform at effectively single-tenant-shaped sending: a couple receiving mail from two different Wevenu venues would see the identical From address for both, and any venue wanting their own domain reputation, deliverability history, or brand-consistent From address cannot have one without a code change, not a settings change.

**Same gap applies to SMS** — one shared Twilio Messaging Service/number for the whole platform (confirmed: `TWILIO_MESSAGING_SERVICE_SID`/`TWILIO_FROM_NUMBER` are also process-level, not per-venue).

---

## 4. Conversation Threading

Answered in full by the companion document's Conversation Architecture section — restated here only for the infrastructure-specific angle: **threading itself is not the risk; status-tracking parity across the two live models is.** The forward-sync trigger (`sync_message_to_conversation`, read directly from `pg_proc`) is well-built — correct direction mapping, correct channel mapping, idempotent via `on conflict`, and fails loudly (`RAISE WARNING`) rather than silently swallowing errors, a real, deliberate improvement over the exact TR-M7 failure mode its own comment references. Inbound SMS writes directly to `conversation_messages`; inbound email writes to `messages` and reaches `conversation_messages` only via the bridge trigger — an asymmetric code path that happens to produce the same correct end state today, worth normalizing eventually (§7) but not a live defect.

---

## 5. Attachments

**How are files stored?** Two established, working, table-per-legacy-system models: `message_attachments` (the `lib/messaging`/Lead-Client system) and `couple_message_attachments` (the `lib/messages`/legacy portal chat system) — both presumably backed by Supabase Storage, matching the pattern every other file-bearing feature in this platform already uses (Documents, Floor Plan backgrounds, Playbook task attachments).

**The new Conversation system has no attachment concept at all** — confirmed: `ConversationMessage` (`lib/conversations/types.ts`) carries no attachment field, and no `conversation_message_attachments` table exists. **This is not a discovered gap — it is a stated, deliberate scope decision**, confirmed in `docs/program-2-implementation-plan.md`'s own Phase 2 description: *"No attachments yet — the goal is establishing Conversation as the canonical communication model before documents move through it."* Named here so it is not mistaken for an oversight, and so whoever picks up attachments-on-Conversation next inherits the two existing models' shape (a join table, a Storage path, mime type, file size) rather than inventing a third.

**Need a consistent model? Yes, eventually** — but building it now would mean building it a fourth time before the second and third are even retired. Recommended sequencing (§7): design Conversation's attachment model once, when the couple-portal cutover (which needs it — couples already send documents through the portal today) is actually scheduled, not before.

---

## 6. Testing Strategy — the section this audit was told matters most

**Can a developer today, without touching production, walk: Send Email → Receive Email → Reply → Conversation updates → Automation fires → Luv summarizes → Notification created?**

Verified, step by step, against what actually exists:

1. **Send Email** — Possible today with a real `RESEND_API_KEY` in `.env.local`, but that key sends *real* mail to *real* inboxes; Resend has no first-class "sandbox mode" flag this codebase reads or sets. A developer must either use a Resend test-only recipient address (a Resend account feature, not a Wevenu one) or accept that local testing sends real email.
2. **Receive Email** — Requires a publicly-reachable URL for Resend's Inbound webhook to POST to. `NEXT_PUBLIC_APP_URL` is read directly (`app/api/messaging/inbound/route.ts` doesn't itself require this, but the setup comment in `sms-inbound/route.ts` does) — meaning **local inbound testing requires a tunnel (ngrok or equivalent) pointed at a real Resend/Twilio dashboard configuration.** No local-only inbound simulator, fixture endpoint, or replay tool exists anywhere in this codebase (confirmed by grep for "ngrok"/"tunnel"/"fixture"/"simulate" across `lib`/`app` — zero matches).
3. **Reply** — Same tunnel dependency as #2.
4. **Conversation updates** — Verifiable directly via SQL once a message lands (as this audit itself did, repeatedly, this session) — no gap here; the data layer is directly, easily testable without any external dependency.
5. **Automation fires** — `processDueScheduledMessages()` is a plain exported function; a developer can invoke it directly (there is no cron simulator, but none is needed — it's callable code, not a black box).
6. **Luv summarizes** — Not applicable to Communication specifically; Luv doesn't summarize conversation content (confirmed in the companion document).
7. **Notification created** — Verifiable via direct SQL once Release Blocker #2 (companion document) is fixed; today, verifiable only for the legacy path.

**The honest answer: steps 4–7 are genuinely, easily testable locally, entirely inside the database — this program's own established `begin;...rollback;`/`do $$ ... end $$` discipline, used throughout every audit this session, already proves this. Steps 1–3 (the parts that leave the database and touch a real external provider) are not testable without either a tunnel to a real provider dashboard or accepting real sends.** This is not a defect unique to Wevenu — it is the correct, unavoidable shape of testing anything that talks to a real email/SMS provider — but it is exactly the gap the commissioning request named as the thing it cares about most, and no mitigation (a fixture-based inbound simulator, a documented ngrok workflow, a Resend/Twilio sandbox-mode toggle) exists today to shrink it.

**Local development workflow:** `.env.example` is real, thorough, and correctly documents every required variable with setup instructions — genuinely good developer documentation. What it does not provide: a documented step-by-step "how to test the full loop locally" walkthrough, or any tooling to avoid needing a tunnel + a real provider account to exercise the inbound half of the pipeline at all.

---

## 7. Recommendations

Item 4 is implemented this pass (`lib/communication/mode.ts`, wired into `sendEmail`/`sendSms`; see the companion document's Release Completion, Phase 2) — the rest are named and deliberately not attempted, per §8:

In priority order, each named against a specific gap above, none requiring a decision this audit is positioned to make unilaterally:

1. **A minimal `EmailProvider`/`SMSProvider` interface**, with Resend/Twilio as the first (and, for a while, only) implementation. Not a rewrite — `sendEmail`/`sendSms`'s own signatures already look like what an interface's method would need; this is an extraction, not new logic.
2. **Fix the webhook/notification gaps named in both this document and the companion one** — these are genuine Release Blockers, not infrastructure investment, and are implemented in this pass (see the companion document's Phase 1).
3. **A venue-level sending-identity model** (§3) — the single highest-leverage infrastructure investment named in this document, and a genuine product/business decision (does every venue get a subdomain? a verified custom domain? a shared domain with a per-venue display name only?) that this audit is not positioned to decide unilaterally.
4. **An explicit `COMMUNICATION_MODE` (or per-channel `EMAIL_MODE`/`SMS_MODE`) env-level switch** — `real | sandbox | disabled` — read once, at the top of `sendEmail`/`sendSms`, replacing the current "unset key = fallback" implicit behavior with a deliberate, visible one. Bounded, safe, high-value for exactly the local-testing concern this document's commissioning request named as its top priority.
5. **An inbound-message fixture/simulator** — a local route or script that POSTs a realistic Resend/Twilio inbound payload directly, bypassing the need for a real tunnel during day-to-day development. Does not require a provider decision; purely additive tooling.
6. **SMS delivery-status webhook** (`StatusCallback`) — closes the one gap email already has solved (bounce handling) but SMS does not.
7. **Conversation attachment model** — deliberately deferred, per §5, until the couple-portal cutover that actually needs it is scheduled.

---

## 8. Why the largest items above are not implemented in this pass

Per the standing instruction governing this whole audit ("only stop if you encounter a genuine architectural decision requiring clarification"): items 3 and 4 above are exactly that. A per-venue sending identity is a real product decision (subdomain-per-venue vs. verified-custom-domain vs. shared-domain-with-display-name — each has different cost, different setup burden for a venue owner, and different deliverability implications) that determines a meaningful part of the platform's onboarding flow going forward; building one shape now risks building the wrong one. An explicit sandbox-mode switch is smaller and safer, and **is implemented in this pass** (Phase 2 of the companion document) precisely because it doesn't require that larger decision first — it's a strictly additive safety rail around the sending code that already exists. Items 1, 5, and 6 are genuine future engineering investment, named honestly, not attempted here because they are net-new capability, not a fix to something broken — consistent with this program's own standing discipline throughout every prior audit.
