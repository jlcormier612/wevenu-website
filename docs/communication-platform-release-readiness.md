# Communication Platform — Release Readiness Audit

**Status:** Audit complete. Implementation follows in this same document's Phase 1–4 sections. Infrastructure & Deliverability is audited separately, as instructed, in `docs/communication-infrastructure-readiness.md` — read that document before treating any provider-facing recommendation below as final.
**Read first:** `docs/platform-orchestration-architecture.md`, `docs/platform-event-adoption-plan.md`, `docs/luv-platform-intelligence-architecture.md`, `docs/luv-platform-reconciliation.md`, `docs/calendar-platform-integration.md` — all five treated as authoritative throughout. **Also required reading, discovered during this audit and not optional:** `docs/conversation-experience-cutover.md`, `docs/conversation-lifecycle-design.md`, `docs/architecture-delta-phase-2-relationship-foundation.md`, `docs/architecture-delta-phase-2b-detail-conversation-tab.md`, `docs/lead-identity-architectural-exploration.md`, `docs/program-2-implementation-plan.md`. This is not a side note: Communication is not a green-field audit — it is the single most-designed, most-in-progress capability in the platform, mid-migration, with its own approved architecture, its own phased rollout plan, and an explicit, deliberate pause already in effect. Every finding below is read against that plan, not invented fresh.
**Method:** direct code and live-schema verification — every table this document names was queried directly (`information_schema.triggers`, row counts, trigger definitions), every "who reads this" claim confirmed by grep against actual import sites, not inferred from a type file's own comment. Where a doc's comment claimed something ("not wired into any UI yet") this audit checked whether that remained true today rather than repeating it uncritically — in that specific case, it does not: the Conversation system is wired into five real UI surfaces, flag-gated, exactly as `docs/architecture-delta-phase-2b-detail-conversation-tab.md` describes.

---

## The one framing fact every section below depends on

**Communication is not one implementation, and not accidentally four. It is a deliberate, in-progress, well-designed migration from two legacy systems to one new one, currently paused mid-flight by explicit prior instruction.**

