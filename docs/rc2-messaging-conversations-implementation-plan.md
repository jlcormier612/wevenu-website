# RC2 — Messaging & Conversations: Implementation Plan

Governing decisions from the approved assessment (`docs/rc2-messaging-conversations-architecture-assessment.md`):
1. **Vendor conversations are event-anchored.** One Conversation per `event_vendor_assignment`, not per venue↔vendor relationship. The relationship-level view is a **derived rollup query** (`where vendor_relationship_id = X order by event date`) — never a second, independently-writable conversation.
2. **One implementation pass, milestone-checkpointed.** No feature-flag-gated dogfood period. Five milestones, each completed and verified before the next begins: **Coordinator → Couple → Vendor → Search/History → Rollout.**
3. **Legacy retirement is preparation, not deletion.** By the end of RC2: no new code writes to `lib/messages`/`lib/messaging`; every new capability targets Conversations; every remaining legacy read/write path is identified and documented so a future dedicated pass is "delete code," not "investigate what still depends on this."
4. **Both small UX gaps are in scope**: automated-vs-human message distinction, and a derived "waiting on you" indicator.

Standing principle, carried from Commitment Lifecycle and Lead Intake: one canonical model, thin surfaces over it, no parallel implementations of the same fact.

**Stated explicitly, per direct instruction:** RC2's outcome is that every human-to-human communication inside Wevenu has one canonical home. No feature after RC2 may introduce or continue a parallel messaging pattern — the same discipline already held for Relationship, Timeline, Event Order, and the Vendor relationship model now applies to Communication. During implementation, any messaging-shaped surface discovered that wasn't named in the assessment gets folded into RC2 if it's clearly in scope, or explicitly logged as a deferred compatibility surface in the Final Report — never silently left as an undocumented parallel system.

**Conversation as the relationship's paper folder, not just chat.** Opening a Conversation should surface everything related to that relationship in context — attachments, linked Requests, activity, automation history — not a bare message list. Milestone 1 builds a **Relationship Context Panel** alongside the thread (linked Requests, attachment list, recent activity strip) as a lightweight version of this; Milestone 4's Activity Timeline is the fuller expression of the same idea. Both are the same "paper folder" principle at different points in the build, not two separate features.

---

## Milestone 1 — Coordinator Surface

**Goal:** the main-nav Messaging inbox and every Lead/Client/Event detail page's "Conversation" tab become the coordinator's real, complete, daily-use tool on the Conversations model — feature-complete relative to what the two legacy systems currently offer, plus the two named UX gaps.

### 1.1 Attachments on Conversations (closes the one capability gap blocking "complete replacement")

