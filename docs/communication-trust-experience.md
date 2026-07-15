# Communication Trust Experience

Not an email/SMS implementation task — the trust layer around one already built (`docs/communication-platform-release-readiness.md`). Guiding principle: a venue owner should never need to understand email technology to trust Wevenu, and should never wonder "did my message actually go?" Built on top of the Communication Platform's "Ready" verdict; see `docs/communication-trust-acceptance-test.md` for the explicit release checklist this work was measured against.

## Phase 1 — End-to-End Infrastructure Verification

Walked both pipelines (Lead → Automation → Send → Provider accepts → Delivery → Reply → Conversation → Activity → Platform Event → Notification → Luv for email; the SMS equivalent) against the real system. Confirmed live: Automation, Send, Delivery, Reply, Conversation, Notification. Confirmed missing, by design or otherwise: Activity (no message ever produces a Lead Activity entry), Platform Event (Communication isn't a participant yet, matching the phased adoption plan), Luv (didn't read message state at all before Phase 8, below). The single biggest finding: `sendConversationMessage` discarded the provider's response entirely — no `provider_id`, no `status` column existed on `conversation_messages` at all, meaning a message sent through the newer Conversation UI could never be updated by any webhook. That became the target for Phase 3.

## Phase 2 — Communication Health

`lib/communication/health.ts` — the one question a venue owner has ("can I trust Wevenu today?") answered as 🟢 Excellent / 🟡 Needs Attention / 🔴 Action Required, no technical terms. 🔴 fires when email and SMS are both unconfigured platform-wide, or ≥34% of the last 5+ sends in 7 days failed (a systemic signal, not a few bad addresses). 🟡 fires on any recent failure. Shown as a card on the main Dashboard.

## Phase 3 — Message Status (the foundation everything else reads from)

One shared status lifecycle — `draft → sending → accepted → delivered → opened → clicked → replied`, or `failed` — added to both `messages` (legacy) and `conversation_messages` (new, previously had none). Every send path now records the real provider response; every webhook updates whichever table actually sent it. A rank-based advance guard (`lib/communication/status.ts`) means a redelivered or out-of-order webhook can never erase a status a venue already saw. New `/api/messaging/sms-status` route gives SMS the same delivery/failure tracking email already had. Plain-language failure translation (`lib/communication/failure-messages.ts`) turns raw provider errors into lines like "This phone number cannot receive text messages."

**Real defects found and fixed**: `sendEmail()` never captured Resend's message id at all; `find_relationship_by_phone` stripped a country-code digit asymmetrically, so any E.164-stored phone number could never be matched by an inbound text; `service_role` was missing `UPDATE` on `conversations`; legacy compose silently marked messages "sent" without attempting a real send when unconfigured; the SMS-inbound webhook was unreachable (proxy allowlist gap, the first instance of a bug found three more times across this pass).

## Phase 4 — Communication Health Dashboard

`/messaging/health`, linked from both messaging inbox variants. Plain counts, never a percentage: "X messages sent (last 30 days) / Y delivered successfully / Z need your attention." Individual Message History kept deliberately separate from the health summary above it.

## Phase 5 — Guided Recovery

Failed messages in the Conversation thread show inline actions instead of dead-ending: Retry / Send as [alternate channel] instead (both load the content back into the compose box for review rather than silently re-sending) and Follow up later (creates a real Lead task). Scoped to the Conversation experience only — the legacy Messages tab is explicitly frozen pending its own migration decision.

## Phase 6 — Communication Readiness

Bottom of `/messaging/health`. A real self-test — "Send test email"/"Send test text" actually sends to the venue's own address/phone and only checks itself off once genuinely delivered. Honest three-state model (ready/untested/not_ready) rather than a fabricated checkmark — a brand-new venue that hasn't received a reply yet correctly shows "not yet tested," not a false pass or an alarming failure.

## Phase 7 — Diagnostics

Administrator-only, added to the existing Wevenu HQ venue detail page (`/admin/venues/[venueId]`). Raw provider/webhook payloads, auth status, queue status — everything Phase 2 deliberately hides from the coordinator. Required adding `<table>_hq_select` RLS policies (additive, SELECT-only, matching the existing `clients_hq_select` precedent) since every communication table's policy was previously strictly "your own venue."

## Phase 8 — Luv

`lib/luv/communication-observations.ts` — reads Phase 3's status data and speaks in the same plain English as the rest of Luv: "Everything sent in the last day reached its destination," a grouped plain-language failure summary, or a delivered-but-unopened message flagged after 5 days with a follow-up recommendation. Respects the same observations toggle as every other Luv source.

## Cross-cutting: unified Message Status vocabulary

Per direct feedback during this pass — one emoji + label vocabulary, identical for email and SMS, no carrier/provider jargon, moved to a single shared source (`lib/communication/status-labels.ts`) consumed by the bubble badge, Message History, and (implicitly) Luv:

📝 Draft → ⏳ Sending → 📤 Sent → 🟢 Delivered → 👀 Opened → 🖱️ Clicked → 💬 Replied, or ❌ Couldn't deliver at any point.

Opened/Clicked simply never populate for SMS — a fact about the channel (Twilio has no equivalent signal), not a different vocabulary.

## The most severe finding of this pass

Testing the "Scheduled send" item on the Acceptance Test checklist surfaced that three of the four Vercel cron jobs — Scheduled Sends, the entire Automation engine, and the daily digest email — were unreachable in production, hitting the identical proxy-allowlist bug already fixed for the two Twilio webhooks. Every cron invocation carries no session cookie; all three routes were redirected to `/login` instead of reaching their handler. Fixed and confirmed live: all three now return `200` (previously `307`), and a real due Scheduled Send was picked up and processed end-to-end by a real POST to the route.

See `docs/communication-platform-release-readiness.md`'s "Communication Trust Experience — Final Release Assessment" section for the full revised-criteria table and final recommendation.
