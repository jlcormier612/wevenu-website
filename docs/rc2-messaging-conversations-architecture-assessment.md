# RC2 — Messaging & Conversations: Architecture Assessment

**Scope of this document:** research + assessment only, no code. Per your instruction, this evaluates messaging as a complete platform capability — internal coordinator messaging, couple conversations, vendor conversations, email/SMS, timeline/history, templates, sequences, notifications, unread state, attachments, ownership, relationship-vs-event scoping, audit history, visibility/permissions, delivery state, read receipts, Luv participation, Commitment Lifecycle interactions, onboarding, archive/search, performance, and duplicate/competing models.

---

## 0. The framing correction that changes everything else in this document

**This is not a green-field assessment. It's a decision about whether and how to resume a deliberately-paused migration that a previous pass already designed, partially built, and formally signed off as "Release Ready" — one stage short of the exact outcome you're now asking for.**

The repo already contains a substantial, dated body of architecture work on exactly this problem:

- `docs/conversation-lifecycle-design.md` — established the target model: one Conversation, anchored to an enduring `venue_customer_relationship`, not to a Lead or a Client.
- `docs/conversation-experience-cutover.md` — a full UX design for the single-inbox, channel-as-transport, Relationship-anchored experience you're describing, including a 5-stage rollout plan (internal dogfood → opt-in beta → couple-portal cutover → default-on → full legacy retirement).
- `docs/communication-platform-next-phase.md` — designed Templates and Sequences against the new Conversation model directly, with a competitive review against five real products in this market.
- `docs/communication-platform-release-readiness.md` — the most recent full audit. It found and fixed two real defects (an Automation's sent message was invisible to everyone; a new-system message produced no coordinator notification), built a full delivery-status/message-timeline layer (Created → Sent → Delivered → Opened → Clicked → Replied), and closed with: **"Communication is Release Ready... unless a future operational walkthrough surfaces a genuine Communication defect, this feature is complete."**

That sign-off is real, and most of it holds up under direct re-verification (see §2). But it was explicitly conditioned on a pause: **"no further UI work (couple portal cutover, search, notification source-swap) until a real coordinator walkthrough of what exists now."** That walkthrough is not recorded as having happened. The flag (`conversation_experience_enabled`) is still `false` for every venue. There is no UI anywhere — not in venue Settings, not in HQ admin — to turn it on. The migration isn't stalled by a technical blocker; it's stalled because nobody has flipped a switch that doesn't yet have anything to flip it with.

**What this means for how to read the rest of this document:** your request ("every communication about an event lives in one place, regardless of channel or audience") is not a new architecture to invent. It's the already-approved endpoint of a migration that stopped one stage before couple-facing cutover, plus two genuinely new scopes the prior work explicitly named as unbuilt and out of scope at the time: **vendor conversations** and **Activity Timeline/search**. RC2's real job is to (a) validate the paused plan still holds, (b) extend it to vendors — which the prior design only modeled, never built — and (c) finish the stages that were deliberately deferred, not to redesign what's already correct.

---

## 1. Platform inventory — every messaging-adjacent system, verified directly against live code and schema

| System | Real? | Scope | Status |
|---|---|---|---|
| **`lib/messages`** (`couple_threads`/`couple_messages`) | Yes, fully working | One thread per Client, in-app only | **Still the default** — powers the coordinator's main-nav inbox *and* the couple portal's Messages tab, unconditionally, regardless of the flag |
| **`lib/messaging`** (`message_threads`/`messages`) | Yes, fully working | New thread per send, scoped to Lead/Client/Event | Real email in/out, provider status tracking. Ownership model is genuinely wrong (a "thread" per send, not per relationship) — already diagnosed, not new |
| **`lib/conversations`** (`conversations`/`conversation_messages`) | Yes, flag-gated | One Conversation per `venue_customer_relationship`, forever | The intended replacement for both above. Richest model: 5 sender types (including `vendor`), 7 channels (including `phone_log`/`voicemail`), symmetric read state, real delivery-status tracking (confirmed: `status`/`failure_reason`/`provider_id` columns exist on `conversation_messages` today — the "no status field" gap named in earlier drafts of the release-readiness audit is closed) |
| **Vendor conversations** | **No** | — | `ConversationSenderType` includes `"vendor"` structurally; zero UI, either side, sends or reads through it. Vendor Portal's own Messages page is a literal placeholder: *"Standalone message compose is coming in Sprint 107."* Confirmed unchanged. |
| **Message Templates** | Yes | Venue-wide, email/SMS | Mature — cross-channel merge-field vocabulary shared, content never shared (deliberate). |
| **Sequences** (`message_sequences`) + **Scheduled Sends** (`scheduled_messages`) | Yes, real cron worker | Relationship-anchored | Channel type is `"email" \| "sms"` only — `"portal"` was never added as an option, closing the one gap the design docs flagged, by omission rather than a runtime guard. |
| **In-app notifications** (`venue_notifications`) | Yes | Venue-wide, 9+ triggers | A distinct 4th/5th surface, by design — "Conversation owns history; notifications only surface change," a boundary already explicitly held in the cutover doc. Confirmed both legacy `messages` and new `conversation_messages` now notify correctly (the second Release Blocker fix). |
| **Automations Framework** (`automation_rules`/`platform_events`) | Yes, dormant | — | Only two actions implemented (apply-template, in-app-notify); no `send_message` action exists. Orthogonal to messaging today. |
| **AI/Luv participation** | Yes, 4 separate integrations | — | `drafts.ts` (Lead reply), `client-drafts.ts` (Client reply), `roll-up-service.ts` (weekly narrative), `luv-ask` (Venue Guide Q&A). **None reads or is scoped to the Conversation object itself** — each independently fetches whatever context it was built with. No reply-suggestion/rewrite feature exists on either messaging surface. No AI summarization of conversation *content* exists anywhere (Luv narrates operational *state* — unread counts, milestones — never message bodies). |
| **Requests** (`requests`) | Yes | Own lifecycle object | Structurally separate from every messaging system — no cross-reference between a Request and the Conversation message(s) that motivated it. |
| **Activity feeds** | Yes, fragmented | Per-entity | Four independent tables (`event_activities`/`lead_activities`/`client_activities`/`request_lifecycle_events`), not conversation-shaped, not searchable together. No unified Activity Timeline exists (designed in the cutover doc §4, explicitly deferred). |
| **Search** | Confirmed absent | — | Messages are not searchable anywhere — not in the ⌘K palette, not within either messaging surface. Already diagnosed, already designed (cutover doc §8: resolve to Relationships, not messages), never built. |
| **Attachments** | Fragmented, 3 shapes | — | `couple_message_attachments` (20MB, restricted types), `message_attachments` (25MB, unrestricted, shared `documents` bucket), **`conversations` has none at all** — confirmed no `conversation_message_attachments` table exists; explicitly deferred as "Program 2 Phase 3/4 territory" in the Conversation inbox UI's own code comment. |
| **Onboarding/rollout tooling** | **Does not exist** | — | No venue Settings toggle, no HQ admin toggle, for `conversation_experience_enabled`. The only way to advance a venue to "opt-in beta" (cutover doc §9 stage 2) is a raw SQL update. |

---

## 2. What's already correct and shouldn't be re-litigated

Per the "don't assume the current implementation is correct" instruction, these were re-verified directly, not taken on the prior docs' word:

1. **Relationship-anchoring is right and durable.** `conversations.relationship_id` is unique-indexed — a Conversation cannot be duplicated or fail to exist for a given Relationship, by construction (an `after insert` trigger provisions it). This correctly spans the full lifecycle (a Lead's pre-conversion messages and a Client's post-conversion messages are the same Conversation already) — confirmed, not assumed.
2. **Delivery-status tracking is real and complete.** `conversation_messages.status`/`failure_reason`/`provider_id`, `conversation_message_events` for the full Created→Sent→Delivered→Opened→Clicked→Replied timeline, plain-English status labels shared between email and SMS. This is a genuinely mature layer — no reason to rebuild it.
3. **The forward-sync bridge is real and currently the only thing keeping the legacy inbox from silently losing Automation-sent messages.** `mirrorToLegacyIfNeeded` (Scheduled Sends) and the equivalent in `lib/tours/communication.ts` both mirror into `lib/messaging` when the flag is off — deliberately, honestly bounded to email-channel + Lead-relationship only. **This means the mirror does NOT cover: SMS sends, or any Client/couple-facing send** — a real, still-open gap inherited from the prior pass, not fixed here.
4. **Templates and Sequences are mature and already target Conversations correctly.** No reason to touch either system's own architecture.

---

## 3. What's genuinely missing, broken, or undecided — organized by your evaluation criteria

### 3.1 Vendor conversations — the single largest net-new scope in RC2

Nothing is built. But more importantly, **the vendor portal's own placeholder copy already reveals a scoping question the couple side never had to answer**: *"Messages are organized by event. Open an event to view and reply to message threads."* That's an **event-scoped** mental model — a vendor's communication is naturally "about this wedding," not "an enduring relationship with this venue" the way a couple's is.

This is a real fork from the Relationship-anchored model everything else in this document assumes, and it can't be resolved by analogy to the couple side. A venue's relationship with a preferred photographer spans dozens of events over years (closer to Relationship-shaped); a specific booking's coordination with that same photographer ("arrive at 3pm, park behind the barn") is inherently about *this* event, not the vendor relationship in the abstract. Both are real needs. **This is Architectural Question 1, below.**

### 3.2 The couple-portal cutover mechanism doesn't exist yet, independent of the product decision to proceed

Even setting aside whether to advance the rollout, **there is no way to advance it** — no toggle, venue-facing or admin-facing. Building "coordinator/HQ can flip this per venue" is prerequisite infrastructure regardless of which rollout stage you choose to target, and it's currently missing entirely.

### 3.3 Activity Timeline and Search — both fully designed, neither built

The cutover doc's §4 (Timeline) and §8 (Search) designs are specific and, on inspection, still sound: Timeline as compact log-lines interleaving Conversation messages with Contract/Payment/Event milestones, read-only, click-through into Conversation; Search resolving to Relationships first with messages as supporting evidence, extending the existing `search_global` union rather than building a parallel system. No reason found to redesign either — the work is building them, not deciding their shape.

### 3.4 UX gaps named but never closed

- **Automated vs. human-sent messages are visually indistinguishable.** A Sequence-sent message and a coordinator-typed one look identical in the thread — `processOne` inserts both with the same `sender_type`. A coordinator scrolling history can't tell what Wevenu sent on their behalf versus what they personally wrote.
- **No "waiting on you / needs reply" state.** Inferred today from "last message was from the other side," never a stored flag. Requests already models an equivalent state (`Request.status`) that could be the template.
- **No Request ↔ Conversation cross-reference.** A coordinator reading a Request has no link to the conversation where the client actually explained what they meant, and vice versa.
- **`Event.Completed` triggers nothing.** No automatic post-event nudge to request a review/referral exists, despite both destination tables (`couple_venue_feedback`, `couple_referrals`) already working when reached manually. Named in the orchestration doc, re-confirmed here as still open — it's a Commitment Lifecycle interaction gap as much as a messaging one (a real Commitment Event — the wedding happening — produces no downstream communication at all).

### 3.5 Attachments have three shapes, one of which is "none"

Conversations — the system every other messaging surface is meant to converge into — cannot carry an attachment at all today. Building this is not optional if Conversations is genuinely meant to absorb the other two systems' capability, not just their message text.

### 3.6 AI/Luv participation is real but entirely disconnected from the Conversation object

Four separate, independently-scoped integrations, none of which reads a Conversation's own message history as its context, none of which drafts *from inside* a Conversation thread. No reply-suggestion, no rewrite, no summarization of what was actually said. This is named in the release-readiness audit as the natural next convergence point, not designed further there.

### 3.7 Performance

Not a present risk, and treating it like one would be solving a problem that doesn't exist yet: this is bounded, per-venue data (tens of thousands of messages for a very active decade-old venue, not millions) — a standard Postgres index handles it comfortably. Worth a real index audit once Search is actually built (trigram/full-text on `conversation_messages.body`), not before.

---

## 4. Architectural questions — need your input before an implementation plan can be written

1. **Vendor conversation scoping (§3.1)**: should vendor conversations be Relationship-anchored (one enduring thread per venue↔vendor relationship, matching the couple model exactly, with event context shown as metadata on each message) or Event-anchored (one thread per event↔vendor assignment, matching the vendor portal's own existing "organized by event" framing, with the venue-vendor relationship as a rollup view across events) — or does a vendor need both, the way a couple's Conversation is Relationship-anchored but Planning already thinks in terms of the specific Event?
2. **Rollout stance**: given the prior pause was conditioned on "a real coordinator walkthrough" that doesn't appear to have happened — do you want to (a) treat that walkthrough as satisfied by this initiative's own review and proceed straight to building the couple-portal cutover + vendor conversations + Timeline + Search in one coherent pass, or (b) actually stand up the admin/venue toggle first and run a real internal-dogfood stage before building the couple-facing and vendor-facing work, per the original staged plan?
3. **Legacy retirement**: full retirement of `message_threads`/`messages`/`couple_threads`/`couple_messages` (cutover doc stage 5) requires every venue to be migrated first — is that in scope for RC2, or is RC2 scoped to "build the destination correctly and get every *new* venue there," with legacy retirement as a follow-on once real venues have actually migrated?
4. **Automated-vs-human message distinction and "waiting on you" state**: both are small, real UX gaps with no design decision needed (the mechanism is obvious — a badge/icon, and a derived flag) — include in this pass, or treat as polish for a later one?
5. **Attachments on Conversations**: build now (blocking, since it's core parity with the two systems being replaced) or explicitly defer again (as the last two passes did)?

---

## 5. Recommendation, subject to your answers above

Build in this order, regardless of how the questions above resolve: **(1)** the rollout toggle (prerequisite for everything else), **(2)** attachments on Conversations (closes a real capability gap before anyone is asked to rely on it as a full replacement), **(3)** vendor conversations (the largest net-new scope), **(4)** the couple-portal cutover, **(5)** Activity Timeline + Search, **(6)** the smaller UX gaps (automated/human distinction, waiting-on-you, Request cross-link, Event.Completed follow-up nudge). Full implementation plan follows once the questions above are answered.
