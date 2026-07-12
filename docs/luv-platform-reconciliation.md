# Luv Platform Reconciliation

**Status:** Architecture and analysis only. No application code, database schema, or existing Luv functionality is changed by this document.
**Relationship to `docs/luv-platform-intelligence-architecture.md`:** That document (written earlier this program) inventoried what Luv observes, feature by feature, and proposed a phased consolidation. This document does not repeat that inventory — it reconciles it against capabilities that have since matured (Event Readiness, Guest Experience Phases 2–3, Seating Phases 1–2) and against two areas the prior document treated only lightly (Client Identity, and Requests as a primary observation source rather than one item in a list). Where the two documents overlap, this one is the more current statement; where they don't, both stand.
**Read:** the live implementations of Luv (`lib/luv/`, `components/dashboard/luv-widget.tsx`, `components/luv/`, `app/vendor/luv/`, `components/hq/venue-detail/luv-insights.tsx`), the platform architecture docs (`docs/wedding-workspace-architecture.md`, `docs/client-workspace-collaboration-architecture.md`, `docs/floor-plan-seating-architecture.md`), Guest Experience (`couple_guests`, `couple_households`, Guest Phases 2–3 migrations), Seating (`lib/seating/service.ts`, Seating Phase 1–2 migration and UI), Event Readiness (`lib/readiness/`), Client Identity (Client Identity Foundation: `client_users`, `couple_portal_participants`, `client_portal_sessions`, `client_support_access_grants`), and the Request Framework (`lib/requests/types.ts`, `lib/requests/service.ts`).

---

## 0. What already exists — the reconciliation baseline

Restated briefly (full detail in the prior document, §0 there):

- **A genuinely working, stateless observation layer** — `lib/luv/observations.ts` (venue dashboard) and `lib/luv/portal-observations.ts` (couple portal). Computed fresh, no persistence, no known bugs.
- **A large, real, currently-non-functional persisted layer** — seven tables (`luv_settings`, `luv_drafts`, `luv_memories`, `luv_insights`, `luv_recommendations`, `luv_actions`/`luv_action_outcomes`, `luv_rollups`), fully service-wrapped, live-wired into `LuvWidget`, broken at the SQL layer because most of the backing RPCs select from `venue_users`, a table that doesn't exist.
- **Two genuine forks** — Wevenu HQ's `LuvInsights` (self-documented placeholder) and the Vendor Portal's `computeLuvData()` (undocumented, zero shared code).
- **One dead component chain** — `client-detail.tsx` → `LuvClientPanel` → `LuvEventBriefing`, plus the client side of `lib/luv/event-readiness.ts`.
- **Four separate working Claude integrations** for observation/narration purposes (`luv-ask`, roll-ups, lead drafts, client drafts), plus four more for a genuinely different purpose (transcribing pasted content — out of scope for this reconciliation, same as the prior document).

What's new since that inventory was written: Event Readiness (`lib/readiness/`) now exists as a real, built capability, not a proposal. Guest Experience Phases 2–3 (invitation lifecycle, meals/dietary/accessibility, households, plus-ones) are built. Seating Phases 1–2 (Floor-Plan-backed tables, Wedding Workspace UX) are built. This document reconciles Luv against all of that.

---

## 1. Existing Luv capabilities that already align — keep, do not redesign

