# Luv — Platform Intelligence Architecture

**Status:** Documentation and planning only. No application code, UI, or database schema is introduced by this document. It is the implementation plan to be executed in later, separately-scoped phases.
**Read first:** `docs/wedding-workspace-architecture.md`, `docs/client-workspace-collaboration-architecture.md`, `docs/floor-plan-seating-architecture.md`. `docs/platform-workspace-architecture.md` does not exist in this repository at the time of writing — this document proceeds without it (noted as a gap, not silently assumed).
**Also grounded in:** `docs/domain-model.md` (§"Luv Observation") and `docs/architecture-audit.md` (§"LUV") — both already contain a verified, current account of Luv's actual implementation state, which this document treats as ground truth rather than re-deriving.

**Product Philosophy, stated once, governing every section below:** Luv is not another feature — it is the operational intelligence layer that observes the existing platform. Every feature contributes information; no feature is owned by Luv; Luv never becomes the system of record. Luv explains. Luv prioritizes. Luv guides. Luv celebrates. Luv never automatically changes customer data.

---

## 0. Where Luv actually stands today (read this before anything else)

This document's job is to plan Luv's *next* architecture. It cannot do that honestly without first stating, plainly, what already exists — and what exists is considerably larger, and considerably more broken in one specific place, than a first pass at this research suggested. Corrected against a full inventory of `lib/luv/` (21 files), every migration that created a Luv-related table, and every live call site:

- **A genuinely working, stateless layer exists — and it's bigger than "two files."** `lib/luv/observations.ts` (the venue dashboard's "Notice" engine, ~800 lines, queries ~15 tables in parallel) and `lib/luv/portal-observations.ts` (couple-portal-facing: guest, seating, budget, payment, overview, countdown, wedding-day, anniversary observations) compute fresh on every page load, directly from tables every other feature already owns. No persistence, no staleness risk, no bug reported against either. This is the layer this document builds forward from.
- **A DB-backed "learned" layer exists, is extensively engineered, is live-wired into a real UI — and is currently non-functional at the data layer.** Seven dedicated tables (`luv_settings`, `luv_drafts`, `luv_memories`, `luv_insights`, `luv_recommendations`, `luv_actions`/`luv_action_outcomes`, `luv_rollups`), each with real service modules (`memory-service.ts`, `insights-service.ts`, `recommendation-service.ts`, `health-service.ts`, `action-service.ts`, `trends-service.ts`, `roll-up-service.ts`) and real RPCs, all wired live into `components/dashboard/luv-widget.tsx` ("What Luv noticed today," rendered on every coordinator's dashboard load, up to 7 stacked sections plus a recommendations panel). Per `docs/architecture-audit.md`, most of the SQL functions backing this layer select from `venue_users` — a table never created in any migration (a later migration's own comment admits it) — and throw on every invocation; every caller swallows the error as `if (error || !data) return null`. The practical effect: a large, real, well-structured system that presents identically to "no data yet" for every venue, indistinguishable from an empty state unless someone traces the SQL against the live schema. This is a materially different — and more consequential — finding than "a small broken stub": it is significant engineering investment, invisible, hidden behind graceful-looking empty states. `get_venue_trends()` (feeding "Story Mode") independently references a nonexistent table/column and has, per the audit, never worked.
- **Genuine duplication is narrower than "four reimplementations" — exactly two.** The couple portal's Luv-facing code (`portal-observations.ts`, `luv-ask`) is *not* a duplicate engine — `portal-observations.ts` is a correctly-shared module living inside `lib/luv/` itself, and `luv-ask` (§1, Communication note below) is a distinct, narrowly-scoped Q&A feature, not a reimplementation of the observation engine. The two genuine, disconnected duplicates are: **Wevenu HQ's `LuvInsights`** (`components/hq/venue-detail/luv-insights.tsx`) — which, notably, documents its own simplification honestly in its own header comment ("v1: a rules-based 'why' narrative... wiring the full Luv observation engine... is a deliberate future hook, not built in this pass"), so this is a known, intentional stand-in, not an accidental fork — and **the Vendor Portal's `computeLuvData()`** (`app/vendor/luv/page.tsx`), which derives its own wins/observations directly from vendor dashboard data with zero imports from `lib/luv/*`, a genuine accidental fork with no self-documented justification.
- **Luv already spans all three portals, non-trivially.** Beyond the coordinator dashboard: a coordinator-facing settings surface (`components/settings/luv-settings-section.tsx` — toggles `observationsEnabled`/`draftingEnabled`/`autonomyLevel`/`preferredTone`), lead-detail draft generation (`LuvDraftPanel`, `LeadMomentumCard`), and — separately from the "notice" engine entirely — four Claude-backed "transcribe pasted content into structured data" assistants (`import-assist.ts`, `message-template-import.ts`, `timeline-import.ts`, `playbook-import.ts`) that share the Anthropic integration pattern and the Luv brand but are a genuinely different product feature (content transcription, not observation) and are explicitly out of this document's consolidation scope (§9) for that reason.
- **Exactly one component subtree is dead**, confirmed independently: `components/clients/client-detail.tsx` → `LuvClientPanel` → `LuvEventBriefing`, plus the client-side of `lib/luv/event-readiness.ts` and `app/(app)/clients/[id]/luv-client-actions.ts`. `client-detail.tsx` itself is imported nowhere; the live route (`app/(app)/clients/[id]/page.tsx`) renders `EventDetail` and the current `lib/readiness/compute.ts`, not this chain. "Story Mode" (`computeStoryMode()` in `trends-service.ts`) is fully built and styled but silently renders nothing, for the same `get_venue_trends()` reason above.

