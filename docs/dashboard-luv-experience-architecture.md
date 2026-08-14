# Hello to Cheers — Dashboard & Luv Experience Architecture

**Date:** 2026-08-07
**Status:** Architecture only. No code, UI, components, mock data, SQL, or migrations were touched. This document defines the canonical system every future Dashboard, Report, Notification, Email, and Luv experience will render from.

**This is a reconciliation, not a green-field design.** Two substantial, already-adopted architecture documents already exist and cover large parts of this brief in depth — `docs/luv-platform-intelligence-architecture.md` (Luv's observation categories, trust tiers, Event Readiness relationship, Daily Briefing information architecture, per-capability observation catalog, implementation phases) and `docs/notification-system-redesign.md` (notification categories, channels, profiles, escalation). Neither was written knowing the other existed as part of one system, and neither designs the Dashboard or Reporting's own structure. **This document's actual job is the missing layer above both**: one canonical taxonomy, one ownership model, one priority hierarchy, and one Decision Engine that Dashboard, Luv, Reports, Notifications, and the Daily Briefing all read from — reconciling, not replacing, what those two documents already got right. Where this document's vocabulary differs from either source doc, the mapping is stated explicitly (§3), never silently.

Also grounded in the real, live implementation: `lib/dashboard/service.ts` (`getDashboardData`), `lib/luv/briefing-service.ts` (`getDailyBriefing` — a working Daily Briefing already exists), `lib/notifications/digest-engine.ts` (the working daily digest email), and this session's own `docs/metric-registry-canonical-implementation.md` (the canonical Booking/Revenue/Conversion/Health layer Reports will read from).

---

## 1. Canonical Information Architecture

One system, five surfaces:

```
                         ┌─────────────────────────┐
                         │   Source Domains (§2)    │
                         │  Leads, Clients, Contracts,│
                         │  Payments, Playbooks, ...  │
                         └────────────┬────────────┘
                                      │ publish
                                      ▼
                         ┌─────────────────────────┐
                         │   THE DECISION ENGINE     │
                         │  (§ this doc's §4)         │
                         │  classify → prioritize →   │
                         │  route                     │
                         └────────────┬────────────┘
                                      │ routes each item to
                    ┌─────────┬───────┼───────┬─────────┐
                    ▼         ▼       ▼       ▼         ▼
               Dashboard    Luv   Notifications  Reports  Daily
              (§6)        (§7)      (§9)        (§8)   Briefing (§10)
```

Every surface is a **filtered view** over the same underlying stream of classified, prioritized information — never an independent computation. This is the one rule every section below exists to enforce: **a fact is computed once, by the domain that owns it; everything downstream reads that fact, never recomputes it.** `docs/luv-platform-intelligence-architecture.md` §5 already states this exact rule for Luv specifically ("Luv never recomputes a status Event Readiness already owns"); this document extends it to all five surfaces.

---

## 2. Ownership Model — what each domain is allowed to publish

Every domain publishes **Facts about itself only** — never a Fact about another domain, never a priority, never a surface placement (those are the Decision Engine's job, §4). This mirrors exactly the relationship already certified between Event Readiness and Luv (`docs/luv-platform-intelligence-architecture.md` §5, §7): a feature owns its own state; nothing above it re-derives that state a second way.

| Domain | Publishes | Never publishes |
|---|---|---|
| **Leads** | Status transitions, the three persisted scores (commitment/responsiveness/interest), follow-up due dates | A priority, a "you should call this lead" instruction |
| **Clients / Relationships** | Client status, key dates, Client Health (Relationship Health, per `lib/metrics/health.ts`) | Anything about the Event/booking those belong to Events |
| **Contracts** | Status transitions (sent/signed/cancelled/expired), the "contract signed" Milestone | A recommendation to "follow up on this contract" (that's a Recommendation, generated downstream, not by Contracts) |
| **Payments** | Invoice/payment-line status, balance-due facts, canonical Revenue metrics (`lib/metrics/revenue.ts`) | An "at risk" judgment about the relationship — that's Relationship Health's job, reading Payments' facts as an input |
| **Playbooks / Tasks** | Task status, Event Readiness sections (`lib/readiness/compute.ts`), the per-capability completion facts already catalogued in `docs/luv-platform-intelligence-architecture.md` §1 | A cross-capability correlation ("Seating is stalled because Guests isn't done") — that's an Insight, Luv's job |
| **Messages / Communication** | Unread counts, Communication Health level, message-sequence status | Content interpretation ("this lead sounds unhappy") — out of scope for any domain today, not invented here |
| **Documents** | Expiry facts, upload/share events | A "you're missing insurance" judgment beyond the already-existing expiry threshold |
| **Vendors** | Assignment/check-in status, Vendor Health (`lib/metrics/health.ts`) | A venue-facing "this vendor is unreliable" score — confirmed not to exist anywhere today (per the Reporting certification's own finding); not invented here |
| **Calendar** | Raw date facts (tours, holds, key dates) via `getCalendarData` | Its own risk/opportunity judgments — Calendar is a lens over other domains' dates, never an owner of its own observation, exactly as `docs/luv-platform-intelligence-architecture.md` §1 already concluded |
| **Automation (Notifications/Sequences)** | Delivery status, sequence enrollment state | Whether a delivered message was *read* — `NotificationLogEntry` has no `openedAt` field; automation must not imply it knows |
| **Website** | Publish state, RSVP stats | A completeness score — `CoupleWebsite` has none today; the existing ad hoc heuristic embedded in `lib/luv/observations.ts` is a documented violation of this exact rule (`docs/luv-platform-intelligence-architecture.md` §1, Website section) and should be extracted to a Website-owned function, not treated as precedent |
| **Reporting** | Canonical Metric values (`lib/metrics/registry.ts`) only — Bookings, Revenue, Conversion, Health | A priority-ranked "what to look at" — Reporting answers "how are we performing," never "what should I do today" (§8) |

**The structural rule, stated once:** a domain publishes state (a Fact). The Decision Engine classifies that Fact into one of the eight canonical types (§3) and assigns it a priority (§5). No domain does either of those two things about its own output — this is exactly the separation of concerns `docs/luv-platform-intelligence-architecture.md` §6 already established for Facts vs. Inferences vs. Recommendations, generalized here to cover Alerts, Milestones, Reminders, and Opportunities too.

---

## 3. Information Taxonomy

Eight categories, mutually exclusive by construction — every classified item is exactly one of these, decided by a fixed rule, never by which surface happens to render it.

| Category | Definition | Classification rule | Maps to (existing docs) |
|---|---|---|---|
| **Observation** | A direct, unadorned Fact about current state. No urgency, no interpretation. | Any published Fact that has not crossed an urgency threshold and does not represent a one-time transition. | `docs/luv-platform-intelligence-architecture.md` §3 "Facts" |
| **Insight** | A conclusion drawn by combining two or more Observations, with a traceable chain back to them — the "why." | Produced only by the Decision Engine's correlation layer (Luv), never by a domain. Always answers "why," never "what should I do." | §6 "Inferences" |
| **Alert** | An Observation that has crossed a real, feature-native threshold: overdue, expired, blocked, over-capacity. | A Fact classified as Alert the moment its threshold is crossed — at that point it is no longer classified as a plain Observation. | §3 "Risks" |
| **Recommendation** | A specific, optional, linked next action. Never auto-executed. | Generated in response to an Alert, an Insight, or an Opportunity — always names one existing, already-reachable action. | §3 "Suggestions" / §6 tier 3 "Recommendations" |
| **Milestone** | A one-time, business-meaningful state transition, logged regardless of whether it is prominently surfaced. | Any transition matching one of the domain's own defined transition points (the same shape as §2's 11-event table in the Luv doc, generalized platform-wide). | New concept — see below |
| **Celebration** | The subset of Milestones curated as worth prominently surfacing — rare, one-time, universally recognized. | A Milestone additionally on the platform's fixed celebration whitelist (starts as exactly the 11 events already named in `docs/luv-platform-intelligence-architecture.md` §2 — not expanded without deliberate curation, per that document's own "routine upkeep is never celebration-worthy" rule). | §3 "Celebrations" |
| **Reminder** | A known, date-driven fact that has **not yet** crossed an urgency threshold — a heads-up, not yet an Alert. | Any date-relative Observation ("due in 5 days," "wedding in 12 days") below its domain's Alert threshold. | §3 "Upcoming" |
| **Opportunity** | A noticed condition where a low-effort win is available, distinct from a specific Recommendation. | A Fact matching a domain's own pre-defined "easy win" pattern (already-computed, never invented — e.g. `get_seating_suggestions`' own output, a Request already `submitted`, per §1 of the Luv doc). | New split out of §3 "Suggestions" — see below |

**Two genuinely new distinctions this document adds to the existing Luv vocabulary, stated explicitly rather than silently introduced:**

1. **Milestone vs. Celebration**, split apart. The Luv doc's §2 table already enumerates exactly the moments worth celebrating, but conflates the *transition record* with the *decision to surface it prominently*. Splitting them matters because not every meaningful transition should interrupt a venue owner (a routine task completing is a Milestone — logged to Activity — but not a Celebration), while every Celebration must still be backed by a real, logged Milestone (never a UI flourish with no underlying record). Practically: **Milestone is the data-layer fact; Celebration is that fact plus curation.**
2. **Opportunity vs. Recommendation**, split apart. Luv's existing "Suggestions" category (§3 of that doc) already correctly forbids Luv from inventing a suggestion engine — but doesn't distinguish "a condition worth noticing" (three guests sit unassigned) from "the specific thing to do about it" (assign them to Table 7, if the seating tool already computed that suggestion). Opportunity is the *noticed condition*; Recommendation is the *optional, linked next step* — sometimes generated from an Opportunity, sometimes from an Alert (a payment overdue *is* an Alert; "send a reminder" is the Recommendation attached to it), sometimes standing alone with no Recommendation attached at all (surfacing the Opportunity may be enough).

**What does not get a ninth category:** raw Historical log entries (every domain's own activity trail) are Milestones by default, not a separate taxonomy member — History (§10) is a priority/surface concern (§5), not a content-type concern.

---

## 4. Decision Engine Architecture

Not a new database, not a new service to build in this phase — the canonical **shape** every future implementation must follow, replacing what is today several independently-computed engines (`lib/dashboard/service.ts`'s own inline logic, `lib/luv/observations.ts`, `lib/notifications/digest-engine.ts`, the future Reports layer) with one pipeline:

```
1. PUBLISH   — a domain (§2) writes a Fact about its own state (already happens today,
               scattered across every domain's own tables/columns).
2. CLASSIFY  — the Fact is assigned exactly one of the 8 taxonomy types (§3), by a fixed
               rule owned by the Decision Engine, never by the publishing domain and
               never by the rendering surface.
3. PRIORITIZE — the classified item is assigned exactly one priority tier (§5), again by
               a fixed rule (not a learned/scored model in this phase — matching
               `docs/luv-platform-intelligence-architecture.md` §4's own explicit
               deferral of confidence-scored prioritization to a future phase).
4. ROUTE     — the (type, priority) pair determines which surfaces may show it (§5's
               matrix) — never "all of them."
```

**Correlation (Insight generation) is the one step that reads across domains** — everything else in the pipeline operates on one domain's Facts at a time. This matches exactly how `docs/luv-platform-intelligence-architecture.md` §5 already describes Luv's unique role ("Event Readiness cannot say 'Seating is waiting because...' — that requires reading two capabilities' facts together"). The Decision Engine's Classify step is where that correlation happens; Luv (§7) is the *surface* that narrates the Insights the engine produces, not a second engine computing them independently.

**State comparison ("did this just become true?") is the one piece of new persistence this whole document requires** — already identified correctly in `docs/luv-platform-intelligence-architecture.md` §2/§9 as "a record of what Luv has already said," scoped per booking, per transition. This document generalizes that same requirement platform-wide: the Decision Engine needs to know what it already classified and surfaced, for every domain, not just Luv's — otherwise Milestones re-fire as Celebrations on every recompute.

---

## 5. Priority Hierarchy

Seven tiers — a strictly separate axis from the taxonomy (§3). A Payment Alert and a Task Alert are both "Alert" type, but land in different priority tiers depending on real urgency, not their taxonomy type alone.

| Priority | Meaning | Example | Existing precedent |
|---|---|---|---|
| **Critical** | Financial or relationship consequence if missed today. | Payment overdue; an inquiry unanswered past its escalation threshold. | `docs/notification-system-redesign.md` §1 "Business Critical" |
| **Needs Attention Today** | Requires action today, lower stakes than Critical. | A task overdue; a request awaiting review. | Event Readiness's `needs_attention` status; Luv doc §4 item 1 |
| **Upcoming** | Known, date-driven, not yet urgent. | "Final payment due in 5 days"; "3 tours this week." | Luv doc §3 "Upcoming"; Luv doc §4 item 2 |
| **Informational** | Worth knowing, no action implied. | "11 of 14 guests seated." | Luv doc §3 "Facts" (non-urgent) |
| **Historical** | Already resolved or routine — the record, not the news. | A completed task; a sent message. | Activity log, unchanged today |
| **Learning** | Pattern/trend content — understanding the business over time, not a today-action. | "Bookings are up 12% vs. last month." | Luv's Trend Deltas / Story Mode (`lib/luv/trends-service.ts`) |
| **Celebration** | A curated Milestone (§3), always its own tier — never buried under Critical, never delayed by escalation logic. | "Contract signed 🎉" | Luv doc §2/§3 "Celebrations" |

**Which priorities appear where — nothing appears everywhere:**

| Priority | Dashboard | Daily Email | Notification Center | Luv | Reports | History |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Critical | ✓ | ✓ | ✓ | — | — | after resolution |
| Needs Attention Today | ✓ | ✓ | ✓ | — | — | after resolution |
| Upcoming | ✓ (near-term only) | — | — | — | — | — |
| Informational | — | — | — | — | — | — |
| Historical | — | — | ✓ (archive) | — | — | ✓ |
| Learning | — | — | — | ✓ | ✓ | — |
| Celebration | ✓ (recent only) | ✓ (recent wins) | ✓ | ✓ (narrated) | — | ✓ |

Informational items are deliberately shown on **none** of these six surfaces by default — they exist to answer a specific question when asked (a detail page, a search), never pushed. This is the sharpest departure from today's implementation, where `lib/dashboard/service.ts` currently surfaces a large volume of plain Facts (pipeline counts, recent activity) alongside genuinely urgent items with no priority separation — see §11.

---

## 6. Dashboard Architecture

**The Dashboard is the venue owner's morning briefing — not the analytics center, not a report, not a widget collection.** It answers exactly four questions, and nothing else:

1. What matters today? (Critical + Needs Attention Today)
2. What changed? (Celebration, recent)
3. What requires attention? (same as #1 — restated because "requires attention" and "matters" are the same priority tier, not two separate sections)
4. What can wait? (Upcoming, near-term only)

### Permanent structure (not cards)

| Section | Contains | Priorities | Permanent or collapsible? |
|---|---|---|---|
| **Today's Attention** | Every Critical + Needs Attention Today item, venue-wide, sorted by urgency then date proximity | Critical, Needs Attention Today | Permanently visible; **never collapsible** — this is the one section the Dashboard exists for |
| **Upcoming** | Near-term Reminders (7-day default, matching the existing `getDailyBriefing`'s own window) | Upcoming | Collapsible |
| **Recent Wins** | Celebrations since last visit (reusing the exact "since I last looked" mechanism `getDailyBriefing` already implements via `luv_briefing_views`) | Celebration | Collapsible; **disappears entirely once nothing new has fired** — no permanent "no wins yet" placeholder |
| **Business Snapshot** | Canonical Metric values only (`lib/metrics/registry.ts`) — Bookings this month, Gross Booked Revenue — never a full Report | Informational (deliberately, a narrow exception — see below) | Collapsible |
| **Venue Health** | The single Venue Health score/tier (`lib/metrics/health.ts:getVenueHealth`) | Informational (deliberately, same exception) | Collapsible |
| **Getting Started (Guided Setup)** | Onboarding checklist — already correctly a presentation layer over the Activation Engine, per `20261138000000_guided_setup_activation_checklist.sql`'s own header | n/a — onboarding, not operational | **Disappears entirely once complete** — already the exact behavior `lib/dashboard/service.ts`'s `buildGuidedSetupChecklist` implements today; correct, keep as-is |

**The one deliberate exception to "Informational never appears on the Dashboard" (§5):** a small number of always-current Business Snapshot numbers (Bookings this month, Gross Booked Revenue this month, Venue Health) are permitted as a fixed, minimal strip — not because they're urgent, but because "what am I supposed to do today" for a venue owner is inseparable from "how is the business doing right now," in the same glance, at the top of the day. This must stay **small and fixed** (a handful of numbers, never a filterable table, never a chart) or it silently becomes the analytics center the brief explicitly forbids the Dashboard from being.

**What never belongs on the Dashboard:** any Informational item beyond the fixed snapshot strip above; any Historical item (that's Activity/Reports); any Learning-tier content (that's Luv, narrated, not raw); a date-range picker, a filter, an export button — those are Report-shaped affordances (§8) and their presence on a page is itself a signal that page has drifted from Dashboard into Report.

**Escalation and disappearance:** an item's priority can move (Upcoming → Needs Attention Today → Critical, as its own threshold is crossed — the same domain-owned thresholds §2 already governs, never a Dashboard-invented clock). A resolved item disappears from Today's Attention immediately, and — if it was Celebration-worthy — appears once in Recent Wins, then ages out after the "since last looked" window closes (matching the existing `getDailyBriefing` mechanism exactly).

---

## 7. Luv Architecture

**`docs/luv-platform-intelligence-architecture.md` already is Luv's canonical architecture** — its per-capability observation catalog (§1), Trust Model (§6), Event Readiness relationship (§5), and Feature Completion Contract (§7) are adopted, not redesigned here. This section states only what changes in light of the broader system this document defines, and confirms the rest still holds.

**Luv is an optional workspace, never required navigation — unchanged, restated as a hard constraint on every surface, not just Luv's own:** the Dashboard (§6) must be fully usable with Luv disabled, because every Dashboard section is built from Observations/Alerts/Reminders/Celebrations directly, none of which require Luv to exist. Luv adds Insight and the narrated form of Learning and Celebration — it never becomes the only path to an Observation, Alert, or Reminder. This is the one constraint this document adds beyond what the Luv doc itself states: **the Dashboard's dependency graph must have zero edges into Luv's own tables** (`luv_memories`, `luv_insights`, `luv_recommendations`, etc.) — only into the Decision Engine's classified-item stream, which Luv also reads, never produces exclusively.

**What belongs only in Luv** (per the brief, reconciled against the existing doc's own vocabulary):

| Belongs only in Luv | Existing Luv doc reference |
|---|---|
| Trend analysis / "what changed and why" | §8 "Narration," Trend Deltas |
| Pattern recognition across bookings | §8 "Cross-booking pattern recognition" (explicitly deferred to a future phase there too) |
| Explanations (Insight-tier content, §3 of this document) | §6 "Inferences" |
| Recommendations, narrated with reasoning | §6 tier 3 |
| Learning / Memory | `luv_memories` (§0 — currently non-functional, repair scoped in that doc's own §9 Phase 1) |
| Conversation (couple-facing `luv-ask`) | §8 |
| Draft generation | §8 ("four genuinely separate... integrations") |

**Never duplicated in Luv:** raw Observations already on the Dashboard. Luv's job is to add the "why" and the "what should I do" on top of a fact the Dashboard already states plainly — never to restate the fact itself in different words. This is the single sharpest, most concrete test for "is this Luv content or Dashboard content": **if removing Luv would make the fact itself disappear (not just its explanation), it was misplaced.**

---

## 8. Reporting Architecture

**Reports answer "how are we performing." The Dashboard answers "what should I do today."** (This document's own restatement of exactly the distinction already reached in this session's own `docs/reporting-analytics-architecture-certification.md` — carried forward here as a platform-wide rule, not re-derived.)

The dividing line, made mechanical rather than a matter of taste:

- A Report is **period-scoped** (a selectable date range) and **historical-by-default** (it summarizes what already happened). A Dashboard number is **always "as of right now,"** never a range.
- A Report may be **filtered and exported.** The Dashboard's Business Snapshot strip (§6) may not — the moment a number grows a filter or an export button, it has become a Report and must leave the Dashboard.
- A Report reads exclusively from `lib/metrics/registry.ts`'s canonical definitions (§2's Reporting row) — never a bespoke aggregation, per the Metric Definition Registry Certification's own core finding that duplicate ad hoc metric calculation is the root failure this whole initiative exists to close.
- A Report never contains a Recommendation or an Alert — those are Decision Engine content types (§3), routed to Dashboard/Notifications/Luv, never authored inside a Report. A Report may *display* Learning-tier content (a trend line), but that display is descriptive, not prescriptive.

---

## 9. Notification Architecture

**`docs/notification-system-redesign.md` already defines categories, channels, profiles, and escalation** — adopted, not redesigned. What this document adds: notification "categories" in that doc (Business Critical, Customer Communication, Planning Progress, Vendor Activity, Team Activity, Relationship & Growth, Luv) are a **presentation grouping**, a different axis entirely from this document's Ownership (§2) and Taxonomy (§3) — the reconciliation is that every notification-worthy item is *first* classified by the Decision Engine (type + priority), and *then* mapped into one of that document's seven experience-groups for how it's presented in the preference matrix. Neither axis replaces the other.

**What determines Notification vs. Email vs. Dashboard vs. Luv vs. Activity vs. History — exactly once, no duplicates:**

| Classified item | Where it appears | Reasoning |
|---|---|---|
| Critical / Needs Attention Today, unresolved | Dashboard + Notification Center (in-app), escalates to Email per `docs/notification-system-redesign.md` §4 | Time-sensitive, needs a push, not just a pull |
| Critical / Needs Attention Today, resolved | Moves to History (Notification Center's own archive) | Nothing more to say once resolved |
| Celebration | Dashboard (Recent Wins) + Notification Center + Daily Email's "recent wins" section + Luv (narrated) | The one type deliberately shown on the most surfaces — matches the brief's own instruction that Celebrations should be felt, not filtered away; still never duplicated in *content*, only in *placement*, since each surface presents the same underlying Milestone once |
| Upcoming (Reminder) | Dashboard only, near-term window | Not urgent enough to interrupt via Notification/Email |
| Informational | None of the six surfaces by default (§5) | Available on the relevant detail page only |
| Learning | Luv + Reports | Never Notification/Email — a trend is never "urgent" |
| Insight | Luv only | By definition requires Luv's narration to be legible at all |
| Recommendation | Luv (primary) + Dashboard (only if attached to a Critical/Needs-Attention-Today Alert) | A standalone Recommendation with no urgent Alert behind it belongs in Luv, not pushed to the Dashboard |
| Opportunity | Luv (primary); Dashboard only if it's also independently an Alert or Celebration | Prevents the Dashboard from filling up with "nice to have" notices |

**"Exactly once" is enforced by the routing rule above being a function, not a checklist** — a given classified item's (type, priority, resolved-state) tuple determines its surface set deterministically; no surface independently decides to also show something because it seems relevant.

---

## 10. Daily Briefing Specification

**A working Daily Briefing already exists** (`lib/luv/briefing-service.ts:getDailyBriefing`) with four sections matching this document's own model closely: `needsAttentionNow`, `comingUpThisWeek`, `resolvedSinceLastLooked`, `informational`. This specification confirms that shape as canonical and tightens it against the taxonomy/priority model above — it is not a new design.

| Section | Priority source | Maximum items | Ordering |
|---|---|---|---|
| Needs Attention Now | Critical + Needs Attention Today | Unbounded by design today (every `needs_attention` Event Readiness section, venue-wide) — **this document recommends a cap** (e.g. top 10, "+N more" linking to Dashboard) once venue size grows past what a morning glance can absorb; not yet enforced in the live implementation | Event-date proximity (existing) |
| Coming Up This Week | Upcoming, 7-day window | Unbounded today; same capping recommendation | Date proximity (existing) |
| Resolved Since Last Looked | Celebration, since `luv_briefing_views.last_viewed_at` | Unbounded — self-limiting in practice, since it only contains what fired since the last visit | Most recent first (existing) |
| Informational | Facts/Upcoming beyond the urgent/this-week window | Unbounded today; lowest priority to cap first if a limit is ever needed | Date proximity (existing) |

**How completed work disappears:** immediately from Needs Attention Now (the underlying Event Readiness status changes; the briefing simply stops including it on next fetch — no explicit deletion needed, matching how `getDailyBriefing` already works). **How priorities move:** identical mechanism — an item's presence in a section is always a live re-computation against current state, never a stored priority that must be manually updated.

**Escalation within the Briefing itself:** not needed as a separate mechanism — an item already appears in Needs Attention Now the moment its domain-owned threshold crosses (§2), which *is* the escalation. `docs/notification-system-redesign.md` §4's escalation model (upgrading channels, not sections, the longer something is ignored) operates one layer up, on top of this same classification, not inside the Briefing's own four sections.

**Maximum sections: four, fixed** — matching the shipped implementation exactly. This document does not add a fifth. Adding "Business Snapshot"-style numbers to the Briefing (unlike the Dashboard's own small exception, §6) is explicitly **not recommended** — a morning email/briefing is read, not glanced at like a screen, and mixing "3 tasks need you" with "revenue is $12,000" in the same list dilutes the one job a briefing has.

---

## 11. End-to-End Information Flow

Two worked examples, traced through the full pipeline:

**Example A — a payment goes overdue.**
1. *Publish* (§2): `payment_line_items.status` transitions to `overdue` (Payments domain, already-existing trigger logic).
2. *Classify* (§3): the Decision Engine reads this transition. It is a threshold-crossing Fact → classified as **Alert**.
3. *Prioritize* (§5): overdue money → **Critical**.
4. *Route*: Dashboard's Today's Attention (immediately); Notification Center (in-app); escalates to Email per the notification redesign's escalation model if unresolved past its threshold; **not** Reports (Reports would later show "total overdue" as a Learning-tier trend, computed independently from the same canonical `canonical_outstanding_balance()`, never from this Alert record); **not** Luv unless a coordinator asks "why" — at which point Luv reads the same Alert plus the relationship's other Facts and produces an **Insight** ("this client's balance has been overdue since their last two follow-ups went unanswered — the Communication domain's own unread-count Fact, combined with this Alert").

**Example B — a contract is signed.**
1. *Publish*: `contracts.status` transitions to `signed` (Contracts domain).
2. *Classify*: this is a domain-defined transition point (§3's Milestone rule) — logged as a **Milestone** unconditionally. It is also on the platform's fixed celebration whitelist (`docs/luv-platform-intelligence-architecture.md` §2) → additionally classified as a **Celebration**.
3. *Prioritize*: Celebration is always its own tier (§5) — no competition with Critical/Needs Attention items.
4. *Route*: Dashboard's Recent Wins; Notification Center; Daily Email's recent-wins section; Daily Briefing's "Resolved Since Last Looked"; Luv narrates it ("🎉 [Client]'s contract is signed — that's 3 this month, ahead of last month's pace" — the trailing clause is a Learning-tier Insight, correctly generated by Luv, not stored as part of the Milestone record itself); **never** Reports directly (a Report would later show "contracts signed this month" as a canonical count, computed from the same underlying `contracts.signed_at` data Booking Conversion Rate already reads — never from this Milestone log).

Both examples demonstrate the same invariant: **one Fact, computed once, flows through Classify → Prioritize → Route, and every surface that shows it is reading the same classified item — never recomputing "is this urgent" or "is this worth celebrating" independently.**

---

## 12. PASS / FAIL Against Today's Implementation

| Question | Verdict | Evidence |
|---|---|---|
| Is there one canonical taxonomy today? | **FAIL** | Luv doc's 7 categories, Notification doc's 7 (different-axis) categories, and Dashboard's own ad hoc field names (`needsAttention`, `overduePayments`, `recentBookings`) are three unreconciled vocabularies before this document. |
| Is there one canonical priority model? | **PARTIAL** | Event Readiness's 4-status model and the Daily Briefing's 4 sections already agree with each other (a real, working precedent) — but neither Dashboard's own inline logic nor Notifications' escalation model shares that vocabulary explicitly yet. |
| Does the Dashboard already avoid being an analytics center? | **PARTIAL — FAIL, one clear violation** | `lib/dashboard/service.ts` mixes Today's-Attention-shaped data (needsAttention, overduePayments) with plain Informational content (pipelineStages, recentActivity, totalClients) in one flat return shape with no priority separation — exactly the "widget collection" the brief warns against. |
| Is the Dashboard usable with Luv disabled? | **PASS** | Confirmed: `luvObservations`/`trendObservations`/etc. are separate, individually-catchable fields (`.catch(() => [])`) alongside genuinely Luv-independent data (leads, payments, events) — the dependency is already structurally loose, even without this document's formal rule. |
| Does Luv duplicate Dashboard content today? | **FAIL, one confirmed instance** | `lib/luv/observations.ts`'s own ad hoc Website-completeness heuristic (`docs/luv-platform-intelligence-architecture.md` §1, "Website" section) is Luv computing a Fact no other domain owns — a duplicate-responsibility violation this document's Ownership model (§2) exists to prevent, already self-diagnosed in the source document. |
| Is there a working Daily Briefing? | **PASS** | `getDailyBriefing` is real, live, and its four-section shape already matches this document's model closely (§10) — one of the strongest pieces of existing alignment found in this whole review. |
| Is there a working Notification escalation model? | **FAIL — designed, not built** | `docs/notification-system-redesign.md` §4 explicitly states "no code has been written for any of this." |
| Does Reporting already read from one canonical metric source? | **PARTIAL** | This session's own canonical metrics layer (`lib/metrics/`) exists and is tested, but only one consumer (`get_venue_analytics`) has been migrated to it — see `docs/metric-registry-canonical-implementation.md`'s own Migration Matrix. |
| Is the "learned"/DB-backed Luv layer trustworthy today? | **FAIL, confirmed and consequential** | `docs/luv-platform-intelligence-architecture.md` §0: most SQL backing `luv_memories`/`luv_insights`/`luv_recommendations` selects from a `venue_users` table that was never created — every call fails silently, presenting as an empty state indistinguishable from "no data yet." |

---

## 13. Implementation Roadmap

Ordered by dependency, incorporating both existing documents' own phase plans rather than proposing a competing sequence:

1. **Repair the broken Luv data layer** — `docs/luv-platform-intelligence-architecture.md` §9 Phase 1(a), unchanged: fix the `venue_users` mismatch before trusting anything downstream of it. This blocks Insight/Learning-tier content platform-wide, not just Luv's own surfaces, since this document routes all Insight content through Luv.
2. **Retire Luv's two genuine forks** (HQ's `LuvInsights`, the Vendor Portal's `computeLuvData()`) — §9 Phase 1(b), unchanged.
3. **Implement the Decision Engine's Classify + Prioritize steps** (§4) as the one shared function every domain's Facts pass through — this is the first genuinely new work this document calls for, and everything else in this roadmap depends on it existing before Dashboard/Notification routing can honestly claim to follow §5's matrix rather than each surface's own ad hoc logic.
4. **Refactor `lib/dashboard/service.ts`'s return shape** to the six-section model (§6) — separating Today's Attention from the currently-mixed-in Informational content (pipelineStages, recentActivity), which is this document's one confirmed Dashboard violation (§12).
5. **Build Notification escalation** (`docs/notification-system-redesign.md` §4's own recommended scope: start with unanswered inquiries only, prove the shape, extend).
6. **Wire the Daily Briefing's five-way routing** (§9's table) so Celebrations reach every surface the model specifies, not just the two they reach today (Dashboard + Briefing).
7. **Cap the Daily Briefing's unbounded sections** (§10) — small, low-risk, deferred behind the higher-value work above.
8. **Extend the canonical metrics Migration Matrix** (`docs/metric-registry-canonical-implementation.md` §8) so Reports (§8 of this document) has more than one migrated consumer to read from.
9. **Luv Phase 4 — trust-tiered narration convergence** (`docs/luv-platform-intelligence-architecture.md` §9), now informed by this document's Insight/Learning routing (§9) so the four existing narration integrations converge onto surfaces this document has already specified, not a fifth independently-designed one.

Nothing in this roadmap requires a new table beyond the one already identified in both source documents (Luv's "last observed state" record, §4/§9) — every other step is refactoring existing computation into the shape this document defines, not new tracking.