| Capability | Why it already fits the platform as it stands today |
|---|---|
| `lib/luv/observations.ts` (venue "Notice" engine) | Reads directly from feature-owned tables, computes fresh, persists nothing. This is precisely the shape the platform's own capabilities (Event Readiness included) already use — no redesign needed, only extension (§3) to read capabilities it doesn't yet touch. |
| `lib/luv/portal-observations.ts` (couple-facing observations) | Same shape, couple-scoped. Guest/Seating/Budget/Payment/Overview/Countdown/Wedding-day/Anniversary observations already read the couple's own data to reflect back to the couple — exactly the right audience boundary (§8 makes this boundary explicit for Guest/Seating specifically). |
| `getSeatingObservation` specifically | Already reused directly by Seating Phase 1–2's own UI (`components/portal/seating-section.tsx`) — proof this pattern (a feature consuming Luv's own stateless helper) already works end to end, not just in theory. |
| The Lead scoring relationship (`commitmentScore`/`responsivenessScore`/`interestScore`, read directly by `observations.ts`) | Luv already treats Leads' own persisted scores as Facts and narrates around them rather than recomputing lead health independently — the correct pattern, already in production, for exactly the relationship §6 describes for Event Readiness. |
| `luv_settings` (`observationsEnabled`/`draftingEnabled`/`autonomyLevel`/`preferredTone`) | A real, working, coordinator-controlled configuration surface. Keep as-is — any future unified engine should still read these, not introduce a second settings concept. |
| The four-quadrant roll-up shape (`whatIsWorking`/`needsAttention`/`opportunities`/`customerLove`) | A sound narrative structure for a weekly-cadence retrospective — keep the shape even while repairing what feeds it (§0, §5). |
| `luv-ask`'s scoping to Venue Guide content only | Correct, not a limitation to "fix" — a couple-facing chat with access to the couple's *own* operational data would be a different, larger feature with different trust implications (§8); keeping it scoped to static venue-authored content is the right boundary today, not a gap. |

**The general principle these examples establish:** nothing about *how* Luv computes observations today needs to change. What needs to change is *what* it's connected to (§3, §9) and *how many separate places compute the same thing* (§2).

---

## 2. What's obsolete — retire, and why

| Item | Why it's obsolete |
|---|---|
| `lib/luv/event-readiness.ts` (`computeEventReadiness`, the 8-item checklist) | Directly superseded by `lib/readiness/compute.ts`. The old checklist merges Contract/Payment/Timeline/Floor-Plan/Vendor/Questionnaire/Documents into one undifferentiated score; the new Event Readiness deliberately keeps ten capabilities as separate, sorted, status-tagged sections — a strictly better model the platform has already adopted elsewhere (Planning's own Client/Venue split, per `lib/playbooks/repository.ts`'s "never merged" comment, is the same philosophy). Retire the file entirely; nothing should read it going forward. |
| `components/clients/client-detail.tsx` → `LuvClientPanel` → `LuvEventBriefing` | Confirmed dead — imported nowhere. Retire outright, don't migrate; there is no live traffic depending on it, and its own reason for existing (a legacy per-client Luv briefing) is now Event Readiness's job. |
| `app/(app)/clients/[id]/luv-client-actions.ts` | Dead by the same chain — its only caller is the dead component above. |
| The Vendor Portal's `computeLuvData()` | An accidental fork with no shared code and no self-documented justification (unlike HQ's version, below) — obsolete the moment the real engine is extended to read vendor-scoped state (§9), not before. |
| Wevenu HQ's `LuvInsights` rules-pass | Not obsolete in the same sense — it's a self-documented, deliberate placeholder ("wiring the full Luv observation engine... is a deliberate future hook, not built in this pass"). It becomes obsolete only once that hook is actually wired (§9); until then it is doing its stated job honestly and should not be deleted prematurely. |
| Luv's own ad hoc Website-completeness heuristic (inside `observations.ts`: `!site.is_published && daysUntil <= 120`, `site.is_published && !site.content?.travel`) | Not dead code — actively wrong *placement*. This is duplicated readiness logic living inside Luv rather than owned by Website, the exact anti-pattern Event Readiness's own Guiding Philosophy forbids ("no capability should create separate readiness logic"). Retire the heuristic *from Luv's file* and replace it with a read from a small, Website-owned status function once one exists (§3, §9) — the observation itself isn't wrong, its owner is. |
| The DB-backed layer's `venue_users`-referencing RPC bodies | Not obsolete — broken. Named here only to distinguish "retire" from "repair": this is the one item in this section that should be *fixed*, not deleted, since the tables and TypeScript layer above them are sound (§0, §9). |

**What this section deliberately does not include:** the seven persisted tables themselves, the four narration integrations, or `luv_settings`. Large and currently non-functional is not the same as obsolete — obsolescence here specifically means "superseded by something the platform now does better," and only the items above meet that bar.

---

## 3. New platform capabilities that should become first-class Luv observations

For each, matching the prior document's shape but stated against the now-complete implementations:

