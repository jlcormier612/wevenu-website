# Hello to Cheers — Venue Dashboard Reconstruction (Phase 1) — Validation Report

**Date:** 2026-08-07
**Scope:** Real assembly, not architecture. Replaces `app/(app)/dashboard/page.tsx` (previously 21 rendered widgets) with the certified 5-section structure, one minimal Luv entry point, and Reports navigation — built exclusively from the six certified systems named in the brief.

---

## 1. A real gap found and resolved before building anything

**"Every piece of information must originate from the Decision Engine" cannot be literally true today** — `docs/dashboard-luv-experience-architecture.md` designed the Decision Engine (Publish → Classify → Prioritize → Route) but no prior phase implemented it as code. Phases 1–2 of the Component System built the *rendering* primitives (`AttentionList`, `StatTile`, etc.); nothing before this phase classified or prioritized information.

**Resolution:** `lib/dashboard-system/decision-engine.ts` is the first concrete implementation of that already-certified architecture — scoped narrowly to this one Dashboard, not a platform-wide service. It applies exactly the classification rules already written in the architecture doc (§2 Ownership, §3 Taxonomy, §5 Priority) to real, already-fetched data (`getDashboardData()`, unchanged) — it invents no new rule, no new threshold, no new data source. This is stated here rather than silently assumed, per the standing rule across this whole initiative: explain before proceeding when something doesn't hold up as written.

---

## 2. The Five Sections — what each is built from

| Section | Component | Source (all pre-existing, certified) | Cap |
|---|---|---|---|
| Morning Briefing | `AttentionList` | `classifyBriefingItems()` — Critical + Needs Attention Today + today's Upcoming only | 5 |
| Today's Attention | `AttentionList` | `classifyDashboardItems()` — Leads (overdue follow-ups), Tasks (overdue), Calendar (today's tours), Event Readiness (`data.briefing.needsAttentionNow` — the real, existing Daily Briefing engine, reused not re-derived) | 10 |
| Upcoming | `AttentionList` (one instance) | `classifyUpcomingItems()` — merges Tours + Events + Payments + Key Dates into one date-sorted list | 10 |
| Business Snapshot | `StatTile` × 6 | `lib/metrics/health.ts`/`booking.ts`/`revenue.ts` (canonical Metric Registry) + `data.totalLeads`/`data.upcomingEvents.length` | 6 |
| Quick Actions | plain link grid | 8 real, existing routes | 8 |
| Luv entry point | minimal card | `data.luvObservations[0]`/`data.recommendations[0]` — Luv's own already-computed top items, read-only | 1 + 1 + 1 |
| Reports | nav link only | `/analytics` | — |

**Business Snapshot's 6 metrics, exactly as specified:** Venue Health (`getVenueHealth()`), Bookings (`getBookingsThisMonth().length`), Revenue (`getGrossBookedRevenue()`), Pipeline (`data.totalLeads`), Outstanding Payments (`getOutstandingBalance()`), Upcoming Events (`data.upcomingEvents.length`). No charts, no trend deltas — matching the brief's own explicit exclusion.

---

## 3. A real duplication found and closed in this phase's own design, before it shipped

While building `classifyDashboardItems()`, both `data.overduePayments` (raw `payment_line_items.status='overdue'`) and `data.briefing.needsAttentionNow` (which already includes `computePaymentsReadiness` per booking) surface "a payment is overdue" — often for the same underlying situation. `DashboardPayment` carries no `eventId` to dedupe against cleanly. Rather than merge both and risk showing the same overdue payment twice, only the certified Daily Briefing feed is used for payment urgency in Today's Attention — the raw feed is deliberately not re-added. This is the concrete answer to this phase's own "Duplicate information removed" requirement, caught during construction rather than left for the comparison pass to find.

---

## 4. Old vs. New — Measured