**What this means for this document:** Phase 1 of the plan below (§9) is explicitly a *consolidation and repair*, not a new build — one engine, absorbing HQ's and the Vendor Portal's genuine forks, with the much-larger-than-assumed DB-backed layer repaired against the real schema (not retired outright — the engineering investment described above is real and worth recovering) before anything past it is trusted. Any design in this document that assumes "Luv" is a small or a single coherent system today would be building on a fiction. It is neither, yet.

---

## 1. What Luv observes, feature by feature

For each capability, this section identifies: meaningful state, completion, blocked conditions, risks, opportunities, and celebration-worthy moments. Every field named here is one that already exists in a completed feature — this section adds no new columns, no new tables, no new computed metrics beyond what a feature already tracks or what Event Readiness (`lib/readiness/compute.ts`) already derives from it.

Where a capability already has an Event Readiness section (`lib/readiness/compute.ts`), this section explicitly says so and does not re-derive the same status — see §5 for why that distinction matters structurally, not just editorially.

### Planning (Playbooks / Tasks)

- **Meaningful state:** `EventTask.status` (`pending`/`blocked`/`overdue`/`complete`/`waived`), `isRequired`, `ownerType` (`coordinator` vs `couple`), `EventReadiness` (`lib/playbooks/types.ts`) — `completedRequired`/`totalRequired`, `blockedCount`, `overdueCount`, computed independently for Client Planning and Venue Planning (deliberately never merged, per `lib/playbooks/repository.ts`'s own "Planning Experience Review" comment).
- **Completion:** `completedRequired === totalRequired` for either kind.
- **Blocked:** `status = 'blocked'` — a task waiting on something outside itself (already a first-class status, not inferred).
- **Risk:** `overdueCount > 0`; a required task not moving while its due date passes.
- **Opportunity:** a task with a linked Request (`event_tasks.request_id`) sitting `submitted`/`reviewed` — the venue's own action is the only thing standing between "in progress" and "complete."
- **Celebration:** Venue Planning or Client Planning reaching 100% required completion for the first time.
- **Already summarized by Event Readiness:** yes (`computePlanningReadiness`). Luv should *reference* that section's status, not recompute it.

### Timeline

- **Meaningful state:** `TimelineEntry.status` (`not_started`/`in_progress`/`complete`), `entryTime`, `audiences` (which of internal/couple/guest/vendor/public a row is tagged for), `sectionId`.
- **Completion:** every entry `status = 'complete'`.
- **Blocked:** no first-class blocked concept exists on Timeline today — do not invent one (§7 makes this a "needs additional state" item, not an inference to paper over).
- **Risk:** a large share of entries still `not_started` as the event date approaches (the *proximity* half of this observation is new — see §7, Timeline does not track this itself).
- **Opportunity:** a `clientCanAdd` section with zero entries — the couple has an open invitation to contribute that hasn't been taken up.
- **Celebration:** the full day-of schedule reaching 100% complete.
- **Already summarized by Event Readiness:** yes (`computeTimelineReadiness`).

### Guests

- **Meaningful state:** `couple_guests.rsvp_status` (`pending`/`attending`/`declined`/`maybe`), `invitation_status` (`draft`/`ready`/`sent`/`delivered`/`opened`/`responded`/`declined` — the couple's own withdrawal state, distinct from `rsvp_status`), household linkage, `dietary_tags`/`accessibility_tags`.
- **Completion:** every invited guest (`invitation_status` not `draft`/`ready`) has responded.
- **Blocked:** not a blockable capability — there is no "blocked guest."
- **Risk:** invitations sent with a large "outstanding" bucket (`sent`/`delivered`/`opened`, no reply) as the wedding approaches.
- **Opportunity:** guests still in `draft`/`ready` this close to the date — a nudge to actually send invitations, not just have entered names.
- **Celebration:** "guest list finalized" — every invited guest has responded (a genuine operational event, not a vague milestone; see §2).
- **Already summarized by Event Readiness:** yes (`computeGuestsReadiness`, via the new `lib/guests/service.ts` aggregate query this phase added).

### Seating

*(Note on sourcing: `docs/wedding-workspace-architecture.md` §7 — one of this document's required "read first" sources — still describes Seating as a disconnected 1200×800-canvas system with its own `seating_tables`/`couple_seating_arrangements` tables. That section is stale; it predates Seating Experience Phase 1, which retired that system entirely in favor of tables read live from Floor Plans. `docs/floor-plan-seating-architecture.md`'s own "Status" line already reflects this. The observations below are grounded in the current, built architecture, not §7's text — flagged here rather than silently diverging from a cited source.)*

- **Meaningful state:** `get_seating_data`'s own `stats` (`totalAttending`, `totalAssigned`, `tableCount`, `totalCapacity`) plus `needsReassignment` (guests whose table was deleted out from under them) and whether a Floor Plan has been shared (`floor_plans.client_access != 'hidden'`).
- **Completion:** `totalAssigned === totalAttending` and `needsReassignment.length === 0`.
- **Blocked:** no Floor Plan shared yet — Seating cannot meaningfully begin (this is a real block, not a soft risk: the couple has nothing to seat guests *at*).
- **Risk:** `needsReassignment.length > 0` — an operationally real, time-sensitive condition (a table vanished under an already-made seating decision).
- **Opportunity:** an unassigned household sitting in `get_seating_suggestions`'s own household-grouping output — Luv can point at a specific, already-computed suggestion, never invent its own.
- **Celebration:** "seating approved" (see §2) — everyone seated, zero `needsReassignment`.
- **Already summarized by Event Readiness:** yes (`computeSeatingReadiness`, via `lib/seating/service.ts`, which itself reuses the couple's own `get_seating_data(p_token)` RPC rather than inventing a second query path — see that file's own comment for why).

### Floor Plans

- **Meaningful state:** `floor_plans.client_access` (`edit`/`view`/`hidden`), object count/type, `floor_plan_objects.capacity`, Inventory Usage (`getUsageForEvent`, `quantityAvailable - quantityUsed`).
- **Completion:** at least one Floor Plan exists and is shared (`client_access != 'hidden'`); relevant when Seating is in scope for the booking.
- **Blocked:** not blockable by anything upstream.
- **Risk:** `quantityAvailable - quantityUsed < 0` on any placed item — genuinely over-committed inventory for this room.
- **Opportunity:** a Floor Plan Template applied but never customized — low-effort personalization still on the table.
- **Celebration:** the moment a Floor Plan is first shared with the couple — it's the exact event that unblocks Seating (§2's "floor plan shared").
- **Already summarized by Event Readiness:** yes (`computeFloorPlansReadiness`).

### Inventory

- **Meaningful state:** `InventoryItem.quantityAvailable`, `isArchived` (the only state flag — no draft/pending state exists), `availableForFloorPlans` (gates palette visibility, not a stock constraint), `InventoryUsage` (`quantityAvailable` vs. `quantityUsed`) — confirmed read-only reporting scoped to one booking's Floor Plans, not a venue-wide stock ledger.
- **Completion:** not a meaningful concept at the Inventory-item level — items don't have a lifecycle to complete.
- **Blocked:** none.
- **Risk:** the same per-Floor-Plan over-allocation Event Readiness already surfaces (`quantityAvailable - quantityUsed < 0`) — confirmed as Inventory's only existing risk signal. **No low-stock or reorder concept exists anywhere in `lib/inventory/`** — confirmed by direct inspection, not inferred; do not have Luv imply one exists.
- **Opportunity:** none beyond what Floor Plans already surfaces.
- **Celebration:** none.
- **Already summarized by Event Readiness:** yes, exactly the per-booking over-allocation signal, nothing more (`computeFloorPlansReadiness`). A venue-wide "you're double-booked on round tables across two events next month" observation is **not buildable today** — it would require a genuinely new cross-event aggregation function (not a new table; `InventoryUsage`'s own shape generalizes cleanly) — named in §7 as the one real gap here.

### Requests

- **Meaningful state:** `Request.status` (`draft`/`sent`/`viewed`/`in_progress`/`submitted`/`reviewed`/`completed`/`cancelled`), `dueDate`, `visibility` (`venue_only`/`shared`/`completed`), `requestType`.
- **Completion:** `status = 'completed'`.
- **Blocked:** none — Requests has no first-class blocked state distinct from its own status enum, and `request_summary_card.tsx`'s own bucketing (waiting on client / submitted for review / overdue) is the one existing, reusable split.
- **Risk:** `dueDate` passed and `status` not in `completed`/`cancelled` (already computed by `computeRequestsReadiness`).
- **Opportunity:** `submitted`/`reviewed` — the client has already acted; the venue's own review is the only remaining step, and it's a fast one.
- **Celebration:** "request submitted" (§2) when the couple moves a request to `submitted` — a real state transition, not a vague nudge.
- **Already summarized by Event Readiness:** yes (`computeRequestsReadiness`).

### Communication (Conversations / legacy Messaging)

- **Meaningful state:** for the new Conversation experience, `ConversationMessage.senderType`/`venueReadAt`; for legacy threads, `MessageThread.messageCount` only (no read-state exists on that path, and neither should Luv invent one — `booking-overview-summary.tsx` and `computeCommunicationReadiness` both already made this same explicit choice).
- **Completion:** not a "completable" capability in the way Planning/Timeline are — its meaningful state is closer to "caught up" (zero unread from the client) vs. "needs a reply."
- **Blocked:** none.
- **Risk:** unread-from-client count growing while the wedding date approaches.
- **Opportunity:** none distinct from "reply" — Communication doesn't have a suggestion-shaped opportunity the way Seating or Requests do.
- **Celebration:** none meaningful — replying to a message isn't a milestone worth marking (§3 explicitly keeps Luv's celebration vocabulary to real, one-time operational events, not routine upkeep).
- **Already summarized by Event Readiness:** yes (`computeCommunicationReadiness`).

### Contracts

- **Meaningful state:** `Contract.status` (`draft`/`sent`/`signed`/`cancelled`/`expired`), `sentAt`, `signedAt`, `expiresAt`.
- **Completion:** `status = 'signed'`.
- **Blocked:** none first-class; a contract sitting `draft` past a point where it should have been sent is a risk, not a block (nothing else is waiting *on* it structurally the way a Floor Plan blocks Seating).
- **Risk:** `status = 'expired'`, or `draft` with no `sentAt` this close to the event.
- **Opportunity:** none beyond "send it" — Contracts is a linear lifecycle, not a suggestion-shaped domain.
- **Celebration:** "contract signed" (§2) — one of the cleanest, most universally-recognized operational milestones in the whole platform.
- **Already summarized by Event Readiness:** yes (`computeContractsReadiness`).

### Payments

- **Meaningful state:** `Invoice.status` (`draft`/`sent`/`paid`/`void`), `balanceDue`, `dueDate`.
- **Completion:** `balanceDue === 0` across all invoices for the booking.
- **Blocked:** none.
- **Risk:** `balanceDue > 0` and `dueDate` passed (already computed by `computePaymentsReadiness`).
- **Opportunity:** none suggestion-shaped — Payments is fact-reporting, not recommendation-shaped (this document deliberately does not propose a "Luv nudges the couple to pay" feature — see §6, that would blur fact and inference in the platform's most sensitive domain).
- **Celebration:** "final payment received" (§2) — `balanceDue` reaching `0` for the first time on the invoice covering the event date.
- **Already summarized by Event Readiness:** yes (`computePaymentsReadiness`).

### Documents

- **Meaningful state:** `Document.expiresAt`, category, and (separately) `couple_documents.share_with_venue`.
- **Completion:** not a single-point concept — closer to "nothing expiring or expired" than "all documents present," since there is no first-class "required documents" list anywhere in the schema (do not invent one; see §7).
- **Blocked:** none.
- **Risk:** `expiresAt` passed (expired) or within 30 days (expiring soon) — the exact two-tier check `computeDocumentsReadiness` already uses.
- **Opportunity:** a `couple_documents` row with `share_with_venue = false` sitting unshared — a document the couple uploaded that the venue may not know exists yet (needs confirmation this is a meaningful signal and not just how the couple prefers to keep something private — see §7).
- **Celebration:** none distinct from Contracts/Payments' own milestones — Documents doesn't have its own celebration-worthy event.
- **Already summarized by Event Readiness:** yes (`computeDocumentsReadiness`).

### Calendar

- **Meaningful state:** `getCalendarData(year, month)` (`lib/calendar/service.ts`) — confirmed venue-wide, month-scoped, aggregating exactly seven source tables: `events`, `tour_appointments` (via `getTourCalendarEntries()`, the canonical source, explicitly replacing a legacy `leads.tour_date` read that silently missed publicly-booked tours), `leads.follow_up_date`, `payment_line_items` (`pending`/`overdue`, joined through `payment_schedules`), `client_key_dates`, `date_holds` (`active`, `expires_at`-checked), `calendar_blocks` (with recurrence expansion).
- **Completion:** not a completable concept — Calendar is a lens over other capabilities' own dates, not its own lifecycle.
- **Blocked/Risk/Opportunity:** none of its own — every risk here already belongs to the capability the date comes from (a `date_hold` expiring is a Pipeline concern wearing a calendar date, not a new Calendar-owned risk).
- **Celebration:** none of its own.
- **Already summarized by Event Readiness:** no — confirmed not a per-booking concept (`lib/readiness/compute.ts`'s own decision not to build a Calendar section was correct and this research confirms why). Calendar-facing observations belong to the **Daily Briefing** (§4) instead — "3 tour appointments today," "a hold expires this week with no follow-up booked" — but `getCalendarData` is month-scoped only; no same-day/this-week filtered query exists yet (§7 names this as the one small gap).

### Website

- **Meaningful state:** `CoupleWebsite` (`lib/wedding-website/types.ts`): `isPublished`, `hasPassword`, `theme`/`themePalette`/`accentColor`/`fontPairing`, `sectionsEnabled: WebsiteSection[]` (13 possible sections), `scheduleSync` (live Timeline integration), `sectionOrder`. The public-facing read shape separately carries `totalViews` and `rsvpStats`.
- **Completion:** closer to "published" (boolean) than a percentage — **no formal completion-score field exists on `CoupleWebsite` itself.**
- **Blocked/Risk:** none first-class.
- **Opportunity:** an unpublished site as the wedding approaches.
- **Celebration:** first publish.
- **A real, worth-naming instance of exactly the anti-pattern this document argues against:** `lib/luv/observations.ts` **already computes its own ad hoc Website completeness heuristic** (`!site.is_published && daysUntil <= 120`, `site.is_published && !site.content?.travel`) — i.e., Luv today invents a two-point completeness check that Website itself doesn't own or expose as a first-class concept. This is precisely the "no capability should create separate readiness logic" violation, just already present in Luv's own code rather than a new one this document would introduce. §7 recommends extracting this into a small, Website-owned function (mirroring `computeFloorPlansReadiness`'s shape) rather than leaving the logic embedded in Luv's file.
- **Already summarized by Event Readiness:** no — Website has no Event Readiness section today (out of this document's authority to add; noted as a candidate for whoever owns Event Readiness next).
- **Separately, a known existing bug worth not repeating:** `WeddingJourneySection`'s own milestone map hardcodes `website: false` regardless of `is_published` (`docs/wedding-workspace-architecture.md` §16) — Luv must read `is_published` directly, never inherit that dashboard's already-known-wrong shortcut.

### Vendor Management

- **Meaningful state:** `EventVendorRecommendation` (`recommendedAt`, `selectedAt: string | null` — no decline state exists, by explicit design per the type's own comment); `EventVendorAssignment` (`arrivalTime`, `checkedInAt: string | null`, `setupCompleteAt: string | null` — **no explicit boolean "confirmed" field; day-of state is inferred from these two timestamps**, added in the "wedding-day-ops" migration).
- **Completion:** for Recommendations, `selectedAt` set. For day-of Assignments, all of an event's assignments having `checkedInAt` (arrived) and, further along, `setupCompleteAt` (ready).
- **Blocked:** none first-class.
- **Risk:** an assignment with an `arrivalTime` in the past and no `checkedInAt` — a real, already-timestamped signal, not an inference Luv would need to invent.
- **Opportunity:** none beyond "review the recommendation."
- **Celebration:** "vendor accepted" (§2) — `selectedAt` set, first time.
- **Already summarized by Event Readiness:** no — Vendor Management has no Event Readiness section today. Unlike this document's first-pass assumption, the day-of confirmation data **already exists** (`checkedInAt`/`setupCompleteAt`) — what's missing is only a small aggregation ("N of M vendors checked in"), not new tracking (§7 corrects the earlier "unconnected to any readiness layer" framing to "connectable today, just not yet aggregated").

### Pipelines / Leads

- **Meaningful state:** `Lead.status` (`new`/`contacted`/`qualified`/`proposal_sent`/`won`/`lost`/`cancelled`), plus three independently-persisted, already-computed scores: `commitmentScore` (0–100, monotonic, milestone-based — tour scheduled, contract signed, payment made, etc.), `responsivenessScore` (0–100, decays with silence), `interestScore` (0–100, time-decayed behavioral signal events) — all refreshed on every dashboard load via `refreshAllLeadScores()`. Separately, `PipelineTemplate`/`PipelineStage` carry a coordinator-configured `probability` (0–100) per custom stage — a static weight, not a computed score.
- **Completion:** `status = 'won'` (booked) — out of Leads/Pipeline scope entirely once a Client/Event exists (this capability is pre-client by definition).
- **Blocked:** none first-class.
- **Risk:** `follow_up_date` today or overdue with `status` still active — **already read directly by `lib/luv/observations.ts` today** (flags `new` leads >48h old with no `follow_up_date` set at all).
- **Opportunity:** a lead whose `responsivenessScore` is dropping while `commitmentScore` stays high — a real, inference-tier (§6) correlation across two already-persisted Facts, not a new score.
- **Celebration:** none named in §2 (Leads/Pipeline precedes any Event) — a natural candidate for a future addition once this document's scope extends past per-Event operational readiness.
- **The important structural point:** Leads' three scores are **the Pipeline's own direct analog to Event Readiness** — a feature-native, already-computed, already-Luv-consumed metric. Luv must read `commitmentScore`/`responsivenessScore`/`interestScore` as Facts and never recompute them a second way, for exactly the reason §5 gives for Event Readiness — this is the second concrete instance of that same principle in this platform, not a new one.
- **Already summarized by Event Readiness:** not applicable (pre-Event) — but effectively already "Luv-ready" today, more so than most capabilities in this document, since `lib/luv/observations.ts` already reads these fields directly.

### Automation (Notifications, Message Sequences)

- **Meaningful state — Notifications:** `notification_log` (`NotificationLogEntry`: `status: sent|delivered|failed|bounced`, `sentAt`, `deliveredAt`, `providerMessageId`) and `getNotificationStats()` (`pendingReminders`, `sentLast24h`, `failedLast24h`, `lastProcessedAt`) — both real, queryable today.
- **Meaningful state — Message Sequences:** `MessageSequence.status: active|paused`, `SequenceEnrollment.status: active|completed|exited_reply|exited_booking|cancelled` — both real, persisted, queryable columns; auto-exit already fires on booking and on reply.
- **Completion:** not a completable concept for either — Notifications is a running log, Sequences are an ongoing enrollment state machine.
- **Blocked:** none.
- **Risk — a real, confirmed gap, not an inference to fake:** `NotificationLogEntry` has **no `openedAt`/`clickedAt` field anywhere** — Luv can honestly say a reminder was *sent*, never that it was *opened*. Do not imply open-tracking exists.
- **Risk (Sequences):** `failedLast24h > 0`, or a paused sequence a coordinator may have forgotten about.
- **Opportunity:** none beyond the sequence/notification's own next scheduled step.
- **Celebration:** none.
- **Already summarized by Event Readiness:** no — Automation is not per-Event; it belongs in the Daily Briefing (§4), and both `getNotificationStats()` and a simple `count(status='active')` over Message Sequences are already-existing or trivially-added aggregate reads, not new tracking (§7).

---

## 2. Operational Events — Luv's vocabulary

These are the moments worth naming, each tied to one specific, unambiguous state transition already computable from existing data — never a vague milestone, never something requiring new tracking:

| Event | Trigger (existing field) |
|---|---|
| Floor plan shared | `floor_plans.client_access` transitions away from `'hidden'` |
| Seating approved | `get_seating_data.stats.totalAssigned === totalAttending` and `needsReassignment.length === 0`, first time |
| Guest list finalized | every guest's `invitation_status` leaves `sent`/`delivered`/`opened` (all responded), first time |
| Timeline completed | every `TimelineEntry.status === 'complete'`, first time |
| Contract signed | `Contract.status` transitions to `'signed'` |
| Final payment received | the invoice covering the event date reaches `balanceDue === 0`, first time |
| Request submitted | `Request.status` transitions to `'submitted'` |
| Request completed | `Request.status` transitions to `'completed'` |
| Vendor accepted | `EventVendorRecommendation.selected_at` is set, first time |
| Document uploaded | new `Document`/`couple_documents` row created |
| Planning milestone | Client or Venue `EventReadiness.completedRequired === totalRequired`, first time, per kind |

Every one of these is a **transition**, not a snapshot — Luv needs to know "this just became true," which requires comparing current computed state against the last-observed state (§9 names this as the one piece of new, genuinely-Luv-owned persistence this architecture requires: not a copy of the data, a record of *what Luv has already said*).

---

## 3. Observation Categories

| Category | What belongs here | What does *not* belong here |
|---|---|---|
| **Facts** | A direct, unadorned read of existing state: "11 of 14 guests seated." Never interpreted. | Anything requiring inference or a threshold Luv itself invented. |
| **Risks** | A fact plus an existing, feature-native threshold already crossed: overdue, expired, over-capacity, blocked. Every risk in §1 traces to a real enum value or comparison a feature already makes. | A risk based on a threshold Luv invents with no feature backing (e.g., "guests usually respond within 2 weeks" — that's a pattern claim, and this document explicitly defers all pattern-based claims to a future phase with its own confidence-scoring design, not this one). |
| **Suggestions** | A pointer at an action already possible in the product, already reachable in one click: "3 unassigned guests belong to a household you haven't seated yet" (linking to Seating's own `get_seating_suggestions`, not a new suggestion engine). | Anything Luv would perform automatically. Per Product Philosophy, Luv never automatically changes customer data — a suggestion is always a link, never an action taken on the coordinator's or couple's behalf. |
| **Celebrations** | One of the operational events in §2, the first time it becomes true. | Routine upkeep (replying to a message, adding one guest) — not milestone-shaped, per §1's Communication section. |
| **Waiting** | State that depends on someone else's next action and has no due date yet: a Request `sent` but not yet `viewed`, an invitation `sent` but not yet opened. | A `not_started` state — Not Started means nothing has begun; Waiting means something has begun and is now pending on the other party. |
| **Upcoming** | Date-relative facts computed from the event's own date (already available everywhere): "wedding is in 12 days," "final payment due in 5 days." | Predictions about what *will* happen — Upcoming only ever states a known date, never forecasts an outcome. |
| **Completed** | The terminal, already-computed state for a capability: `signed`, `paid`, `complete`, `100%`. | A near-complete state ("almost done") — that belongs in Facts or Waiting, not Completed, since Completed must always mean the same thing everywhere: nothing left to do. |

These map directly onto `ReadinessStatus` (`lib/readiness/types.ts`) but are not identical to it — Event Readiness has exactly four statuses per section; Luv's categories are a richer vocabulary *for the same underlying facts*, because Luv narrates in sentences, Event Readiness renders in badges. §5 draws this line precisely.

---

## 4. Daily Briefing — information architecture (not UI)

If a venue owner opens Wevenu on a Monday morning, in priority order, Luv should be able to answer:

1. **What needs me right now, today, across every booking?** — the union of every booking's `needs_attention`-status Event Readiness sections (§5), plus venue-wide Requests `submitted`/`reviewed` and overdue Payments, sorted by event date proximity, not alphabetically or by client name. This is a fan-out of the same per-event logic Event Readiness already computes — the Daily Briefing does not invent a second calculation, it aggregates the first one across every active booking a coordinator owns.
2. **What's coming up this week?** — Calendar's own aggregation (tour appointments, holds expiring, upcoming events) plus any booking whose event date crosses a "wedding is in N days" threshold worth surfacing (7/14/30 — thresholds a future phase should define once, shared, not per-feature).
3. **What got resolved since I last looked?** — Celebrations (§2, §3) that fired since the last briefing, using the "compare against last-observed state" mechanism named in §2/§9. This is the one place genuinely new persistence is required — not because Luv needs a copy of the underlying data (it never does), but because "since I last looked" is a fact about *Luv's own prior observations*, which no feature table tracks on Luv's behalf.
4. **What's just informational?** — Facts and Upcoming items not urgent enough for #1, available on demand rather than pushed to the top.

Prioritization is **not** a Luv-invented scoring model in this phase — it's `needs_attention > waiting > not_started > complete`, the exact same ordering `lib/readiness/compute.ts` already uses per booking, fanned out venue-wide and then sorted by date proximity as the one additional, deliberately simple tiebreaker. A confidence-scored, learned prioritization model is explicitly deferred to §8/Future AI, not designed here.

---

## 5. Event Readiness Relationship — no duplicate responsibilities

**Event Readiness summarizes. Luv interprets.** Precisely:

- Event Readiness (`lib/readiness/compute.ts`) is the single source of truth for **what state a booking is in**, per capability, right now — four statuses, sorted, no narrative, no memory of what it said yesterday.
- Luv **never recomputes a status Event Readiness already owns.** Every capability section in §1 that says "Already summarized by Event Readiness: yes" means exactly that: Luv reads `ReadinessSection.status`/`detail`/`metric` as an input and narrates around it — it does not re-derive "is Seating complete" from raw `guest_seat_assignments` data a second time. Two engines computing the same fact from the same tables is exactly the duplicated-responsibility failure this document exists to prevent (and exactly the shape of Luv's own current fragmentation problem, §0 — this document does not want to reproduce it one layer up).
- What Luv adds that Event Readiness structurally cannot: **narrative, cross-capability correlation, and memory.** Event Readiness cannot say "Seating is waiting because the household you haven't seated is the same one whose RSVP just came in yesterday" — that requires reading two capabilities' facts together and knowing what changed since last time. That correlation is Luv's job specifically because it does not belong inside any single feature's own readiness logic (per the Guiding Philosophy: "no capability should create separate readiness logic").
- Where the two surfaces meet: the Event Readiness card (`components/events/event-readiness-card.tsx`) is exactly the kind of place a future Luv summary line could sit *above* — "Luv: focus on Seating and Payments this week" — reading the same `EventReadinessSummary` object already computed server-side, adding zero new queries. This document does not design that UI (out of scope), only confirms the data dependency is already one-directional and clean: Luv depends on Event Readiness's output; Event Readiness has and needs zero dependency on Luv.
- **The same relationship already exists a second time, pre-Event, and Luv already (mostly) gets it right.** Leads' `commitmentScore`/`responsivenessScore`/`interestScore` (§1, Pipelines/Leads) are the Pipeline's own equivalent of Event Readiness — a feature-native, already-computed metric — and `lib/luv/observations.ts` already reads them directly rather than re-deriving lead health from raw signal events. This is the pattern working correctly today, in one place; §7's Website finding (Luv's own ad hoc completeness heuristic) is the counter-example of the same pattern failing, in another. Both examples belong in this document because they show the principle is not hypothetical — Wevenu's codebase already contains one instance of it done right and one instance of it done wrong.

---

## 6. Trust Model — Facts, Inferences, Recommendations, never blurred

Three distinct trust tiers, and the rule for each:

1. **Facts** — a direct read of existing state, exactly as stored. No feature, no observation, no briefing may ever present a Fact with hedging language ("it looks like 11 guests are seated") — if it's a Fact, it's stated as one. Every Ready-tier item in §1/§7 is a Fact-tier observation today.
2. **Inferences** — a conclusion computed by combining two or more Facts using logic a human could verify by hand (e.g., "Seating is waiting because Guests hasn't finalized" — both halves are Facts, the connection is an Inference). Inferences must always be traceable back to the specific Facts that produced them — never presented as a Fact, never presented without the ability to show its reasoning. This document's §2 events and §3 Risks/Suggestions categories are Inference-tier by construction (a Risk is a Fact plus a threshold-crossing check — the check itself is the inference, however simple).
3. **Recommendations** — a suggestion for what to do next, always phrased as optional, always a link to an existing action already possible in the product (§3's Suggestions category), never an instruction implying Luv itself will act. This is the tier the existing, extensively-built `luv_recommendations`/`luv_insights` layer was built toward and — per §0 — never functionally reached, because the SQL beneath it throws on every call. This document's Phase 1 (§9) repairs that layer against the real schema before trusting anything it produces; it does not additionally resurrect confidence-scored *learned* recommendations beyond what those tables already modeled — a genuinely new learned layer is Future AI (§8), not this phase.

**The one hard rule this document adds:** any UI surface presenting Luv's output must be able to visually or structurally distinguish these three tiers — not necessarily with three different colors, but the underlying data model must carry a `tier` (or equivalent) field on every observation object so a future UI *can* distinguish them, even if this phase's own UI treatment is simple. This is a data-shape requirement, not a UI requirement, and belongs in this document because Product Promise transparency depends on it existing from day one of the unified engine, not retrofitted later.

---

## 7. Feature Completion Contract — what each capability must expose

The question this section answers, per capability: **what must already exist, queryable, before Luv can honestly observe this capability** — not what Luv should compute, what the *feature* must already track. Capabilities marked "Ready" need nothing further; capabilities marked "Needs additional state" name exactly what's missing.

| Capability | Status | What's missing (if anything) |
|---|---|---|
| Planning | **Ready** | Nothing — `EventReadiness` already exposes everything (§1). |
| Timeline | **Ready**, with one gap | No first-class "blocked" concept — acceptable, Luv should not invent one; but Timeline also has no "days until event" awareness of its own, which the Daily Briefing needs and must compute from `event.eventDate`, not from Timeline. |
| Guests | **Ready** | Nothing further — `lib/guests/service.ts`'s new aggregate query already exposes exactly what §1 needs. |
| Seating | **Ready** | Nothing further — `lib/seating/service.ts` already exposes `stats` and `needsReassignment`. |
| Floor Plans | **Ready** | Nothing further. |
| Requests | **Ready** | Nothing further. |
| Contracts | **Ready** | Nothing further. |
| Payments | **Ready** | Nothing further. |
| Documents | **Needs a product decision, not more state** | `couple_documents.share_with_venue` already exists and is queryable — what's missing is a decision on whether `false` (unshared) is a meaningful Opportunity signal or simply "how the couple prefers privacy." Do not build this observation until that's resolved; this is the one item in this table that isn't an engineering gap. |
| Communication | **Ready** | Nothing further — legacy threads' lack of read-state is an accepted, already-documented limitation, not a gap to fill for this phase. |
| Inventory | **Ready for its current scope; needs additional state for more** | Per-Floor-Plan over-allocation is fully exposed today. A venue-wide, cross-booking stock view (confirmed not to exist anywhere in `lib/inventory/`) would need a new aggregation function if ever wanted — not a new table, `InventoryUsage`'s shape generalizes cleanly. |
| Calendar | **Needs a small additive query** | `getCalendarData` is confirmed month-scoped only across its 7 source tables — a same-day/this-week filtered variant is the one gap, over data that already exists. |
| Website | **Needs a small additive query — and a cleanup** | `isPublished`/`scheduleSync`/`sectionsEnabled` all exist; no function reduces them to one status yet (mirror `computeFloorPlansReadiness`'s shape). Separately: `lib/luv/observations.ts` already contains its own ad hoc Website-completeness heuristic — extract it out to a Website-owned function rather than leaving Luv computing a second capability's status inline (§5). |
| Vendor Management | **Mostly ready — needs a small aggregation, not new tracking** | Confirmed `EventVendorAssignment.checkedInAt`/`setupCompleteAt` already exist and already timestamp day-of confirmation — the earlier assumption that this was "unconnected to any readiness layer" undersold it; what's missing is only "N of M vendors checked in" as a computed roll-up. |
| Pipelines / Leads | **Already Luv-ready today** | `commitmentScore`/`responsivenessScore`/`interestScore`/`followUpDate` are all persisted, refreshed on every dashboard load, and already read directly by `lib/luv/observations.ts`. The one gap is a Daily-Briefing-scoped "overdue follow-ups across the venue" aggregation — the same shape of function Event Readiness already has for Requests/Payments, just not yet written for Leads. |
| Automation | **Ready for Message Sequences; one honest limitation for Notifications** | `MessageSequence.status`/`SequenceEnrollment.status` are real, queryable columns — an aggregate count is a trivial addition. `NotificationLogEntry` has **no `openedAt`/`clickedAt` field** — confirmed absent, not merely unconfirmed — so Luv can honestly report a reminder was *sent*, never that it was *opened*; do not imply otherwise. |

**The contract, stated once, generally:** a feature is Luv-ready when (a) its meaningful state is a field or enum that already exists, (b) completion is a comparison a human could write in one line of pseudocode against that field, and (c) reading it requires no new table and no new RLS grant beyond what a legitimate reader (venue session or the couple's own portal token, per capability's existing ownership model) already has. Nothing in this document asks any feature to add a column, a table, or a new RPC purely to feed Luv — where state doesn't exist yet, the fix is a new *query* over data the feature already owns (exactly the pattern `lib/guests/service.ts` and `lib/seating/service.ts` just established for Event Readiness), never new tracking invented on Luv's behalf.

---

## 8. Where intelligence naturally fits, once the platform is complete

Not a design for prompts, models, or vendors — only where the seams already are, and where they already partly exist:

- **Narration is not hypothetical — it's already built, four separate times, for four separate purposes.** `luv-ask` (couple Q&A, Venue Guide-scoped), the dashboard roll-up (`lib/luv/roll-up-service.ts`, venue analytics → 4-quadrant narrative), lead draft generation (`lib/luv/drafts.ts`), and client draft generation (`lib/luv/client-drafts.ts`) are four genuinely separate, working Anthropic integrations, each with its own prompt-building logic. None of them currently narrates Event Readiness or the trust-tiered observation model this document defines. The natural next seam is not "build narration" — it's **converging these four onto one shared narration mechanism** that takes trust-tiered input (§6) and produces a warm sentence, so a fifth purpose (narrating Event Readiness) doesn't become a fifth independent implementation.
- **A related, deliberately out-of-scope family exists and should stay separate.** The four "transcribe pasted content" assistants (`import-assist.ts`, `message-template-import.ts`, `timeline-import.ts`, `playbook-import.ts`) share the Anthropic integration pattern and the Luv brand but solve a different problem (structured extraction from free text, not observation/narration) — this document does not fold them into the consolidation in §9, and a future implementer shouldn't either, just because they're also "Luv" and also "Claude."
- **Cross-booking pattern recognition.** Once the Daily Briefing (§4) exists and runs daily across many bookings, patterns become theoretically observable ("bookings that seat late tend to seat behind schedule generally") — this is exactly the shape of claim §3 defers as a Risk category exclusion, and where a genuinely learned layer (successor to today's `luv_insights`, once repaired per §0) would eventually belong. Nothing about that layer's design is proposed here.
- **Couple-facing extension.** The couple portal's own `getSeatingObservation`-style stateless helpers (`lib/luv/portal-observations.ts`) are already the couple-facing half of the same Fact/Inference model this document formalizes venue-side, and are already correctly part of the same `lib/luv/` module — not a separate implementation to unify, just an audience this document's model should keep serving as the venue-side half consolidates.

None of the above is scheduled by this document — §9 only schedules the consolidation and repair work needed before any of this is buildable honestly.

---

## 9. Recommended Implementation Phases

1. **Phase 1 — Repair, then consolidate.** Two distinct workstreams, in this order: **(a)** fix the `venue_users` schema mismatch across every SQL function backing `luv_memories`/`luv_insights`/`luv_recommendations`/health scoring/`get_venue_trends` (a targeted schema-alignment fix against tables that already exist, per §0 — not a rebuild), and confirm each returns real data before trusting anything downstream of it. **(b)** Retire exactly the two genuine forks — Wevenu HQ's `LuvInsights` rules-pass and the Vendor Portal's `computeLuvData()` — in favor of extending the real engine to those two audiences (HQ's own comment already frames its version as a placeholder for this; the Vendor Portal fork has no such justification and should simply be replaced). Explicitly out of scope for this phase: the four "transcribe pasted content" assistants (§8) — a different feature, not a competing engine — and the dead `client-detail.tsx`/`LuvClientPanel`/`LuvEventBriefing` chain, which should simply be deleted, not migrated (it has no live traffic to preserve). Add the one genuinely new piece of persistence this document identifies as necessary (§2, §4): a small "last observed state" record, per booking, per operational event — not a copy of any feature's data, only enough to answer "has this event already fired." No UI change required for this phase to be complete.
2. **Phase 2 — Event Readiness integration.** Wire the repaired/unified engine to read `EventReadinessSummary` (§5) as its primary per-booking input, and implement the §2 operational-event detection (transition-based, using Phase 1's persistence) on top of it. This is where "Guest list finalized" etc. become real, fireable events for the first time.
3. **Phase 3 — Daily Briefing.** Build the venue-wide fan-out (§4) across every active booking a coordinator owns, plus the small additive aggregations named in §7 (Calendar's same-day/this-week filter, Leads' overdue-follow-up rollup, Website's single-status reduction extracted out of Luv's own file, Vendor Management's day-of-confirmation rollup, Message Sequences' active-count). Every one of these reads data that already exists — none requires a new table.
4. **Phase 4 — Trust-tiered narration.** Converge the four existing narration-shaped integrations (§8: `luv-ask`, the dashboard roll-up, lead drafts, client drafts) onto one shared mechanism that narrates Facts/Inferences/Suggestions (§3, §6), with the `tier` field (§6) carried through to whatever UI eventually renders it. This is the first phase that changes anything couple- or coordinator-facing beyond what already exists — everything before it is engine work.
5. **Phase 5 — Learned layer, extended.** Only after Phases 1–4 are live and stable, revisit whether the now-functioning `luv_memories`/`luv_insights`/`luv_recommendations`/action-tracking layer should grow genuinely new pattern-recognition capability (§8's cross-booking patterns) beyond what it already models — building on schema that's now confirmed correct, not assumed correct.

Each phase is additive and independently shippable; none requires the next to exist first, but the order matters — Phases 2 and 3 both depend on Phase 1(a)'s repair being real, or every fact they surface inherits the same silent-failure risk one layer up, and Phase 4 depends on Phase 1(b)'s consolidation, or it converges four narration paths into five.

---

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