### Event Readiness
**What Luv should understand:** the same ten-section, four-status model Event Readiness already computes (`EventReadinessSummary`), consumed as input, never recomputed (§6). Luv's value-add is exactly what Event Readiness structurally cannot do: narrate *why* several sections are in the state they're in together, and remember what was true last time it looked.

### Requests
**What Luv should understand:** every Request's `status`, `dueDate`, `sourceFeature` (`planning`/`timeline`/`documents`/`contracts`/`floor_plans`/`guests`/`manual` — a Request already knows which capability it came from), and `visibility`. This is elaborated fully in §7 — Requests deserve more than a line item because their lifecycle alone already produces all six observation kinds (§4) without any additional logic.

### Client Identity
**What Luv should understand — carefully, and mostly as a *constraint* rather than a *subject*.** Client Identity (`client_portal_sessions.access_level`, `client_contacts.portal_role`, `couple_portal_participants.permission_level`, `client_support_access_grants`) is not itself a source of celebratory or at-risk *content* the way Guests or Payments are — a couple accepting their portal invitation isn't a milestone worth narrating to a coordinator. Its relevance to Luv is structural: **any observation Luv produces about a couple's own data must respect whichever access tier resolved the session that's asking.** One genuine observation-worthy fact does exist here: a `client_support_access_grants` window being open (the couple has temporarily let the venue view their workspace) is itself a Fact worth surfacing to a coordinator ("you have active, couple-granted access to their workspace until [time]") — narrower and more honest than implying the venue can always see this. Do not build anything here beyond that one fact; per `docs/client-workspace-collaboration-architecture.md` §14, the three permission vocabularies don't yet reconcile cleanly even within the platform itself, and Luv should not be the thing papering over that gap with its own inferred permission logic.

### Guest Experience
**What Luv should understand:** aggregate-only. Full treatment in §8 — this is the section of the document doing the most new work, because the boundary matters more here than anywhere else in the platform.

### Seating
**What Luv should understand:** `SeatingReadinessSummary` (`floorPlanShared`, `totalAttending`, `totalAssigned`, `needsReassignmentCount`) — exactly what `lib/seating/service.ts` already exposes for Event Readiness, and nothing about who is assigned where. `needsReassignmentCount > 0` is Seating's cleanest Risk-kind observation on the whole platform: unambiguous, time-sensitive, and already computed by the Seating Phase 1 migration's own `ON DELETE SET NULL` design — Luv adds narration, not detection.

### Floor Plans
**What Luv should understand:** whether a Floor Plan has been shared (`client_access != 'hidden'`) and Inventory Usage over-allocation (`quantityAvailable - quantityUsed < 0`) — both already Event-Readiness-summarized. The one genuinely new correlation worth naming: a Floor Plan shared *after* Seating became `needs_attention` due to `needsReassignmentCount` is an Inference-kind observation Luv can make ("the room changed after seating was already underway") that neither Floor Plans nor Seating would ever compute about themselves, since neither one is aware the other changed.

### Inventory
**What Luv should understand:** the same per-booking over-allocation Floor Plans already surfaces. Per the prior document's finding, no venue-wide stock concept exists yet — Luv should not imply one. If a cross-event view is ever built, it is Inventory's own function to write (§7 of the prior document), and Luv reads it the same way it reads everything else — never the reverse.

### Communication
**What Luv should understand:** unread-from-client counts on the new Conversation experience only (`senderType='lead_or_client' && !venueReadAt`); message counts only (no unread concept) on legacy threads — already exactly what `computeCommunicationReadiness` established, and already the boundary `booking-overview-summary.tsx` chose independently. No new state to add; the discipline here is *not inventing* an unread concept for legacy threads just because Luv would find one convenient to narrate.

### Calendar
**What Luv should understand:** this is the one capability in this list that is *not* per-booking and therefore does not belong in per-Event Readiness or per-Event Luv narration at all — it belongs entirely to the Daily Briefing (§5) as a venue-wide, date-scoped feed (tour appointments today, holds expiring this week). Naming it here mainly to be explicit that "should Luv observe Calendar" and "should Event Readiness have a Calendar section" have different, independently correct answers (no to the second, yes-but-elsewhere to the first).