New table `conversation_message_attachments` (mirrors `couple_message_attachments`'s proven shape: file name/type/size, storage path, 20MB limit, restricted MIME allowlist — the tighter of the two existing precedents, not the unrestricted `message_attachments` one). New storage bucket or a scoped path within an existing one. Upload from the compose box; render inline in the thread (image preview / file-icon + name for others), matching the couple-portal chat's existing attachment UX since that's the more polished of the two precedents.

### 1.2 Automated-vs-human message distinction

Real bug, not a missing mechanism: `sender_type` already has a `'system'` value in its own check constraint — `lib/scheduled-messages/processor.ts`'s `processOne` and `lib/tours/communication.ts`'s `sendTourConfirmation` both currently insert with `sender_type: "venue_staff"` (indistinguishable from a human) when they should use `"system"`. Fix both insert call sites. UI: a small "Automated" badge/icon on any message with `sender_type = 'system'`, and — since `channel_metadata` already exists as a jsonb column — tag which Sequence/step produced it (`{ sequenceId, stepId }`) so hovering or clicking explains *why* it was sent, not just that it was automated.

### 1.3 "Waiting on you" indicator

Derived, not stored — matching the "rollup, not synced" discipline just established for vendor conversations. Computed per conversation: last message's `sender_type` is `lead_or_client`/`contact`/`vendor` (not `venue_staff`/`system`) and no later message exists. Surfaced as a small dot/label on the conversation list row, computed in the same query that already builds `ConversationSummary` — no new table, no new trigger.

### 1.4 Relationship Context Panel — the first expression of "conversation as paper folder"

Alongside the thread (not instead of it): a slim panel showing linked Requests (open/recent, from the same Relationship), the attachment list from 1.1 (a filterable "Files" view of the same data, not a separate upload path), and a short recent-activity strip (reusing whatever per-entity activity rows already exist — `lead_activities`/`client_activities` — pending Milestone 4's fuller Timeline). This is deliberately lightweight: no new tables beyond what 1.1 and Milestone 4 already introduce, just a composed read surfaced next to the thread instead of requiring a coordinator to navigate away to find it.

### 1.5 Verification

Coordinator can: see every conversation (couple and — once Milestone 3 lands — vendor) in one inbox, send/receive email/SMS/portal/internal-note/phone-log/voicemail with attachments, tell automated from human sends, see who's waiting on a reply. Spot-check against real data: every message previously only visible in `lib/messaging`'s Lead/Client Messages tab is confirmed present and correctly attributed in Conversations (the forward-sync bridge already guarantees this — confirm, don't assume).

---

## Milestone 2 — Couple Surface

**Goal:** close the "couple can't see an email sent to them" blind spot. The couple portal's Messages tab reads and writes through Conversations instead of `couple_threads`/`couple_messages`.

### 2.1 Data readiness

The forward-sync bridge (`sync_couple_message_to_conversation`) and the one-time backfill (`20260720000000_program2_phase2a_backfill_sync_and_rpcs.sql`) already mean every historical `couple_messages` row is already present in `conversation_messages`, tagged with its legacy origin. This milestone is a **read/write path swap in the portal UI**, not a data migration — verify this assumption directly (row-count and spot-check reconciliation) before relying on it.

### 2.2 Portal UI

`components/portal/message-section.tsx` switches from `/api/portal/messages` (→ `get_portal_messages`/`send_portal_message` RPCs) to the Conversations equivalent, resolved via the couple's own portal-session → Relationship. Attachment upload reuses Milestone 1.1's mechanism. Read-state (`contact_read_at`) already exists on `conversation_messages` — wire "opening the portal marks unread messages read," matching today's couple-chat behavior exactly, per the cutover doc's own design.

### 2.3 Verification

A message sent by a coordinator through any channel (email, portal, SMS) appears in the couple's portal. A message the couple sends in the portal appears in the coordinator's inbox with the correct read state. No history gap versus what the couple could see under the old system.

---

## Milestone 3 — Vendor Surface

**Goal:** vendor conversations exist for the first time — event-anchored, with a relationship-level rollup.

### 3.1 Data model

- Add `conversations.event_vendor_assignment_id uuid references event_vendor_assignments(id) on delete cascade`, unique-indexed where not null (one Conversation per assignment, mirroring the existing `relationship_id` uniqueness pattern exactly).
- Replace the current `conversations_one_anchor` CHECK (`relationship_id` XOR `vendor_relationship_id`) with: exactly one of (`relationship_id`, `event_vendor_assignment_id`) is set. `vendor_relationship_id` stops being an independent anchor and becomes a **denormalized tag**, always populated alongside `event_vendor_assignment_id` (looked up from the assignment's vendor_id + venue_id at provisioning time) — it exists purely so the rollup query can filter by it directly, with no join through Events required. Safe to redefine outright: confirmed zero rows use `vendor_relationship_id` today (nothing has ever written a vendor conversation).
- New `after insert` trigger on `event_vendor_assignments`: provisions the Conversation automatically the same way relationship-anchored conversations already provision on `venue_customer_relationships` insert — a vendor conversation cannot fail to exist once a vendor is assigned to an event, by the same construction guarantee already proven for the couple side.
- Rollup: `select * from conversations where vendor_relationship_id = $1 order by (select event_date from events join event_vendor_assignments ... )` — a plain query, not a new table, callable from both the Vendor Portal (this vendor's history across every venue they work with — scoped per venue) and the venue's own Vendor detail page (this vendor's history across every event at this venue).

### 3.2 Vendor Portal UI

Replace the placeholder (`app/vendor/messages/page.tsx`) with a real inbox: event-grouped list (matching the placeholder's own promised copy — "organized by event, open an event to view and reply"), thread view identical in shape to the coordinator's, `sender_type: 'vendor'` (already modeled, never used) for the vendor's own sends.

### 3.3 Venue-side UI

Within an Event's vendor-assignment view, a "Message [Vendor]" thread inline or one click away. On the Vendor's own detail page, the relationship-level rollup as a read-only history list (event name + date + last-message preview per conversation), each row opening into that event's actual thread — not a separate inbox.

### 3.4 Verification

Assigning a vendor to an event provisions a conversation automatically. A message sent from either side (venue or vendor) appears correctly on the other. The vendor-detail rollup shows every event-conversation for that vendor, correctly ordered, with zero duplicated or independently-diverging data.

---

## Milestone 4 — Search & History

**Goal:** "what has this relationship heard from us" is answerable from one place, for couples and vendors alike.

### 4.1 Activity Timeline

Per the already-designed shape in `docs/conversation-experience-cutover.md` §4 (still sound on review): a read-only tab alongside Conversation on the Relationship/Vendor detail page, interleaving Conversation messages (as compact log-lines, not full bubbles) with Lead/Contract/Payment/Event milestones from the existing per-entity activity tables. Clicking a message line jumps into the Conversation tab at that point. No new schema — a composed read over data that already exists.

### 4.2 Search

Extend the existing `search_global` union (⌘K palette) with a new branch over `conversation_messages`, resolved up to the owning Relationship (or vendor + event, for vendor conversations) before display — per the cutover doc §8's already-sound design: the Relationship/Vendor is the result, matching messages are supporting evidence with snippet highlighting, never independent competing rows. Two entry points, not one box doing both jobs: in-thread search (fast, scoped) and the extended ⌘K palette (cross-relationship).

### 4.3 Two small, related gaps

- **Request ↔ Conversation cross-reference**: a lightweight link (which Relationship/conversation a Request is associated with, already derivable since both anchor to the same Relationship) surfaced as "View conversation" on the Request detail view.
- **`Event.Completed` → review/referral nudge**: wire the Platform Event framework's `Event.Completed` emission (extend the existing wrapper, matching how Requests is already wrapped) to send one templated message (existing Message Templates + Scheduled Sends infrastructure — no new send mechanism) inviting a review/referral, closing the one named gap in the Commitment Lifecycle where a real completion event produces no downstream communication at all today.

### 4.4 Verification

A coordinator can find "who mentioned parking" and land on the right Relationship with the right message highlighted. A Request shows its motivating conversation. A completed event visibly triggers (or clearly shows it's scheduled to trigger) a follow-up message.

---

## Milestone 5 — Rollout & Legacy Deprecation

**Goal:** Conversations is the default and only forward path; legacy systems are inert except as a documented, read-only compatibility surface.

### 5.1 Flip the default

`conversation_experience_enabled` defaults to `true` for new venues; existing venues (verified stable through Milestones 1–4) are switched via a single migration, not a self-serve staged rollout — consistent with the "one pass" decision. No new venue/HQ toggle UI is built for gradual adoption; the flag remains in schema as a real, usable emergency rollback lever, not a staged-adoption mechanism.

### 5.2 Remove now-dead branches

Every `conversationExperienceEnabled ? new : legacy` fork in application code (`app/(app)/messaging/page.tsx`, `lead-detail.tsx`, `event-detail.tsx`, `booking-overview-summary.tsx`, `app/api/messages/unread/route.ts`, `lib/readiness/compute.ts`, `lib/luv/observations.ts`) collapses to the single Conversations path. `lib/messages/notify.ts`'s raw-fetch email-notify becomes fully dead once the couple portal (Milestone 2) no longer calls the couple-chat send path that triggers it — confirmed dead, then deleted, not left dormant.

### 5.3 Mark legacy modules as compatibility-only

`lib/messages/*` and `lib/messaging/*` get a clear header comment: **read-only compatibility surface, retained for historical data only — no new feature may write to these tables; all new communication work targets `lib/conversations`.** The forward-sync triggers keeping them current become unnecessary the moment nothing reads them anymore for a day-to-day workflow — left in place (harmless, cheap) rather than removed, since a future retirement pass removing the legacy tables removes the triggers in the same motion.

### 5.4 Document the remaining read/write inventory

A short, explicit list (in this same doc's Final Report) of every remaining place that still touches `message_threads`/`messages`/`couple_threads`/`couple_messages` directly, so a future retirement pass is a deletion checklist, not a rediscovery project.

### 5.5 Verification

Every venue (confirmed via query, not sampling) has `conversation_experience_enabled = true`. Full grep sweep confirms no new-in-RC2 code path writes to a legacy table directly (only the pre-existing sync triggers do). `tsc`/build clean after the dead-branch removal.

---

## Cross-cutting notes

- **Performance**: no index/scale work beyond what Milestone 4's search branch needs (a trigram or full-text index on `conversation_messages.body`) — confirmed not a present risk at this data volume.
- **Templates/Sequences**: untouched — already correctly target Conversations, already exclude "portal" as a channel by omission (the one gap the prior docs flagged), no change needed for either couple or vendor conversations.
- **AI/Luv**: a unified draft mechanism reading the Conversation object directly is named in the assessment as the natural next step but is **not** part of RC2 — flagged as a future initiative, consistent with the release-readiness audit's own placement of it.

## Verification plan (whole initiative)

- `tsc --noEmit` + `npm run build` clean after each milestone, not just at the end.
- Full local migration replay from empty, given this milestone includes real schema changes to `conversations`' anchor constraint.
- Direct functional tests per milestone (per each milestone's own §verification above) against real data, not just migration success.
- A final repo-wide grep for direct legacy-table reads/writes, cross-checked against the Milestone 5.4 inventory.

## Explicitly not in this pass

- Full deletion of legacy tables/sync triggers (a dedicated future retirement pass, per your decision).
- A self-serve staged-rollout toggle UI (not needed under the "one pass" decision).
- A unified Luv draft-generation mechanism reading Conversations directly.
- Reply suggestions / rewrites.
- True push notifications (still requires a PWA/native app decision, unrelated to this initiative).