| Measure | Old Dashboard | New Dashboard |
|---|---|---|
| Distinct widget/card components rendered (always-on, excluding one-time/conditional banners) | **18** (`DailyBriefingWidget`, `LuvWidget`, `HealthScoreWidget`, `ActivationWidget`, `CommunicationHealthWidget`, `MomentumWidget`, `StatBar`, `OverduePaymentsWidget`, `UpcomingPaymentsWidget`, `ClientEventsWidget`, `RecentBookingsWidget`, `KeyDatesWidget`, `NeedsAttentionWidget`, `FollowupsWidget`, `UpcomingToursWidget`, `PipelineSnapshot`, `TasksWidget`, `RecentActivityWidget`) | **6** (Morning Briefing, Today's Attention, Upcoming, Business Snapshot, Quick Actions, Reports nav) + 1 conditional (Luv entry) |
| Separate "attention/urgency" lists | **6** (`NeedsAttentionWidget`, `FollowupsWidget`, `UpcomingToursWidget`, `OverduePaymentsWidget`, `TasksWidget`, plus `DailyBriefingWidget` itself running in parallel) | **2** (Morning Briefing, Today's Attention) — both reading the same classified stream |
| Separate "upcoming/future" lists | **4** (`ClientEventsWidget`, `RecentBookingsWidget`, `KeyDatesWidget`, `UpcomingPaymentsWidget`) | **1** (Upcoming) |
| Visible top-level metrics | **~10+**, scattered (4 `StatBar` tiles + Venue Health score + 4 Activation dimensions + Communication headline, with no shared visual language) | **6**, one grid, one shared severity system |
| Clicks to a common action from the Dashboard itself | **1** for "New Lead" only (the one header button); **2+** for every other action (navigate to a list page, then find its own "new" button) | **1** for all 8 Quick Actions |
| Decision Engine coverage | **0%** — every widget computed or filtered its own notion of urgency inline, independently | **100% of Morning Briefing / Today's Attention / Upcoming** (all three route through `lib/dashboard-system/decision-engine.ts`); Business Snapshot reads the canonical Metric Registry exclusively; Quick Actions (static navigation) and the Luv entry point (Luv's own already-classified output, per the Ownership model's own rule that Luv publishes pre-classified Insights/Recommendations) are the two sections not reclassified by this Dashboard's own engine, by design — not an oversight, stated plainly rather than claimed as 100% of everything. |

---

## 5. Every Removed Element — Where It Moved

| Removed from Dashboard | Where it went |
|---|---|
| `MomentumWidget` (heating up / cooling off) | Its underlying signal (overdue lead follow-ups) is now in Today's Attention; the narrative "momentum" framing itself belongs to a future Relationship Workspace, per the brief's own routing table — not rebuilt here. |
| `HealthScoreWidget` (full score + dimension bars + strengths/gaps) | Reduced to one Business Snapshot stat tile (score only). **A real, honest gap**: no page currently shows the detailed Venue Health breakdown (dimensions/strengths/gaps) — `/analytics` shows *Client* Health, not Venue Health. The tile links to `/analytics` as the closest existing destination; recommend a dedicated Reporting-phase addition, not built here (out of this phase's scope). |
| `ActivationWidget` | Removed — this is progress/historical information for an established venue, not a "what do I need today" fact; routed to Reporting per the brief's own "Historical metrics → Reporting" rule. `GettingStartedCard` (new-venue onboarding, actionable) remains, since it's a different, action-required surface, not a historical metric. |
| `CommunicationHealthWidget` | Removed from the Dashboard; already lives on `/messaging/health` (Reporting), untouched. |
| `StatBar` (4 tiles) | Superseded by Business Snapshot's 6 canonical tiles; its underlying counts are now the actual item lists in Today's Attention/Upcoming rather than a redundant summary number. |
| `OverduePaymentsWidget` / `UpcomingPaymentsWidget` | Merged into Today's Attention (via the Daily Briefing's payment-readiness fan-out, §3) and Upcoming, respectively. |
| `ClientEventsWidget` / `RecentBookingsWidget` / `KeyDatesWidget` | Merged into the one Upcoming component. |
| `NeedsAttentionWidget` / `FollowupsWidget` / `UpcomingToursWidget` | Merged into Today's Attention (overdue/today) and Upcoming (future tours). |
| `PipelineSnapshot` (chart) | Removed per the brief's explicit "Pipeline charts → Reporting" rule; the pipeline *count* survives as one Business Snapshot tile, not a chart. |
| `TasksWidget` (all open tasks) | Reduced to overdue tasks only, inside Today's Attention — non-urgent open tasks are no longer shown on the Dashboard at all; this is a deliberate reduction, not an oversight, matching "only actionable work." |
| `RecentActivityWidget` | Per the brief's explicit "Recent Activity → Relationship Workspace" rule — removed. Relationship Workspace doesn't exist as a page yet; out of this phase's scope to build. |
| `LuvWidget` (7-section ambient feed) + `RecommendationsPanel` (full interactive panel) | Per the brief's explicit "Long recommendations → Luv" rule — replaced by the minimal, read-only Luv entry point (§2). The full interactive experience (dismiss, draft generation) belongs on a dedicated Luv page, not built here — matches the brief's own "Do not build the Luv page." |

---

## 6. What Stayed, Unmodified

`Greeting`, `MilestoneToast`, `DashboardLuvIntro`, `GettingStartedCard`, `DigestCallout` — none are widgets competing for "what matters today" attention; they are the header, a one-time celebration toast, a one-time welcome banner, new-venue onboarding, and a dismissible settings callout, respectively. None were touched.

---

## 7. Validation Evidence

- **Typecheck:** `npx tsc --noEmit -p .` — clean, diffed against this session's own established baseline; identical pre-existing, unrelated errors only.
- **Dev server:** confirmed running throughout, no new errors in its log after these changes. A live, pre-existing `GET /dashboard 200` in the same log (from before this phase's edits) confirms the route is genuinely reachable in this environment; this phase's own changes were not exercised through a fresh authenticated request (the same limitation stated in Phases 1–2 of the Component System work — reaching an authenticated session programmatically remains out of reach without building a real login flow, not attempted here either).
- **Methodology:** every real data source consumed by the new page (`getDashboardData()`, `lib/metrics/*`) was traced to its actual, existing implementation before being wired in — nothing was assumed from a field name alone.

---

## 8. Success Criteria Check

| Criterion | Status |
|---|---|
| A venue owner should understand their day within 15 seconds | Not independently user-tested this phase (no access to a real venue owner) — the *structural* claim is defensible: 6 sections vs. 18, one attention list instead of 6, one upcoming list instead of 4. |
| The Dashboard should contain only operational information | True by construction — every removed element (§5) was historical, analytical, or non-actionable, per the brief's own routing table. |
| Every section must render through the canonical component system | True — `AttentionList` × 3, `StatTile` × 6. The Luv entry point and Quick Actions grid are the two sections built from plain markup, not a canonical family, since the brief caps them tightly enough (1+1+1; 8 static links) that inventing a component for either would be the "new component family" this phase explicitly forbids. |
| Every piece of information must originate from the Decision Engine | See §1 and §4's honest accounting — true for Morning Briefing/Today's Attention/Upcoming; Business Snapshot reads the Metric Registry directly (itself a certified system, not a bypass); Quick Actions and the Luv entry point are the two named, deliberate exceptions. |
| Stop after the Dashboard reconstruction | Followed — Reporting and Luv's own pages were not touched or redesigned; mobile was not started. |