---

## 4. Observation Model — a unified contract

The prior document used two separate lists — a three-tier Trust Model (Facts/Inferences/Recommendations) and a seven-item Observation Categories table (Facts/Risks/Suggestions/Celebrations/Waiting/Upcoming/Completed). That split was itself an instance of the fragmentation this whole reconciliation exists to fix. This document collapses both into one.

**Every observation carries exactly one `kind`, from a single six-value enum:**

```
ObservationKind = "fact" | "inference" | "recommendation" | "celebration" | "waiting" | "risk"
```

| Kind | Definition | Traceability requirement |
|---|---|---|
| **Fact** | A direct, unadorned read of existing state. The default kind — anything not more specifically one of the other five. | None beyond citing the source field/table. |
| **Inference** | A conclusion reached by combining two or more Facts using logic a human could verify by hand. Never presented with Fact's certainty. | Must cite every Fact it was derived from — a `basedOn` reference list, not prose alone. |
| **Recommendation** | A suggested next action, always optional, always a link to something already possible in the product. Never an instruction implying Luv will act itself. | Must cite the Fact(s)/Inference(s) that motivated it, and the exact in-product destination the link resolves to. |
| **Celebration** | A Fact that is also the first occurrence of one of the operational events named in the prior document's §2 (guest list finalized, contract signed, etc.) — promoted out of plain Fact specifically because it's a one-time transition worth narrating differently than routine state. | Must cite the transition detected and the prior state it transitioned from (requires the "last observed state" persistence named in §5/§9 of the prior document). |
| **Waiting** | A Fact describing state that depends on someone else's next action and has no due date yet (a Request `sent` but not `viewed`; an invitation `sent` but not opened). Distinguished from a plain Fact specifically to signal "nothing is wrong, but nothing will move without the other party." | None beyond the underlying Fact. |
| **Risk** | A Fact plus an existing, feature-native threshold already crossed (overdue, expired, over-capacity, `needsReassignment`). The one kind that should visually/tonally interrupt a calm briefing. | Must cite the specific threshold crossed and the field that crossed it — never a threshold Luv invented itself (the prior document's Trust Model rule survives unchanged here). |

**Precedence, when more than one could apply:** Celebration > Risk > Waiting > Recommendation > Inference > Fact. A transition that is both a Celebration and would otherwise read as a Risk-adjacent Fact (e.g., "final payment received" one day after its due date) is tagged Celebration — the milestone is the more important thing to say, and the risk resolved itself in the same moment it would have been raised.

**Every observation, regardless of kind, carries the same envelope:**

```
Observation = {
  kind: ObservationKind
  subject: { capability: string; entityId: string }   // what this is about
  statement: string                                     // the narrated sentence
  basedOn: FactRef[]                                    // required for inference/recommendation/celebration/risk; empty for fact/waiting
  navTarget: NavTarget | null                            // required for recommendation; optional otherwise
  observedAt: timestamp
}
```

This is architecture, not a schema — no table is proposed. It is the shape every existing and future producer (the stateless engine, the repaired learned layer, the Daily Briefing) should emit into, so that a UI rendering "Luv's output" never has to special-case which of the four+ current producers a given observation came from.

---

## 5. Daily Briefing — how the existing pieces relate

Not a redesign of any of the seven existing pieces — a map of where each already belongs, by cadence and purpose:

| Existing piece | Cadence | Role relative to a future Daily Briefing |
|---|---|---|
| **Observations** (`lib/luv/observations.ts`) | Computed fresh, every load | The Briefing's primary raw material once extended to read Event Readiness/Requests/Seating/Guests (§3) — this is the "what's true right now" feed the Briefing fans out venue-wide. |
| **Trends** (`trends-service.ts`, incl. Story Mode) | Monthly-shaped ("what changed this month") | Sits above daily observations in cadence — feeds a "what's different lately" section of the Briefing, not the urgent-now section. Story Mode specifically should resume functioning once §0/§9's schema repair lands, not be redesigned. |
| **Memories** (`luv_memories`) | Long-horizon (milestone/business_pattern/seasonal/preference) | Narrative color and personalization, not urgency — "last year around this time..." belongs in the Briefing's context, never its priority ordering. |
| **Insights** (`luv_insights`, confidence-scored) | Pattern-level, computed periodically | Inference-kind observations specifically, and the one place confidence must be visibly carried through per §4's traceability rule — a `low`-confidence insight should read differently in the Briefing than a `high`-confidence one, never presented at Fact-level certainty. |
| **Recommendations** (`luv_recommendations`) | Generated alongside Insights | The Briefing's actionable layer — every Recommendation-kind observation in §4's model, surfaced with its `navTarget`, exactly the shape this framework already models (`ctas: {label, target, type}`). |
| **Actions** (`luv_actions`/`luv_action_outcomes`) | Tracks follow-through over time | Not a new observation source — the feedback loop that closes the Recommendation lifecycle (did the coordinator act, did the metric move). This is what powers the Briefing's "what got resolved since I last looked" section (Celebration-kind, sourced from `luv_action_outcomes`' own before/after deltas) rather than the last-observed-state mechanism alone needing to invent one. |
| **Rollups** (`luv_rollups`, 4-quadrant weekly narrative) | Weekly | A distinct cadence from the Daily Briefing, not a component of it — the Briefing is the every-morning pulse; the Roll-Up is the weekly retrospective. Both are valid, complementary, and should remain separately triggered rather than merged into one artifact. |