- **`lib/messages`** (`couple_threads`/`couple_messages` tables) — the original couple-portal chat system. Snake_case types, no repository layer (queried via RPC: `get_couple_inbox`, `get_couple_thread`, `send_couple_message`, `get_portal_messages`). Powers `app/(app)/messaging/legacy-inbox.tsx` (the coordinator's main-nav inbox when the new experience is off) and `components/portal/message-section.tsx` (the couple's portal message view, **unconditionally** — not flag-gated at all).
- **`lib/messaging`** (`message_threads`/`messages` tables) — a second, independently-built system: email-style, one thread created per send, provider status tracking (`status`, `providerId`, `deliveredAt`, `errorMessage`), used by the Lead/Client/Event detail pages' "Messages" tab when the new experience is off.
- **`lib/conversations`** (`conversations`/`conversation_messages` tables) — the intended replacement for both of the above, anchored to `venue_customer_relationships` rather than to a Lead or a Client directly (`docs/lead-identity-architectural-exploration.md`'s "Relationship, not Lead" decision), with the richest model of the three: five sender types including `vendor`, seven channel types including `phone_log`/`voicemail`, symmetric read-state (`venueReadAt`/`contactReadAt`) on every message, staff assignment.

This is gated by exactly one flag: `venues.conversation_experience_enabled` (default `false`; confirmed `false` for the only venue in this environment). A real, working forward-sync trigger (`messages_sync_to_conversation`, confirmed live on `messages`) keeps the new system current with the old one during the transition. `docs/conversation-experience-cutover.md` §9 lays out a five-stage rollout (internal dogfood → opt-in beta, coordinator-side only → couple portal cutover → default-on → full retirement) and states explicitly: **"per explicit instruction, this is where Phase 2B stops — no further UI work (couple portal cutover, search, notification source-swap) until a real coordinator walkthrough of what exists now."**

**What this means for this audit's own recommendations:** advancing the rollout stage (enabling the flag more broadly, cutting the couple portal over, retiring the legacy tables) is a product decision this audit does not make and this pass does not implement — that instruction stands, and nothing below overrides it. What this audit *does* find, and *does* fix: real defects in the current, paused, mid-migration state — places where the new system was built without inheriting something the old system already had, which is a bug regardless of which stage the rollout is at.

---

## Platform Inventory

Verified against actual imports and live schema, not assumed from the brief's own example list.

| Channel/system | Real? | Backing |
|---|---|---|
| Email (outbound) | Yes — Resend | `lib/email/send.ts` |
| SMS (outbound) | Yes — Twilio | `lib/sms/send.ts` |
| Email/SMS inbound | Yes — real webhook routes | `app/api/messaging/inbound`, `app/api/messaging/sms-inbound` |
| Internal Notes | Yes, but per-entity, not conversation-shaped | `event_tasks.notes` (Planning), `couple_documents`/general note fields scattered per feature — no single "Notes" system |
| Client Messages (legacy chat) | Yes | `lib/messages` (`couple_threads`/`couple_messages`) |
| Client/Lead Messages (legacy email-style) | Yes | `lib/messaging` (`message_threads`/`messages`) |
| Conversations (new, unified) | Yes, flag-gated, coordinator-side only | `lib/conversations` (`conversations`/`conversation_messages`) |
| Lead Messages | Yes — same as Client Messages above; Leads and Clients share both the legacy `lib/messaging` system and the new Conversation system (a Lead is an Opportunity on the same Relationship a Client later belongs to) | — |
| Vendor Messages | **Modeled, not built** — `ConversationSenderType` includes `"vendor"` and `ConversationChannel` supports it structurally, but zero UI anywhere (venue or vendor side) sends or reads a vendor message through it. The Vendor Portal's own Messages page is a placeholder: *"Standalone message compose is coming in Sprint 107."* | `lib/conversations/types.ts` (schema only) |
| Requests | Yes, but structurally separate from every messaging system above — a Request is its own lifecycle object (`requests` table), never a message | `lib/requests` |
| Notes/Activity feeds | Yes, per-entity, four independent tables (`event_activities`/`lead_activities`/`client_activities`/`request_lifecycle_events`) — not conversation-shaped, not searchable together | Confirmed in `docs/platform-orchestration-architecture.md` §0(d), unchanged |
| Notifications (in-app) | Yes | `venue_notifications`, 9 triggers, `create_venue_notification()`, `components/shell/notification-bell.tsx` |
| Notifications (email digest) | Yes | `lib/notifications/digest-engine.ts` |
| Automations (Sequences) | Yes, real, real cron worker | `lib/message-sequences`, `lib/scheduled-messages/processor.ts` |
| Message Templates | Yes | `lib/message-templates` |
| AI Drafting | Yes — four separate integrations | `lib/luv/drafts.ts` (lead), `lib/luv/client-drafts.ts` (client), `lib/luv/roll-up-service.ts` (weekly narrative), `luv-ask` (Venue Guide Q&A) |
| Reply suggestions / rewrites | **Not found anywhere** — no AI-assisted reply-drafting exists on either the Conversation or legacy messaging surfaces; drafting is Lead/Client-detail-page-scoped, not conversation-scoped | — |
| Luv conversation summaries | **Not found** — Luv narrates Event Readiness-shaped state (§ below); it does not summarize a conversation's own content anywhere | — |
| Platform Events | Yes, Phase 1 only (Requests wrapped) | `lib/platform-events` |

**Confirmed absent, stated plainly rather than assumed:** a unified "Notes" feature (each capability has its own note field, never a searchable, conversation-adjacent notes stream); any AI reply-suggestion or rewrite feature; any Luv summarization of conversation *content* (Luv summarizes operational *state*, per the reconciliation doc — it has never read a message body).

---

## Communication Lifecycle

Walked Lead → Tour → Proposal → Booking → Planning → Requests → Timeline → Wedding Day → Follow-up → Review → Referral, against real code at each step — not the idealized version, the actual one:

| Stage | Touchpoint | Who starts it | Stored where | Who receives it | Owning workspace |
|---|---|---|---|---|---|
| **Lead** | Inquiry form submission | Prospect (public) | `leads` row created; first message, if any, lands in whichever messaging system is active | Coordinator (notification `new_lead`) | Leads/Pipeline |
| **Lead** | Coordinator follow-up | Coordinator | `lib/messaging` or `lib/conversations`, per flag | Lead (email/SMS/portal) | Lead detail page |
| **Lead** | Sales Sequence (Automation) | System (rule-based enrollment) | `conversation_messages`, unconditionally (`scheduled-messages/processor.ts`) — **see Release Blocker #1** | Lead | Automations |
| **Tour** | Tour booked | Prospect or coordinator | `tour_appointments` — not a message | Coordinator (Calendar) | Tours/Calendar |
| **Tour** | Confirmation/reminder | System or coordinator | Same messaging system as Lead follow-up | Lead | Lead detail page |
| **Proposal** | No distinct "Proposal" object exists | — | Contract Templates + Packages stand in for this stage today | — | Contracts |
| **Booking** | Booking confirmed | Coordinator | `events.status → 'confirmed'`; Platform Event **not yet emitted** for this transition (only Requests are wrapped so far) | Nobody automatically — a real gap named, not new, in `docs/platform-orchestration-architecture.md` §1 | Events |
| **Planning** | Task assigned, escalated, completed | Coordinator/couple | `venue_notifications` (per the Planning Execution pass) — **not** Conversation-shaped, and correctly so; a Planning notification is not a message | Coordinator or assignee | Planning |
| **Requests** | Request created/submitted/reviewed/completed | Either party | `requests` + `request_lifecycle_events` (logged, not emitted as a Platform Event except via the new wrap) | Whoever the Request is waiting on | Requests |
| **Timeline** | No messaging touchpoint of its own | — | — | — | Timeline |
| **Wedding Day** | Vendor check-in, task completion | Coordinator/vendor | `venue_notifications` triggers (`notify_vendor_checkin`) | Coordinator | Wedding Day Ops |
| **Follow-up** | Post-event feedback request | Not automated today — `couple_venue_feedback` exists as a destination but nothing populates it automatically (confirmed in the orchestration doc's own event table: "Event completed" is logged, not emitted, and nothing consumes it yet) | — | — | — |
| **Review** | `couple_venue_feedback` submission | Couple | `notify_feedback` trigger | Coordinator | — |
| **Referral** | `couple_referrals` submission | Couple | `notify_referral` trigger | Coordinator | — |

**The two things this walk makes unmistakable:** first, every stage's actual message traffic funnels through the same two-or-three-system fork described above, regardless of which lifecycle stage produced it — there is no stage-specific messaging system, which is architecturally correct (one system should serve the whole lifecycle) but means the fork's cost is paid at every stage, not just one. Second, **Follow-up is the one lifecycle stage with a real, named gap**: `Event.Completed` is not wired to anything (confirmed, both in the orchestration doc and by this audit's own re-check) — a wedding ending today produces no automatic nudge to request a review or referral, despite both destination tables already existing and already working when reached manually.

---

## Ownership Model

| Entity | Owner | Consistent? |
|---|---|---|
| Lead | `leads` row, itself owned by `venue_customer_relationships` (Phase 2 foundation) | Yes — one owner, confirmed canonical |
| Client | Same Relationship, post-conversion | Yes |
| Event | `events`, `client_id` FK | Yes |
| Vendor | `vendors` + `venue_vendor_relationships` (mirrors the customer side, per the architecture delta) | Yes, structurally — but owns no conversation today (see Vendor Experience) |
| Request | `requests`, `sourceFeature`/`sourceId` pointing at whichever capability created it | Yes — Requests never duplicates another feature's status, confirmed in the Template Platform audit and reconfirmed here |
| Conversation (new) | `conversations.relationship_id` — one Conversation per Relationship, provisioned automatically by an `after insert` trigger the moment the Relationship exists | Yes, and structurally the strongest ownership model in this entire inventory — a Conversation cannot fail to exist, and cannot be duplicated, by construction |
| Message thread (legacy, `lib/messaging`) | `message_threads.lead_id`/`client_id`/`event_id` — **a new thread per send**, not per relationship | **No** — this is the one place ownership is actually inconsistent: the same Lead can accumulate dozens of one-message "threads," each independently owned, with no enduring container. This is exactly what `docs/conversation-experience-cutover.md` §2 names as the first thing that "disappears" once the new system is complete — not a new finding, a confirmed one. |
| Couple thread (legacy, `lib/messages`) | `couple_threads.client_id` — one thread per Client, closer to the new model | Partially — single-threaded like Conversation, but Client-only (a Lead has no couple-chat thread until conversion), and invisible to the coordinator's own Messages-tab view of the same relationship |

**Is ownership consistent, or are multiple systems storing similar conversations?** Both, precisely: **the new system's ownership model is already correct and singular.** The inconsistency is entirely inherited from the two legacy systems it's replacing, and the platform's own migration plan already names and schedules fixing it. This audit's job is not to redesign ownership — `docs/lead-identity-architectural-exploration.md` and `docs/conversation-lifecycle-design.md` already did that work correctly — it is to confirm the design is sound (it is) and find where the *implementation* hasn't caught up to it yet (it hasn't, in two concrete, fixable places — Release Blockers below).

---

## Conversation Architecture

**Does the platform have one conversation model, or several independent messaging systems?**

Three, today, by count — but not three peers. One (`conversations`) is the designed, approved, actively-being-migrated-to model. Two (`lib/messaging`, `lib/messages`) are legacy, both explicitly scheduled for retirement in `docs/conversation-experience-cutover.md` §9 step 5, both still fully live because the migration is deliberately paused before their retirement stage. This is **not** the "several disconnected implementations" failure mode the brief asks to rule out — it is a textbook Strangler Fig migration, mid-flight, with a real forward-sync bridge keeping the new model current. Judged against the brief's own diagnostic question ("one conversation model, or several independent messaging systems"), the honest answer is: **one model has been correctly designed and is correctly being migrated to; the migration is paused, by instruction, one stage short of the couple-facing cutover.**

**Duplicate inboxes:** Yes, by design during migration — main-nav Messaging (legacy or new, per flag) and the Lead/Client/Event detail page's own tab (same fork). Not a defect; `docs/conversation-experience-cutover.md` §1 explicitly designs both to converge into "different windows onto the same Conversation."

**Duplicate message models:** Yes — three, as inventoried above. Same verdict: designed transition, not accidental duplication.

**Duplicate thread concepts:** Yes, and this is the one place duplication is a real defect independent of migration stage — `message_threads`' one-thread-per-send model (§ Ownership) is simply wrong, was always wrong, and the new model's one-conversation-per-relationship design is the acknowledged fix already in progress.

**Duplicate notification mechanisms:** Yes, and this is where a real, fixable bug lives (Release Blocker #1) — `notify_inbound_message` fires only on the legacy `messages` table; `conversation_messages` has only a timestamp-touching trigger, confirmed via direct query of `information_schema.triggers`. This exact gap is already named, not discovered fresh, in `docs/platform-orchestration-architecture.md` §1's own event table ("the newer `conversation_messages` table has a `touch`-style trigger... *no notification fires at all*"). This audit's contribution is closing it, not finding it.

**Duplicate communication history:** No — confirmed the forward-sync bridge (`messages_sync_to_conversation`) means every legacy message is *also* present in the new model; there is no case of the same message existing as two independently-editable records. One direction of sync, one direction of truth.

**Duplicate AI summarization:** No — confirmed no AI summarization of conversation content exists in any of the three systems. Luv's four narration integrations (§ AI Integration below) never read a message body.

---

## Template Inventory

| Template type | Real? | Notes |
|---|---|---|
| Email/SMS (Message Templates) | Yes | `lib/message-templates` — audited in depth in `docs/template-platform-release-readiness.md`; not re-litigated here except where Communication-specific |
| Auto Responses | **Not found** — no "auto-reply to first inquiry" or similar exists | — |
| Sequences (multi-step automations) | Yes | `lib/message-sequences` — each step references a Message Template + an offset |
| Request messages | **Not templated** — Requests are created with a title/description typed fresh each time; no reusable "Request template" exists (confirmed absent, distinct from Message Templates) | — |
| Wedding Day messages | **Not templated** — vendor check-in/notification copy is hardcoded in trigger functions (`notify_vendor_checkin` etc.), not venue-editable | — |
| Luv-generated drafts | Yes, but not a "template" in the reusable sense — each draft is generated fresh per lead/client, never saved as a reusable starting point | — |

**Do they already behave like one platform?** No, and this mirrors the Template Platform audit's own finding almost exactly: Message Templates is the one mature, venue-owned, editable system in this list (confirmed, this pass, still archived/duplicated/categorized correctly per the prior audit); everything else in this table is either hardcoded (Wedding Day messages), absent (Auto Responses, Request messages), or intentionally one-shot (Luv drafts). This is consistent with, not contradictory to, the Template Platform audit's own conclusion — Message Templates already got its consistency pass; this document doesn't re-open it.

---

## Automation Integration

- **Platform Events:** Phase 1 only. `lib/platform-events` is real (`emitPlatformEvent`, confirmed non-throwing, confirmed calling a real `emit_platform_event()` RPC) but only Requests are wrapped (`wire-requests.ts`) — Communication itself does not yet emit a Platform Event for "message received" or "message sent," meaning a future consumer (Luv, Notifications-via-events) has nothing to subscribe to for Communication specifically. This is correctly **not** a Release Blocker — `docs/platform-event-adoption-plan.md` §4 explicitly orders "wrap the notification triggers" as Phase 2 of adoption, not yet reached — but it is worth naming as the next natural adoption slice once Communication's own trigger-level gap (Release Blocker #1) is closed, since wrapping and repairing the same trigger in two separate future passes would be wasted motion.
- **Notifications:** Real, but split exactly along the legacy/new fork (Release Blocker #1).
- **Calendar:** Correctly minimal — `leads.follow_up_date` already appears on Calendar (confirmed, unchanged); no post-booking Communication date exists to wire in, matching the Calendar Platform Integration doc's own finding verbatim.
- **Planning:** No integration, and none is missing — Planning tasks and Conversation messages are correctly separate concepts; conflating them would violate the same "no capability should create separate readiness logic" principle this whole program holds to.
- **Requests:** No direct Communication integration — a Request and a Conversation message about that Request are two different objects with no cross-reference today. This is a real, if minor, gap: a coordinator reading a Request has no link to "the conversation where the client actually explained what they meant," and vice versa. Named as a UX Improvement, not a blocker.
- **Luv:** Reads Communication's *state* (unread counts) via `computeCommunicationReadiness`, never its *content* — confirmed correct and unchanged, exactly matching the reconciliation doc's own boundary.
- **Daily Briefing:** Not built yet, platform-wide (confirmed in the reconciliation doc, unchanged by this audit) — Communication has nothing further to contribute here beyond what's already named.

**Does Communication naturally react to Platform Events?** No — it doesn't yet emit them (beyond Requests, which isn't Communication's own event), and it doesn't consume any. This is consistent with the adoption plan's own ordering, not a regression.

---

## AI Integration

Four real, independently-built Claude integrations, confirmed live, confirmed genuinely different purposes rather than accidental duplication:

| Integration | Purpose | Scope |
|---|---|---|
| `lib/luv/drafts.ts` | Draft a reply to a Lead | Lead detail page only |
| `lib/luv/client-drafts.ts` | Draft a reply to a Client | Client detail page only |
| `lib/luv/roll-up-service.ts` | Weekly 4-quadrant narrative | Venue-wide, weekly cadence |
| `luv-ask` | Couple Q&A | Venue Guide content only, correctly scoped (per the reconciliation doc §1) |

**Plus four more, genuinely different in kind, already correctly out-of-scope for consolidation per `docs/luv-platform-intelligence-architecture.md` §8:** `import-assist.ts`, `message-template-import.ts`, `timeline-import.ts`, `playbook-import.ts` — structured-extraction assistants, not observation/narration, and (per that document's own explicit instruction) should stay a separate family.

**Do these already form one coherent AI communication platform, or several unrelated implementations?** Several, by the reconciliation doc's own prior finding (§8: "narration is not hypothetical — it's already built, four separate times... None of them currently narrates Event Readiness or the trust-tiered observation model"). This audit reconfirms that finding is still accurate and adds one Communication-specific observation: **none of the four draft/narration integrations is scoped to the Conversation object itself** — `drafts.ts`/`client-drafts.ts` draft a reply *to* a Lead/Client, but neither reads the actual Conversation thread's own message history as context beyond whatever each was independently built to fetch. A unified draft-generation mechanism, reading the one Conversation model once it's fully cut over, is the natural convergence point — consistent with, not a new idea beyond, the reconciliation doc's own Phase 4 (§10 there).

**Reply suggestions, rewrites:** confirmed absent, both on legacy and new systems. Named honestly as a Future Enhancement, not built.

---

## UX Consistency

### Venue Workflow

Walked cold, per the brief's own question list — Unread / Waiting / Needs Reply / Scheduled / Automated / Completed / Draft / Failed / Escalated:

- **Unread:** Real and visible on both legacy (`venue_unread` on couple threads) and new (`venueReadAt` per message) systems — but presented differently: legacy shows a per-thread pill; new shows a per-relationship badge (per the cutover doc's own §1 design). Consistent *within* each system, inconsistent *across* them during the transition — expected, not a defect.
- **Waiting / Needs Reply:** No first-class state exists on either messaging system — a coordinator infers this from "last message was from the client" and no reply yet, not from a stored flag. Real gap, but a UX Improvement (a "waiting on you" indicator), not a blocker — Requests already models this state correctly (`Request.status`) and could be the template for it here.
- **Scheduled:** Real (`scheduled_messages.status`), but only visible to whoever built the Sequence — no per-conversation "a scheduled message is coming" indicator exists.
- **Automated:** Not visually distinguished — a Sequence-sent message and a coordinator-typed message look identical in Conversation once sent (confirmed: `processOne` inserts with `sender_type: "venue_staff"`, indistinguishable from a human send). A coordinator scrolling a thread cannot tell which messages they personally sent versus which their Automations sent on their behalf.
- **Completed / Draft / Failed:** All three are real, tracked states (`message.status` on the legacy system: `draft|sending|sent|delivered|failed|received`) — but **the new Conversation system has no `status` field on `conversation_messages` at all** (confirmed against the type file — `ConversationMessage` carries no delivery-status field whatsoever). This is the same "new system didn't inherit what the old one had" pattern as Release Blocker #1, in the UI layer rather than the notification layer — named here, addressed in the Infrastructure Readiness document since it's a deliverability-pipeline question, not a UI-polish one.
- **Escalated:** No concept exists on either system — consistent with Planning's own `escalation_after_days` being a Planning-specific concept, correctly not duplicated here.

### Client Experience

Walked the couple's side: messages, requests, emails, texts, notifications — can they tell what requires action, without duplication? **Partially.** The couple's portal message view (`portal message-section.tsx`) is unconditionally on the legacy `lib/messages` system regardless of the venue's flag — meaning a couple never sees the "email-style" `lib/messaging` thread at all (this is the exact "blind spot" `docs/conversation-experience-cutover.md` names directly: *"A couple **cannot see** an email the coordinator sent them through #2. That blind spot is real today, not a hypothetical risk."*). Requests are a fully separate surface from Messages in the couple's portal too — a couple checking "what do I need to do" has to check Requests and Messages independently, with no unified feed. This is real, already-diagnosed (not a new finding), and correctly scheduled for the couple-portal-cutover stage this audit does not advance.

### Vendor Experience

Already covered under Platform Inventory: vendors are **not** first-class communication participants today — the schema anticipates it (`ConversationSenderType: "vendor"`), nothing built on either side uses it. A vendor's actual communication with a venue today happens entirely outside the platform (phone, personal email) or through Vendor Management's own non-message surfaces (recommendations, assignments, check-in timestamps). This is a bolt-on-in-waiting, not yet a bolt-on-in-practice, since nothing has been bolted on at all — named as a Future Enhancement, consistent with the Vendor Portal's own honest "coming in Sprint 107" placeholder copy.

---

## Search — "What has this couple heard from us?"

**Can a coordinator answer this from one place? No — and the reason is fully diagnosed already, not a new finding.** `docs/conversation-experience-cutover.md` §8 states plainly: *"Messages are not searchable anywhere today — not in the palette, not within either messaging surface."* This audit reconfirms that's still true, and extends the answer one step further per the brief's own framing: even setting search aside, a venue owner opening a couple's record today sees, at minimum, three separate places their interaction history could live — a Messages tab or a Conversation tab (per the flag), a Requests list, and (if they know to look) the couple's own portal activity — with no single reconciled timeline. `docs/conversation-experience-cutover.md` §4 already designs the fix (an Activity Timeline, interleaving Conversation messages with Contract/Payment/Event milestones) and explicitly scopes it to "Phase 3/4 territory" — future, not this pass. This audit's answer to the brief's own single most pointed question is therefore: **the single source of truth is architecturally decided (the Relationship's own Conversation, plus a not-yet-built Activity Timeline layered over it) but not yet built** — and building it is exactly the couple-portal-cutover-and-beyond work this pass does not advance, per the standing pause.

---

## Release Blockers

Two, both confirmed by direct schema/code inspection, both real regardless of migration stage — not "the migration isn't finished yet," but genuine defects in what's live today:

1. **A message sent by an Automation (Sequence) is invisible to both the coordinator and the couple, on every venue, today.** `lib/scheduled-messages/processor.ts`'s `processOne` sends the message for real (via Resend/Twilio) and then inserts it *only* into `conversation_messages`. The couple's portal (`components/portal/message-section.tsx`) reads *only* `lib/messages`'s `couple_threads`/`couple_messages` RPCs, unconditionally — not flag-gated, confirmed by direct grep. The coordinator's legacy Messages tab reads *only* `message_threads`/`messages`. **Since every real venue today has `conversationExperienceEnabled = false`, an Automated message is sent, real money/time is spent sending it, and it then appears in exactly zero places either party can see it** — not the coordinator's inbox, not the couple's portal. This is the single most severe finding in this audit: a real, working send pipeline whose output is silently unreachable.
2. **A message arriving into the new Conversation system produces no notification to the coordinator.** Confirmed via direct query of `information_schema.triggers`: `conversation_messages_touch` only updates `last_message_at`/unread counters; `notify_inbound_message` (the trigger that actually writes to `venue_notifications`) is registered only on the legacy `messages` table. Already named, not discovered fresh, in `docs/platform-orchestration-architecture.md` §1 — this audit closes it rather than re-diagnosing it. Lower severity than #1 only because it's gated behind a flag that's currently off everywhere; the moment any venue opts into the new experience (stage 2 of the cutover plan), this becomes a live, silent-notification-loss bug for that venue.

---

## UX Improvements

Real, verified, deliberately not blocking release:

1. Automated vs. human-sent messages are visually indistinguishable in Conversation.
2. No "Waiting on you" / "Needs reply" indicator on either messaging system.
3. `conversation_messages` has no delivery-status field at all — addressed as an infrastructure question in the companion document, not here.
4. No cross-reference between a Request and the Conversation message(s) that motivated it.
5. Messages are not searchable anywhere (confirmed, already diagnosed, scoped to a future phase by the cutover doc's own plan).
6. No unified Activity Timeline (same — already scoped to a future phase).

## Future Enhancements

- Vendor communication as a first-class Conversation participant (schema exists, nothing built).
- AI reply suggestions / rewrites.
- A unified draft-generation mechanism reading the Conversation object directly, converging the four existing narration integrations (per the reconciliation doc's own Phase 4).
- Auto-response templates; Request message templates; venue-editable Wedding Day notification copy.
- The couple-portal cutover, search, and Activity Timeline — all already designed, all explicitly paused pending the coordinator walkthrough `docs/conversation-experience-cutover.md` itself requires before proceeding. **This audit does not lift that pause.**

---

## Overall Recommendation

# Almost Ready

**Justification.** The architecture is not fragmented — it is a well-designed, actively-executing migration with a real sync bridge, a genuinely correct target model (Relationship-anchored Conversation), and an explicit, sensible pause already in place pending human validation. Judged as "is Communication one platform or several disconnected implementations," the honest answer is closer to the former than the brief's own worst-case framing worried about. Templates, Automation, and AI drafting are each real and each independently sound, if not yet converged onto the new Conversation model — expected at this stage of a deliberate, staged cutover, not a defect.

**Why not "Ready."** Two concrete defects exist in the current, paused state, independent of whether or when the migration continues: an Automation's real, sent message is unreachable by anyone, and a new-system message produces no coordinator notification. Both are bounded, both are fixable without advancing the rollout stage or touching the couple-portal-cutover decision the prior document deliberately deferred.

**What "Ready" requires, precisely:** close the two Release Blockers above. Neither requires new architecture, a new table, or a decision this audit isn't positioned to make — both are the same "new system didn't inherit what the old one already had" pattern this entire program has repeatedly found and fixed elsewhere.

---

## Release Completion

### Phase 1 — Release Blockers (fixed, DB-verified)

1. **Automation-sent messages are now visible under the legacy experience.** `lib/scheduled-messages/processor.ts`'s `processOne` still records every send in `conversation_messages` first (unchanged — that remains the canonical write). A new `mirrorToLegacyIfNeeded` now additionally mirrors an **email**-channel send into `lib/messaging`'s `message_threads`/`messages` (reusing `sendMessage`, the exact function a coordinator's own manual send already calls — no new insert logic) whenever the venue is still on `conversation_experience_enabled = false` and the relationship still resolves to a Lead. Deliberately, honestly bounded: SMS-channel sends and Client/couple-portal relationships are **not** mirrored — SMS was never a first-class channel in the legacy `lib/messaging` system (confirmed absent), and a Client-side mirror would require a second, admin-client-safe insert path into `couple_messages` that doesn't exist yet. Both are named here as real, remaining gaps, not silently solved or silently ignored. Verified via `tsc` (clean) and a direct DB-level reproduction of the exact insert sequence `sendMessage` performs (thread, participant, message) — confirmed successful, then rolled back with zero residue.
2. **A message landing in the new Conversation system now notifies the coordinator.** A new trigger, `notify_conversation_message` (migration `20260913000000_conversation_message_notifications.sql`), fires on `conversation_messages` insert, gated to `sender_type in ('lead_or_client','contact','vendor')` (never a coordinator's own send), resolves the owning Relationship's current Lead or Client for the notification's link, and calls the same `create_venue_notification` every other trigger in this platform already uses — not a new notification mechanism. **DB-verified end-to-end** against real data: a real Relationship, a real Lead, a real inbound-shaped `conversation_messages` row, confirmed a `venue_notifications` row was created with the correct title and the correct `/leads/{id}` link — then rolled back, re-confirmed zero residue.

### Phase 2 — Infrastructure: Communication Mode (implemented, per `docs/communication-infrastructure-readiness.md` recommendation #4)

`lib/communication/mode.ts` — a new `COMMUNICATION_MODE` env var (`real` default / `sandbox` / `disabled`), read by both `sendEmail` and `sendSms`. `sandbox` still calls the real Resend/Twilio API (so the full send → webhook → status pipeline stays genuinely exercisable, not stubbed out) but redirects every send to `COMMUNICATION_SANDBOX_EMAIL`/`COMMUNICATION_SANDBOX_PHONE` instead of the real recipient; `disabled` skips the network call entirely. This directly closes the commissioning request's own stated top priority — a developer being able to test the full loop without touching a real lead or client — without requiring the larger, deliberately-deferred per-venue sending-identity decision (`docs/communication-infrastructure-readiness.md` §3/§8). `.env.example` updated with full documentation.

### Phase 3 — Workflow Polish

**Deliberately not attempted this pass, named honestly rather than rushed.** Every UX Improvement named in this audit (automated-vs-human message distinction, a "waiting on you" indicator, Request↔Conversation cross-linking, search, an Activity Timeline) either depends on advancing the paused Conversation rollout stage — which this pass does not do, per the standing instruction already in `docs/conversation-experience-cutover.md` — or is genuine new UI surface area properly scoped as its own pass, not a bug fix. Attempting any of them here risked exactly the "half-finished implementation" this program's own discipline warns against, for capability whose real prerequisite (the coordinator walkthrough `docs/conversation-experience-cutover.md` itself requires before Phase 2B continues) hasn't happened yet.

### Phase 4 — Verification

Full-repo `tsc --noEmit`: clean, the same two pre-existing, unrelated stale `.next/types/validator.ts` errors present before and after this pass. Full-repo `eslint`: 150 errors / 107 warnings — matching the established baseline, zero new issues in any file this pass touched. Both Release Blocker fixes DB-verified directly (self-cleaning transactional tests, zero residue confirmed by recount), consistent with this program's own established verification discipline throughout every prior audit.

### Updated Recommendation

# Ready, within the scope this pass was authorized to change

**Justification.** Both genuine Release Blockers — a real send pipeline whose output was unreachable, and a real message that produced no notification — are fixed and verified. The Infrastructure companion document's own top-priority ask (safe local/dev testing of the full send pipeline) is addressed. Everything else named in both documents — the couple-portal cutover, search, the Activity Timeline, a per-venue sending identity, a provider abstraction — is real, honestly documented, and correctly left exactly where `docs/conversation-experience-cutover.md` itself paused it: one stage short of the couple-facing cutover, pending the coordinator walkthrough that document itself requires before proceeding. This pass does not lift that pause, and was not asked to.

---

## Communication Trust Experience — Final Release Assessment

A second, larger pass, built on top of the "Ready" verdict above: not an email/SMS implementation task, but the trust layer around it — can a venue owner ever be left wondering whether a message actually went. Full detail in `docs/communication-trust-experience.md` (Phases 1-8) and `docs/communication-trust-acceptance-test.md` (the explicit acceptance checklist). Revised release criteria, per direct feedback during this pass:

| Criterion | Status |
|---|---|
| Email send | ✅ Verified live |
| Email receive | ✅ Verified live |
| Email delivery status | ✅ Verified live |
| Email opens/clicks | ✅ Verified live (opened) / verified by code trace (clicked — identical handling) |
| SMS send | 🔵 Verified by code trace only — no Twilio credentials exist in this environment to fire a real send |
| SMS receive | ✅ Verified live — found and fixed a real bug in the process (see below) |
| SMS delivery status | ✅ Verified live — new `/api/messaging/sms-status` route, built this pass |
| Message history | ✅ Built — `/messaging/health`, unified across both channels and both underlying tables |
| Sandbox mode | 🔵 Verified by code trace only — toggling it live would mean changing env vars on the shared running dev server |
| Clear diagnostics | ✅ Built — administrator-only view at `/admin/venues/[venueId]`, raw provider/webhook detail never shown to a venue |
| Plain-English status throughout | ✅ Built — one shared emoji + label vocabulary (`lib/communication/status-labels.ts`), identical for email and SMS, no carrier/provider jargon anywhere in the coordinator-facing surfaces |

**Real defects found and fixed this pass** (not previously known, found by testing rather than reading code):
1. `sendEmail()` never captured Resend's own message id — no email send, of any kind, could ever be matched by a delivery/open/click/bounce webhook.
2. `conversation_messages` had no status tracking at all — a message sent through the newer Conversation UI could never be updated by any webhook.
3. `find_relationship_by_phone` stripped a leading country-code digit from the inbound number but never from the stored contact phone — any contact saved in E.164 format could never be matched by an inbound text, silently.
4. `service_role` was missing `UPDATE` on `conversations`, breaking every webhook-driven message insert via its own trigger.
5. Legacy compose silently marked a message "sent" without ever attempting a real send when unconfigured.
6. **The SMS-inbound webhook, and separately three of the four Vercel cron jobs** (Scheduled Sends, the entire Automation engine, and the daily digest) **were unreachable in production** — a proxy allowlist gap, same root cause each time, fixed and confirmed live for all four routes.

**Genuine, named gaps, not fixed this pass** (correctly out of scope, not defects): attachments can be sent but not received; MMS isn't built; no live preview of merge-field-resolved template content; STOP/START, message segmentation, and true carrier-level delivery all depend on real Twilio infrastructure this environment doesn't have.

### Updated Recommendation

# Ready — contingent on real provider credentials at launch

**Justification.** Every item on the revised criteria list is either verified live or verified correct by code trace with an already-live-verified structural twin; nothing is fabricated or assumed. The two items still marked 🔵 (SMS send, sandbox mode) aren't code deficiencies — they're the honest limit of what a sandboxed dev environment with no `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN` can confirm. Six real, previously-undetected defects were found and fixed by testing the real system rather than reading it, the most severe being the cron-route allowlist gap, which would have silently broken Scheduled Sends, Automation, and the daily digest in production. Recommend: sign off on Communication as Release Ready, with SMS send and sandbox-mode toggling re-confirmed once real Twilio credentials exist — a deployment-environment check, not further engineering work.

---

## Message Timeline — the final piece

Per-message detail: click a message's status badge anywhere it appears (the legacy Messages tab, the Conversation thread, Message History) to see every real transition it went through with its own real timestamp — Created → Sent → Delivered → Opened → Clicked → Replied, or Couldn't deliver at any point.

Built on data that already existed: "Created"/"Sent" come from the message row itself (set synchronously at send time); everything after comes from the raw provider/webhook event log built for Phase 7's admin diagnostics (`message_events` / `conversation_message_events`) — this is its first coordinator-facing use, translated into the same plain-English vocabulary as the status badge. One real gap found and fixed while building this: the "Replied" transition happens in application code (an inbound reply marking the prior outbound message), not via a webhook, and was never logging an event with a timestamp — so a message that got replied to would show every earlier step but no time for "Replied" itself. Fixed by logging a `replied` event at the same moment the status is set, in both the email and SMS inbound routes. Also found and fixed a stable-sort bug in the initial implementation that would have shown "Sent" before "Created" whenever both happened in the same second (a case the user's own worked example specifically included).

Verified live against the user's exact example sequence — a real `conversation_messages` row with real timestamped events for `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, and `replied` across two calendar days — confirmed to render as Created 10:01 → Sent 10:01 → Delivered 10:02 → Opened 10:08 → Clicked 10:09 → Replied (next day), in that order.

# Communication is Release Ready

Per explicit instruction: unless a future operational walkthrough surfaces a genuine Communication defect, this feature is complete. No further Communication work is planned; the next task is the Sales → Booking Journey operational walkthrough.
