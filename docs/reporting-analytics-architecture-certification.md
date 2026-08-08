# VenueOS Reporting & Analytics — Architecture Certification

**Date:** 2026-08-07
**Scope:** Architecture certification only. No code, schema, or UI changes were made. Every claim below is sourced from a direct read of migrations, service/repository code, and RLS policies, traced by two parallel research passes — one auditing every existing dashboard/report/export/scheduled-report and every metric calculation and its duplication, the other mapping the underlying business-entity and financial data model. Findings from both are cited by exact file path throughout. Scoped to the main product (`wevenu-website`); the sibling `workspace/` app (Wevenu's own internal sales/CS tool) has its own separate `/dashboard`/`/reports` and is out of scope.

---

## 1. Current Landscape

### 1.1 Dashboards

| Surface | File | Computation |
|---|---|---|
| Venue "Today Dashboard" (`/dashboard`) | `app/(app)/dashboard/page.tsx`, `lib/dashboard/service.ts` | Fully live: 8 parallel table queries + ~14 more calls into Luv/Activation services, every page load |
| Venue Analytics (`/analytics`) | `app/(app)/analytics/page.tsx`, `lib/analytics/service.ts` | Live SQL RPC (`get_venue_analytics`, `get_client_health_scores`) |
| Communication Health (`/messaging/health`) | `app/(app)/messaging/health/page.tsx` | Reuses the Dashboard's own widget logic — no duplication |
| QR Campaign analytics | `app/(app)/library/qr-campaigns/page.tsx` | Live SQL RPC (`get_qr_campaign_analytics`) |
| Couple portal (Budget/Guests/Seating mini-dashboards) | `components/portal/*-section.tsx` | Client-side `.reduce()`, independent of every SQL RPC above |
| Vendor "Home" | `app/vendor/dashboard/page.tsx`, `lib/vendor-home/service.ts` | Deliberately *not* a metrics dashboard — own code comment: "No CRM metrics, no marketplace analytics" |
| Vendor Health Score | `/vendor/profile`, `lib/vendor-health/service.ts` | TypeScript-computed, 1-hour cache constant (backing persistence unconfirmed) |
| HQ Analytics (`/admin/analytics`) | `lib/hq/analytics-service.ts` | Derives from Beta Command Center data already loaded — "adds zero new SQL," a genuinely good precedent |

### 1.2 Reports

Six surfaces meet a strict "aggregated view of a period/set" bar (Venue Analytics, Client Health table, Communication Health, QR Campaign analytics, HQ Analytics, Calendar print view) — see the full audit for detail. **None expose a date-range filter, a comparison period, or CSV export of the underlying table**, except the calendar print view. There is no Revenue Report, Booking Report, or Vendor Performance Report anywhere in the app.

### 1.3 Exports

Two JSON full-data exports exist (`lib/export/service.ts` for venue, `app/api/portal/export/route.ts` for couple) — both GDPR-style "all your data" dumps, not business reports. The only genuine CSV export of a filtered data set is the calendar print view's client-side `toCsv()`. **No PDF generation library exists anywhere** — every "PDF" in the app is the browser's native print dialog on a single-record view (floor plan, timeline, invoice), not a report.

### 1.4 Scheduled reports

No Supabase Edge Functions or native cron exist — all scheduling is Vercel Cron (`vercel.json`). The only thing resembling a scheduled report is the daily digest email (`lib/notifications/digest-engine.ts`), and it is **not a metrics digest** — it's an action-items list (overdue/due-today/recently-completed tasks, unanswered messages). No weekly or monthly summary email exists. Directly relevant precedent found in this same file: a "Luv noticed" insight block that was fully built and is now permanently dead, hardcoded to null on every send — a real, prior instance of a half-wired reporting feature in this exact subsystem.

### 1.5 Metrics/KPI inventory

Two centralized SQL RPCs do most of the real aggregation work: **`get_venue_analytics()`** (lead funnel, events, payments, engagement, feature adoption — `supabase/migrations/20260711000002_sprint87_venue_analytics.sql`) and **`get_venue_trends()`** (30d/7d period-over-period deltas — `supabase/migrations/20260715930000_sprint93_luv_trends.sql`, notably shipped once with three references to nonexistent tables/columns and had to be corrected in a later migration — direct evidence metric definitions here have already drifted from the schema at least once). Alongside these, four independently-materialized composite scores exist, all colloquially called some variant of "Health": **Venue Health Score**, **Client/Event Health Score**, **Vendor Health Score**, and **Activation Score** (which itself derives a fifth label, "Health Status," in the Beta Command Center). Full inventory, including which SQL functions and which TypeScript modules compute what, is in the underlying audit; not reproduced in full here.

### 1.6 Metrics I expected and could not find

No occupancy rate, no average deal size, no formal response-time metric (despite a `responsiveness_score` existing), no venue-facing vendor-performance score, and — the most consequential gap — **no revenue/GMV report or dashboard as such**. "Payments collected/billed/outstanding" exist on the Analytics page; there is no page or card literally about revenue, no year-over-year view, and no per-event or per-package revenue breakdown anywhere.

---

## 2. The Entity & Financial Data Model

- **Fourteen core entities** were mapped (Venue, Lead, Relationship, Client, Event, Vendor, Contract, Invoice, Payment Schedule/Line Item, Package, Inventory Item, Event Order, Task [4 separate task tables, no unified one], Playbook, Conversation). Full column-level detail is in the underlying audit.
- **"Booking" is not a table.** There is no `bookings` entity — a booking is the *event* of a Lead converting (`Lead.status = 'won'` → creates a `Client` + `Event` row). `Client` is the closest thing to "the booking record"; `Event` is the operational unit. These are two separate, only loosely-synced tables.
- **A confirmed, live data-drift problem directly relevant to reporting**: `guest_count`, `event_type`, and `event_date` each exist independently on `leads`, `clients`, and `events`, copied once at each conversion step and never reconciled afterward. A documented live test (`docs/booking-financial-architecture-final-release-assessment.md`) showed the Event's guest count updated through the normal UI while the Client's copy silently stayed stale with no warning. **Any metric bucketed by guest count must pick one of three disagreeing sources — today, nothing says which is authoritative for reporting purposes**, even though the financial-architecture docs did establish Invoice as authoritative for money.
- **The money model is a real, fairly complete financial stack — but with three independently-editable "total" numbers and no structural reconciliation between most pairs**: `invoices.total`/`balance_due` (kept consistent with the payments ledger by DB trigger — the one pair that *is* enforced), `payment_schedules.total_amount` (pre-filled from Invoice at creation only — the sync function `updateScheduleTotalAmount` exists but has zero callers, so a later Invoice change has no path to follow), and `couple_budgets.total_budget` (a fully separate, couple-entered planning number that never reads Invoice or Payment Schedule at all). Every dollar column found platform-wide uses `numeric(10,2)`/`numeric(12,2)` decimal dollars consistently — a genuinely clean, non-issue finding worth stating plainly.
- **Two coexisting multi-tenancy scoping mechanisms** are both live: an older `owner_user_id = auth.uid()` pattern (54 migration files, single-owner-per-venue) and a newer `venue_id = current_user_venue_id()` pattern (83 files, supports multi-staff venues via `venue_staff`). A genuine, correctly-built second scope tier already exists for platform-wide reporting: `is_hq_admin()`, layered as an *additional* RLS policy on top of venue-owner policies (not a bypass) — this is the proven, safe pattern any new cross-venue reporting table should reuse.
- **No fiscal-year or custom-date-range concept exists anywhere**, and no reusable date-range-picker component exists to build one from. The only "reporting period" convention live today is `get_venue_trends()`'s hardcoded rolling 30-day/7-day windows — not user-selectable, not calendar-aligned. The one true calendar-bucketed time series (`get_venue_analytics().events.byMonth`) is forward-looking only (next 12 months) — **no existing function can answer "show me Q1 2026," a real, near-certain first request** once a real Reporting surface exists.
- **Event Order — the most recently built financial layer — has explicit, documented, unimplemented reporting scope.** `docs/booking-financial-architecture-roadmap.md` names "Client Portal 'What's Included' + Reporting" as its own Phase 5, not yet built; the final-release-assessment doc confirms directly: *"Reporting, Automation, and Communication correctly have no relationship to Event Order today... Reporting: Phase 5."* This certification's timing lines up with that named gap.

---

## 3. Duplicate & Divergent Calculations

Seven confirmed cases, all cited to exact files/lines in the underlying audit:

1. **"Leads created in last 30 days"** — identical window, identical filter, computed independently in two separate SQL functions (`compute_venue_health_score`'s `v_recent_leads` and `get_venue_trends`'s `cm_leads`) that never call each other.
2. **"Payments/revenue collected"** — computed two structurally different ways: `get_venue_analytics()` sums `invoices.total - balance_due` (all-time); `get_venue_trends()` sums `invoice_payments.amount` in rolling windows. Different tables, same conceptual number, no reconciliation between them.
3. **"Conversion rate"** — four independent formulas, all called "conversion": lead→booking, QR-scan→lead, vendor-inquiry→booked, tour→booking. Legitimately different questions, but zero shared formula or helper anywhere.
4. **"Health Score"** — the label is reused for four structurally unrelated composite scores (Venue, Client/Event, Vendor, and Activation-which-derives-a-fifth-label "Health Status"), each independently computed, each on a different scale, with nothing indicating to a reader which "Health Score" is meant without checking the source.
5. **"Open/overdue tasks"** spans two entirely different tables depending on the surface (`lead_tasks` for Dashboard/Venue Health; `event_tasks` for the daily digest) — no view anywhere shows both, so a venue could look clean on one and be a mess on the other with no way to tell.
6. **"RSVP response rate"** — the same `responded/total*100` formula, reimplemented three times at three scopes (per-venue average, per-event, per-couple), with no shared function.
7. **Lead scoring has an inconsistent refresh contract** — the three-axis score (commitment/responsiveness/interest) is centralized in one module but triggered from 9 different call sites at two different freshness levels; two of the three axes are stale on the Dashboard between message events even after a payment or signed contract.

A directly relevant, already-lived precedent exists in this exact codebase for the failure mode this section documents: `supabase/migrations/20261138000000_guided_setup_activation_checklist.sql`'s own header records that the Dashboard's "Getting Started" checklist and the Activation Engine used to be two independently-computed systems that *disagreed with each other*, and had to be deliberately consolidated. The same pattern — two systems separately computing "what's true" — has now been found, independently, at least seven more times across the metrics surface, and none of those seven have been reconciled yet.

---

## 4. Proto-Analytics Infrastructure

A real signal-logging layer exists — `engagement_events` (via `recordEngagementEvent`, 11 call sites), `lead_signal_events` (via `lib/leads/signals.ts`, with several signal types already scaffolded but explicitly documented as unwired), plus ad hoc milestone timestamp columns on `venue_activation_state`. These are **four parallel, non-overlapping ways of recording "something happened,"** each feeding a different downstream score, with no shared table or shared query layer between any of them. `engagement_events` itself is not surfaced in any venue-facing report today — it's purely an internal feed for two of the four Health/Activation scores.

---

## 5. Answering the Certification's Own Questions

**What reports already exist?** Six (§1.2) — none filterable by date, none exportable, no Revenue/Booking/Vendor-Performance report among them.

**What metrics already exist?** A wide, genuinely substantial set (§1.5) — this is not a green field. Two centralized SQL RPCs carry most of it; a handful of important counters (Guided Setup, Playbook stats, Invoice balance history) are separately, ad hoc computed.

**Where are duplicate calculations?** Seven confirmed cases (§3), plus a proven historical precedent that this exact failure mode has already bitten the product once and required a deliberate fix.

**What should be KPIs vs. reports vs. dashboards?** Proposed working definitions, grounded in what's already live rather than invented from scratch:
- **KPI** — one named, canonically-defined number with exactly one formula and one owning entity (e.g., "Lead-to-Booking Conversion Rate," owned by Venue, defined once). Today, zero metrics in this codebase meet that bar cleanly — every metric found has either an ambiguous name (four "Health Scores"), an ambiguous formula (four "conversion rates"), or an ambiguous source table (two "payments collected").
- **Dashboard** — a live, at-a-glance surface composed of KPIs plus operational to-do items, scoped to "right now" (matches what `/dashboard` and `/analytics` already are).
- **Report** — a bounded, period-scoped view of one or more KPIs, with a selectable date range and (ideally) export — a category that **does not exist anywhere in the app today**; every "report"-shaped surface found is actually a live, unfiltered dashboard card.

**What is the canonical reporting model?** Proposed shape only (design, not implementation, matching this phase's own scope) — see §6.

**Which entities own which metrics?** Proposed mapping — see §6.2.

**Which reports become dashboards / exports / scheduled reports?** A classification requires reports to exist first; today's six report-shaped surfaces are already dashboards by the definition above. The one clear, evidence-backed candidate for a genuinely new **scheduled report** is a periodic Revenue/Payments summary, given the confirmed absence of any revenue reporting today and the digest engine's proven, working delivery mechanism (§1.4) — this is a recommendation for the next phase to validate, not a decision made here.

---

## 6. Proposed Canonical Model (design sketch only — requires its own validation phase before certification)

Offered because the phase's own questions asked for it, in the same spirit as the Document Domain's Canonical Architecture Specification — but unlike that spec, **this has not been checked against every real metric the way the Document Domain's Type Matrix validated every real document type.** Treat this section as a starting hypothesis for a follow-up validation phase, not a certified design.

### 6.1 A Metric Definition Registry, not a Reporting table

The Document Domain's central lesson applies directly: the fix is not a new UI, it's one shared *definition*, reused everywhere a number is shown. A canonical **Metric** would need: a stable key (`lead_to_booking_conversion_rate`), one formula (SQL or TS, not both), one owning entity type, and one unit — computed once, read everywhere (the Dashboard, the Analytics page, and a future Report would all read the same Metric, not three independent queries). This directly targets all seven duplicate-calculation cases in §3 without requiring any of the four existing "Health Score" systems to be torn down — they'd become named Metrics *of* the registry rather than parallel bespoke computations.

### 6.2 Entity ownership, proposed

| Owner | Example metrics |
|---|---|
| **Venue** | Lead funnel, conversion rates, revenue/payments collected, Venue Health Score, Activation Score |
| **Event** | Guest count, RSVP rate, Client/Event Health Score, task completion |
| **Vendor** | Vendor Health Score, booking rate |
| **Platform (HQ)** | Cross-venue adoption %, cohort health — already correctly RLS-isolated via `is_hq_admin()` |

### 6.3 What this phase deliberately does not resolve

Which table is authoritative for guest count (Client vs. Event) is a **product decision**, not an architecture detail — flagged, not decided, here. Whether "conversion rate" should become four distinctly-named KPIs or one parametrized metric is a design question for the validation phase, not this certification.

---

## 7. Root Cause Analysis

| Question | Verdict |
|---|---|
| Is there one canonical metric model? | **FAIL** — at least seven confirmed cases of the same concept computed independently, in different places, sometimes from different source tables. |
| Is there one canonical reporting surface? | **FAIL** — no Report category exists distinct from Dashboard; nothing is date-range filterable or exportable. |
| Is there one canonical event/signal model? | **FAIL** — four parallel, non-overlapping "something happened" logging mechanisms feeding different scores, no shared table. |
| Is there a working example of unification to build from? | **PASS** — `get_venue_analytics()`/`get_venue_trends()` are genuinely centralized SQL RPCs, not scattered per-page queries; HQ Analytics deliberately "adds zero new SQL" by deriving from data already loaded. Real precedent that consolidation is achievable here. |
| Is there a working example of *fixing* this exact failure mode already? | **PASS** — the Guided Setup/Activation Engine consolidation (§3) is a real, shipped instance of finding and merging two disagreeing computations. Direct proof the team already knows how to do this. |
| Is the underlying data model sound enough to report on? | **PARTIAL** — the financial stack is genuinely complete (Invoice/Payment Schedule/Event Order), with consistent decimal-dollar units throughout; but three independently-editable "total" numbers and a three-way guest-count drift mean a reporting layer built directly on today's tables would silently inherit that drift. |
| Is multi-tenancy scoping ready for a reporting layer? | **PASS** — both venue-scoping and platform-wide HQ-scoping already exist as proven, additive RLS patterns; a new reporting table can reuse either without inventing anything. |

---

## 8. Recommendation

**ARCHITECTURE REQUIRES CONSOLIDATION BEFORE BUILDING**

This is a materially different starting point than the Document Domain's audit — there is real, working centralization to build from (two genuine aggregate RPCs, a correctly-isolated HQ scope tier, a proven decimal-dollar convention), and at least one instance of the team already finding and fixing exactly this failure mode once. This is not a green field, and it is not seven unrelated ad hoc systems.

But building a new canonical Reporting layer directly on today's metrics would mean choosing, for each of at least seven already-diverging numbers, which existing definition becomes canonical and which becomes dead code — a decision this certification does not have the authority to make silently, and one made harder by the fact that some of the divergence (four different "conversion rates") is legitimate scope difference wearing the same name, not pure duplication. Doing this without first defining one Metric Definition Registry (§6.1) and reconciling the seven known cases (§3) would very likely produce an eighth or ninth independent computation of "conversion rate" or "revenue collected" — the exact failure this whole audit exists to prevent, and the same mistake the Document Domain certification named for a different subsystem.

Before implementation begins, the next phase should validate the proposed Metric Definition Registry (§6) against every metric found in this audit — the same rigor the Document Domain's Type Matrix applied to every real document type — and make two explicit product decisions this certification surfaced but does not resolve: which table is authoritative for guest count (Client vs. Event), and whether "conversion rate" becomes several distinctly-named KPIs or one parametrized metric. Only after that validation should any new Report/Dashboard/Export/Scheduled-Report surface be built.