**The one new mechanism this reconciliation still requires** (carried forward from the prior document, restated because the Daily Briefing depends on it): a small "last observed state" record per booking per operational event, so Celebrations and "what changed since I last looked" are answerable at all. Nothing else here is new persistence — every piece in the table above already has a home; the Briefing arranges them, it doesn't replace them.

---

## 6. Event Readiness ↔ Luv — no duplicated responsibility

Stated once, precisely, since it is load-bearing for nearly every other section:

- **Event Readiness owns "what state is this booking in," per capability, right now.** Four statuses, sorted, computed fresh, no memory.
- **Luv owns everything Event Readiness structurally cannot do**: narrating *why*, correlating *across* capabilities (§3's Floor-Plans/Seating example), remembering *what changed since last time* (§5), and surfacing *pre-Event* state (Leads, §1) that Event Readiness by definition never sees.
- **The dependency is one-directional.** Luv reads `EventReadinessSummary`; Event Readiness has, and needs, zero awareness that Luv exists. This was true when the prior document was written and remains true — nothing about Guest Experience Phase 2–3 or Seating Phase 1–2 maturing since then has changed it, because Event Readiness's own contract (`lib/readiness/types.ts`) was deliberately built to be a clean read-only surface for exactly this kind of downstream consumer.
- **The failure mode this guards against, concretely:** if a future implementer, extending Luv to understand Seating (§3), reaches for `guest_seat_assignments` directly instead of `computeSeatingReadiness`'s output, they will have quietly reintroduced the exact "two engines computing the same fact" problem that produced today's HQ/Vendor-Portal forks (§0) one layer further in. Every extension in §3 and every phase in §10 should be read with this specific failure mode in mind.

---

## 7. Request Framework as a primary Luv observation source

Requests deserve more than a line item because their lifecycle alone already produces all six kinds in §4 without Luv inventing anything:

| Request state | Observation kind | Why |
|---|---|---|
| `status = 'sent'`/`'viewed'`/`'in_progress'` | **Waiting** | Depends on the client's next action; no due date urgency yet. |
| `dueDate` passed, `status` not `completed`/`cancelled` | **Risk** | Already exactly `computeRequestsReadiness`'s own overdue check — Luv narrates it, doesn't recompute it. |
| `status = 'submitted'`/`'reviewed'` | **Recommendation** | The client has already acted; reviewing it is a fast, specific, linkable action for the coordinator — this is Requests' cleanest Recommendation-kind case on the whole platform. |
| `status` transitions to `'completed'` | **Celebration** | A real, one-time transition, exactly matching the prior document's §2 vocabulary. |
| Any Request read together with its `sourceFeature` | **Inference** | Because every Request already records which capability created it (`planning`/`timeline`/`documents`/`contracts`/`floor_plans`/`guests`/`manual`), Luv can correlate "this Planning task is blocked because its linked Request is still `sent`" without inventing a new join — the link already exists in the schema (`event_tasks.request_id` ↔ `Request.sourceFeature = 'planning'`). |

**The structural reason Requests are a *primary* source rather than one among many:** every other capability in §3 produces at most two or three of the six kinds naturally (Guests produces Waiting and Celebration; Payments produces Risk and Fact). Requests produces all six from one status enum, and — via `sourceFeature` — is also the one mechanism that already lets Luv trace *why* a stalled capability is stalled back to a concrete, client-facing cause, rather than merely reporting that it's stalled. Any future Luv engine should treat Requests as connective tissue across capabilities, not just another capability to summarize.

---

## 8. Guest Experience — reasoning without exposing Client-Owned information

This is the section of the document doing the most new work, because the stakes are highest here: `couple_guests`' own founding migration comment states plainly that "the venue does NOT see individual records" — the one explicit, enforced Client-Ownership precedent in the codebase (per `docs/client-workspace-collaboration-architecture.md` §4). Any Luv design here has to hold that line exactly, not approximately.

**The governing rule: audience determines visibility, and the two audiences see fundamentally different things.**

- **Luv-for-the-venue (coordinator-facing, `lib/luv/observations.ts` and any future Daily Briefing extension):** aggregate counts only, and only the aggregates Event Readiness itself already exposes (`lib/guests/service.ts`'s `GuestReadinessSummary`, `lib/seating/service.ts`'s `SeatingReadinessSummary`). Concretely:
  - **Guest progress:** "X of Y invited guests have responded" — a count, never a name.
  - **RSVP:** "Z guests attending" — a count. Never which guests, never their `rsvp_note`.
  - **Seating:** "N of M guests seated, K need reassignment" — counts only, from `SeatingReadinessSummary`, never which guest sits where or which table.
  - **Meals:** **no venue-facing observation at all**, in this phase. There is no existing aggregate meal-count function anywhere in the platform today (confirmed in the prior document's research), and meal choices are exactly the kind of individually-identifying preference data the Client-Ownership precedent protects. Building an aggregate ("12 chicken, 8 vegetarian") would be a genuinely new capability, not a Luv observation over an existing one — out of this reconciliation's scope, and worth a deliberate product decision before it's ever built, the same way the prior document flagged `couple_documents.share_with_venue` as a decision rather than an engineering task.
  - **Accessibility:** **no venue-facing observation at all**, for the same reason, more strongly — accessibility needs are the single most sensitive field in the Guest Experience data model. Do not build a venue-facing count here without an explicit, separate product decision; this document takes no position on what that decision should be, only that it hasn't been made.
- **Luv-for-the-couple (`lib/luv/portal-observations.ts`, already live):** full access to the couple's *own* data, because Client-Owned data reflected back to its owner is not an exposure — `getGuestObservations`/`getSeatingObservation`/etc. already reason about individual guests, meals, and dietary/accessibility tags today, correctly, because the couple is looking at their own wedding. Nothing here changes; this is already the right boundary, already built (§1).

**What this means concretely for §3's Event Readiness / Seating / Guests entries:** every venue-facing number this document recommends is already exactly what `computeGuestsReadiness`/`computeSeatingReadiness` expose today — this section doesn't ask for new aggregate functions, it explains *why* the boundary those functions already drew (aggregate-only) is the correct one, and explicitly declines to extend it to Meals/Accessibility without a product decision first.

---

## 9. Platform Coverage Matrix

| Capability | Current Luv Support | Needs Extension | No Integration Required |
|---|---|---|---|
| Planning | Read directly (`observations.ts` reads `event_tasks`) | Wire to `computePlanningReadiness` instead of raw tasks | — |
| Timeline | Partial (creation/last-updated only, per the prior document) | Yes — read `computeTimelineReadiness`, add days-until-event awareness | — |
| Guests | Couple-side only (`portal-observations.ts`) | Yes, venue-side — aggregate-only, per §8 | — |
| Seating | Couple-side only (`getSeatingObservation`) | Yes, venue-side — aggregate-only, per §8 | — |
| Floor Plans | None found | Yes — read `computeFloorPlansReadiness` | — |
| Inventory | None found | Yes, but only the per-booking signal Floor Plans already has (§3) | Venue-wide stock view — not until Inventory itself builds one |
| Requests | None found | Yes — primary source, per §7 | — |
| Contracts | Read directly, informs commitment scoring | Wire to `computeContractsReadiness` for consistency | — |
| Payments | Read directly, informs commitment scoring | Wire to `computePaymentsReadiness` for consistency | — |
| Documents | Partial (expiry checks) | Confirm alignment with `computeDocumentsReadiness`'s two-tier check | The `share_with_venue` Opportunity signal — pending product decision (prior document §7) |
| Communication | Partial (message counts in dashboard context) | Align to `computeCommunicationReadiness`'s unread-vs-count distinction | Legacy thread "unread" — deliberately not built (§3) |
| Calendar | None found (venue-wide, separate concern) | Yes — but into the Daily Briefing, never Event Readiness (§3) | — |
| Website | Yes, but via an ad hoc heuristic embedded in Luv itself | Yes — replace the embedded heuristic once Website exposes its own status function (§2) | — |
| Vendor Management | Read via `event_vendor_recommendations`/assignments in `observations.ts` | Confirm it reads `checkedInAt`/`setupCompleteAt` for day-of state, not just recommendation state | — |
| Pipelines / Leads | Yes — the most mature integration on the platform (§1) | Minor: an overdue-follow-up venue-wide aggregation for the Daily Briefing | — |
| Automation (Notifications) | None found | Optional — `getNotificationStats()` is a small addition | Open/click tracking — does not exist, do not imply it |
| Automation (Message Sequences) | None found | Optional — active-count aggregation | — |
| Client Identity | None found | Minimal — only the `client_support_access_grants` open-window Fact (§3) | Everything else — Client Identity is a visibility *constraint* on Luv, not a subject for it (§3) |
| Event Readiness itself | N/A (didn't exist when Luv's engine was built) | Yes — becomes Luv's primary per-booking input (§6) | — |

---

## 10. Implementation Roadmap

Phrased as reconciliation phases, not a rebuild — each phase's job is named against §1–§9 above:

1. **Repair the schema break, retire what's genuinely dead.** Fix the `venue_users` reference across every RPC backing `luv_memories`/`luv_insights`/`luv_recommendations`/health scoring/`get_venue_trends` (§0, §2). Delete the dead `client-detail.tsx`/`LuvClientPanel`/`LuvEventBriefing`/`luv-client-actions.ts` chain and `lib/luv/event-readiness.ts` outright (§2). Nothing user-facing changes in this phase.
2. **Wire Event Readiness as Luv's primary per-booking input.** Replace any raw-table reads Luv currently does for capabilities Event Readiness already summarizes (Planning, Timeline, Contracts, Payments, Documents, Communication) with reads of `EventReadinessSummary` (§6). This is a pure substitution — no new observations yet, just the correct source for existing ones.
3. **Extend into the capabilities Luv doesn't touch yet.** Requests (§7, full six-kind treatment), Floor Plans, and venue-facing Guests/Seating strictly aggregate-only per §8. This is the first phase that adds genuinely new observations rather than re-sourcing existing ones.
4. **Adopt the unified Observation Model (§4).** Migrate every existing producer (stateless observations, the repaired learned layer, both narration surfaces) to emit the single `kind`-tagged envelope, retiring the prior document's two-list model in code, not just in this document.
5. **Consolidate the two genuine forks.** Extend the real engine to Wevenu HQ's and the Vendor Portal's audiences (§0, §2), retiring `computeLuvData()` and graduating HQ's placeholder past its own self-documented "v1" status.
6. **Build the Daily Briefing.** Fan the now-unified, now-correctly-sourced engine out venue-wide, arranging the seven existing pieces per §5's table — no new persisted concept beyond the "last observed state" record already named there.
7. **Converge narration.** Bring `luv-ask`, the roll-up generator, and the two draft generators onto the unified `kind`-tagged model's output as their shared input, so a sixth narration purpose never becomes a fifth-plus-one implementation.

---

*End of document. No implementation, migration plan, or code is proposed — see task scope.*
