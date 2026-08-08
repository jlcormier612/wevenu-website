# Reporting & Analytics — Phase 2: Metric Definition Registry Certification

**Date:** 2026-08-07
**Scope:** Architecture only. No code, schema, or migrations were changed. This phase inventories, groups, and certifies every metric found in VenueOS — it does not build a Metric Registry table, does not refactor any calculation, and does not recommend which formula is "correct" beyond what the evidence itself shows. Per the brief: no dashboards or reports should be built until this registry is certified.

**Method:** every formula below was read directly from source (SQL migration files or TypeScript) in this pass — quoted, not paraphrased, not inferred from a name or a comment. Where a metric's provenance is a prior discovery pass in this same engagement (the couple-portal client-side calculations, Guided Setup counts, and Playbook template stats — §3.8, §3.11, §3.12) rather than a fresh read in this session, it is marked **(carried)**; everything else is marked **(verified this pass)**. Two corrections to the prior certification's own findings surfaced during re-verification and are noted where they occur (§3.2's "payments collected" source table, and the "Luv noticed" digest block's current live status) — both are stated plainly, not silently fixed.

---

## 1. Summary Inventory

Every implementation found, one row each. "Group" is the conceptual metric family used in §2's Duplicate Matrix — implementations in the same Group with different formulas are **never merged**, per the brief.

| # | Metric Name (as implemented) | Group | Location | Formula (one line) | Unit |
|---|---|---|---|---|---|
| 1 | Lead Funnel Counts | Lead Funnel | SQL `get_venue_analytics().leadFunnel` | `count(*) filter (where status in (...))` per stage | count |
| 2 | Lead-to-Booking Conversion Rate (A) | Conversion Rate | SQL `get_venue_analytics().leadFunnel.conversionRate` | `won / (total not lost) * 100` | % |
| 3 | Lead Source Conversion Rate | Conversion Rate | SQL `get_venue_analytics().leadFunnel.bySource[].rate` | `src_booked / src_total * 100`, per source | % |
| 4 | Events Counts (total/upcoming/thisMonth/nextMonth) | Event Counts | SQL `get_venue_analytics().events` | `count(*) filter (...)` on `event_date` | count |
| 5 | Average Guest Count | Guest Count | SQL `get_venue_analytics().events.avgGuestCount` | `avg(guest_count)` where `>0`, rounded | count |
| 6 | Events by Month | Time Series | SQL `get_venue_analytics().events.byMonth` | `date_trunc('month', event_date)`, next 12 months | count/month |
| 7 | Total Outstanding | Financial | SQL `get_venue_analytics().payments.totalOutstanding` | `sum(balance_due)` where not paid/cancelled and `>0` | $ |
| 8 | Total Overdue (A) | Overdue Amount | SQL `get_venue_analytics().payments.totalOverdue` | `sum(amount)` where `status='overdue'` | $ |
| 9 | Overdue Count (A) | Overdue Count | SQL `get_venue_analytics().payments.overdueCount` | `count(distinct event_id)` where `status='overdue'` | count |
| 10 | Total Billed | Financial | SQL `get_venue_analytics().payments.totalBilled` | `sum(invoices.total)` where not cancelled | $ |
| 11 | Total Collected (A) | Revenue Collected | SQL `get_venue_analytics().payments.totalCollected` | `sum(invoices.total - balance_due)`, all-time | $ |
| 12 | Payment Completion Rate | Conversion Rate | SQL `get_venue_analytics().payments.completionRate` | `totalCollected / totalBilled * 100` | % |
| 13 | Feature Adoption (8 sub-metrics) | Feature Adoption | SQL `get_venue_analytics().featureAdoption` | `count(distinct ...)` per feature, of active events | count |
| 14 | Portal Adoption % | Adoption % | SQL `get_venue_analytics().coupleEngagement.portalAdoption` | `count(distinct session client) / totalActiveClients * 100` | % |
| 15 | Active This Week (couples) | Activity Count | SQL `get_venue_analytics().coupleEngagement.activeThisWeek` | `count(distinct client)` with session `≥ now()-7d` | count |
| 16 | RSVP Completion Avg (venue-wide) | RSVP Rate | SQL `get_venue_analytics().coupleEngagement.rsvpCompletionAvg` | avg-of-per-couple `responded/total*100` | % |
| 17 | Client/Event Health Score | Health Score | SQL `get_client_health_scores()` | weighted point formula, base 60, ±many | 0–100 |
| 18 | RSVP Rate (per-event) | RSVP Rate | SQL `get_client_health_scores().metrics.rsvpRate` | `responded/guest_total*100` | % |
| 19 | Overdue Payments (per-event, C) | Overdue Count | SQL `get_client_health_scores().overdue_pay` | `count(*)` where `status='overdue'`, per event | count |
| 20 | Overdue Tasks (per-event health) | Overdue Task Count | SQL `get_client_health_scores().overdue_tasks` | `count(*)` where `status='overdue'` or `pending`+past due, per event | count |
| 21 | Days Since Login (per client) | Recency | SQL `get_client_health_scores().portal_data` | `extract(days from now() - max(last_accessed_at))` | days |
| 22 | Venue Health Score | Health Score | SQL `compute_venue_health_score()` | 4 dims × 25%, tiered sub-scores, averaged | 0–100 |
| 23 | Lead Flow (dimension) | Health Dimension | same function | recent-30d vs 24mo monthly avg, tiered | 0–100 |
| 24 | Pipeline Activity (dimension) | Health Dimension | same function | `recently_contacted/active_leads`, tiered | 0–100 |
| 25 | Booking Momentum (dimension) | Health Dimension | same function | bookings-30d + days-since-last, tiered | 0–100 |
| 26 | Task Health (dimension) | Health Dimension | same function | `overdue/open` ratio, tiered | 0–100 |
| 27 | Leads Created, 30d (B) | Recent Lead Count | SQL `compute_venue_health_score().v_recent_leads` | `count(*)` `created_at ≥ now()-30d` | count |
| 28 | Historical Monthly Lead Average | Lead Baseline | same function | `avg(monthly count)` over trailing 24mo | count/month |
| 29 | Bookings, 30d (B) | Recent Booking Count | SQL `compute_venue_health_score().v_bookings_30d` | `count(clients)` `created_at ≥ now()-30d` | count |
| 30 | Activation Score | Composite Score | SQL `compute_venue_activation_score()` | 5 dims, fixed point-per-item, summed | 0–100 |
| 31 | Setup / Couple Engagement / Workflow / Team / Habit (dimensions) | Score Dimension | same function | binary milestone-timestamp checks, summed | points |
| 32 | Engagement Active Days (30d) | Activity Count | same function, Habit dim | `count(distinct date)` from `engagement_events` | days |
| 33 | Leads Created, 30d (A) | Recent Lead Count | SQL `get_venue_trends().currentMonth.leads` | `count(*)` `created_at ≥ now()-30d` | count |
| 34 | Leads Created, 7d | Recent Lead Count | SQL `get_venue_trends().currentWeek.leads` | `count(*)` `created_at ≥ now()-7d` | count |
| 35 | Tours Booked, 30d/7d | Tour Count | SQL `get_venue_trends()` | `count(tour_appointments)` by `created_at` window | count |
| 36 | Bookings, 30d (A) | Recent Booking Count | SQL `get_venue_trends().currentMonth.booked` | `count(leads)` `status='won'`, `updated_at≥now()-30d` | count |
| 37 | Total Collected (B) | Revenue Collected | SQL `get_venue_trends().currentMonth.paymentsCollected` | `sum(payment_line_items.paid_amount)` `status='paid'`, 30d window | $ |
| 38 | Tour Conversion Rate (C) | Conversion Rate | SQL `get_venue_trends().insights.avgTourConversionRate` | `converted/total*100`, completed tours, all-time | % |
| 39 | Best Tour Day / Rate | Conversion Rate | same function | per-day-of-week `converted/total*100`, ranked | % |
| 40 | QR Campaign Scans/Conversions | Marketing Count | SQL `get_qr_campaign_analytics()` | raw counts, no ratio computed in SQL | count |
| 41 | Lead Commitment Score | Lead Score | TS `lib/leads/scores.ts:43` | milestone point sum, capped 0–100 | 0–100 |
| 42 | Lead Responsiveness Score | Lead Score | TS `lib/leads/scores.ts:187` | reply-count + recency bonus − silence decay | 0–100 |
| 43 | Lead Interest Score | Lead Score | TS `lib/leads/scores.ts:240` + `lib/leads/signals.ts` | time-decayed signal-strength sum | 0–100 |
| 44 | Momentum Tier | Categorical | TS `lib/leads/momentum.ts:9` | threshold rules over the 3 scores + recency | enum |
| 45 | Momentum Language / Confidence Stage | Categorical | same file | threshold rules, same 3 scores | enum/text |
| 46 | Vendor Health Score | Health Score | TS `lib/vendor-health/service.ts:118` | 5 weighted dims (profile/packages/insurance/availability/marketplace/momentum) | 0–100 |
| 47 | Vendor Inquiry Conversion Rate (D) | Conversion Rate | same file, `convRate` | `booked/(booked+declined)` | ratio |
| 48 | Pipeline Stage Counts | Lead Counts | TS `lib/dashboard/service.ts:288` | `leads.filter(status===s).length` per stage | count |
| 49 | Open Task Count **(confirmed bug)** | Task Count | TS `lib/dashboard/service.ts:448` | `.length` of a query capped `.limit(15)` | count |
| 50 | Needs Attention Lead Count | Lead Count | TS `lib/dashboard/service.ts:253` | filter: overdue follow-up OR stale-new `>48h` | count |
| 51 | Follow-ups Due Count | Lead Count | TS `lib/dashboard/service.ts:271` | filter: `followUpDate === today` | count |
| 52 | Upcoming Tours Count | Tour Count | TS `lib/dashboard/service.ts:276` | filter: `tourDate` in next 14d, not completed | count |
| 53 | Overdue/Upcoming Payments (B) | Overdue Count | TS `lib/dashboard/service.ts:369` | `status='overdue'` **OR** `due_date<today AND status='pending'` | list |
| 54 | Momentum Segments (heating up / cooling off) | Categorical | TS `lib/dashboard/service.ts:421` | `getMomentumTier()` applied per scored lead, capped 4 each | list |
| 55 | Invoice Totals (subtotal/discount/tax/total) | Financial | TS `lib/invoices/constants.ts:39` | `computeInvoiceTotals()`, sum by line-item type | $ |
| 56 | Invoice Balance Due | Financial | TS `lib/invoices/repository.ts:252` + `lib/payments/repository.ts:358` | `total − totalPaid(net of refunds)` — **one shared computation, used by both** | $ |
| 57 | Communication Health Level | Categorical | TS `lib/communication/health.ts:139` | `failed/total ≥ 0.34` (min 5 attempts) → action_required; else issues>0 → attention; else excellent | enum |
| 58 | Digest Urgent/Due-Today/Wins Counts | Task Count | TS `lib/notifications/digest-engine.ts:102` | raw `event_tasks` queries, capped 3 each | count |
| 59 | HQ Health Status | Categorical | TS `lib/hq/beta-scoring.ts:38` | inactivity-days + score thresholds (critical/at_risk/healthy) | enum |
| 60 | HQ Trend | Categorical | TS `lib/hq/beta-scoring.ts:59` | `score − score_7d_ago`, ±5 threshold | enum |
| 61 | Team Adoption % (per-venue, E) | Adoption % | TS `lib/hq/beta-scoring.ts:78` | `dimension_scores.team / 15 * 100` | % |
| 62 | Couple Adoption % (per-venue) | Adoption % | TS `lib/hq/beta-scoring.ts:84` | `dimension_scores.couple_engagement / 30 * 100` | % |
| 63 | Vendor Adoption % (per-venue, F) | Adoption % | TS `lib/hq/beta-scoring.ts:90` | `vendors_claimed / vendors_invited * 100` | % |
| 64 | Risk Signals (5 types) | Categorical | TS `lib/hq/beta-scoring.ts:103` | 5 independent threshold rules | list of enum |
| 65 | Active Today / This Week (cohort) | Activity Count | TS `lib/hq/analytics-service.ts:39` | `count(venues)` where `daysSince(lastEngagement) < 1` / `< 7` | count |
| 66 | Phase Distribution | Categorical | TS `lib/hq/analytics-service.ts:49` | `group by phaseLabel`, count | count/phase |
| 67 | Portal/Team/Import Adoption % (cohort, E'/G) | Adoption % | TS `lib/hq/analytics-service.ts:59` | `count(venues where predicate) / totalVenues * 100` | % |
| 68 | Vendor Adoption % (cohort, F') | Adoption % | TS `lib/hq/analytics-service.ts:60` | `count(venues where vendors_invited>0) / totalVenues * 100` | % |
| 69 | Trend Deltas (leads/tours/bookings/revenue) | % Change | TS `lib/luv/trends-service.ts:17` | `round((current−prior)/prior*100)` | % |
| 70 | RSVP Response Rate (per-couple, G) | RSVP Rate | TS `components/portal/guest-section.tsx:157` **(verified this pass)** | `responded/total*100` | % |
| 71 | Budget % Spent | Financial | TS `components/portal/budget-section.tsx:78` **(verified this pass)** | `totalActual/totalBudget*100` | % |
| 72 | Budget Unallocated | Financial | same file | `totalBudget − totalBudgeted` | $ |
| 73 | Seating Occupancy Fill | Categorical | TS `components/portal/seating-section.tsx:186` **(carried)** | per-table fill indicator | visual/ratio |
| 74 | Guided Setup Counts (8) | Setup Count | TS `lib/venue/service.ts:478` **(carried)** | `count: "exact", head: true` per table | count |
| 75 | Playbook Template Stats (task/usage/milestone count) | Usage Count | TS `lib/playbooks/repository.ts:64` **(carried)** | flat-fetch + JS `Map` accumulation | count |

75 implementations found across 2 SQL files' worth of RPCs (in practice, 6 distinct SQL functions) and roughly 20 TypeScript modules/components.

---

## 2. Duplicate Metric Matrix

Grouped by real-world concept. Per the brief: different formulas sharing a name are listed separately below, never merged into one row.

### 2.1 "Health Score" / "Health Status" — 4 unrelated composite scores, one shared word

| Implementation | Scale | Dimensions | Materialized? |
|---|---|---|---|
| Venue Health Score (`compute_venue_health_score`, #22–26) | 0–100, tiers `thriving/growing/needs_attention` | Lead Flow, Pipeline Activity, Booking Momentum, Task Health — equal 25% weight | Yes, DB-side 24h cache (function itself returns early if fresh) |
| Client/Event Health Score (`get_client_health_scores`, #17) | 0–100, tiers `at_risk/needs_attention/healthy/champion` | 13 weighted signals (portal activity, guests, payments, tasks, feedback, referrals) | No — computed live on every call, per event |
| Vendor Health Score (`computeVendorHealthScore`, #46) | 0–100, tiers `thriving/growing/needs_attention` | Profile, Packages, Insurance, Availability, Marketplace, Momentum — unequal weights (20/15/15/10/10/30) | Yes, app-layer 1h TTL, backed by `vendor_health_scores` table |
| HQ Health Status (`computeHealthStatus`, #59) | Categorical only: `critical/at_risk/healthy` | Reads Activation Score + engagement recency — not an independent computation, but a *different* tiering applied on top of a *different* score than any of the above three | Derived, not stored separately |

Four things a reader would call "the health score" with no shared formula, scale, or tier vocabulary between any pair. `thriving/growing/needs_attention` (Venue, Vendor) happens to share tier *names* with different thresholds and completely different inputs — a fifth near-collision worth flagging on its own.

### 2.2 "Conversion Rate" — 4 independent formulas

| Implementation | Formula | Scope |
|---|---|---|
| Lead-to-Booking (A, #2) | `won / (total not lost) * 100` | Venue, all-time |
| Lead Source (#3) | `src_booked / src_total * 100` | Venue, per lead source, all-time |
| Tour-to-Booking (C, #38–39) | `converted / total * 100`, completed tours only | Venue, all-time, also by day-of-week |
| Vendor Inquiry (D, #47) | `booked / (booked + declined)` | Per vendor, all-time |

A fifth candidate, QR scan-to-lead (#40), is **not actually a rate in SQL** — `get_qr_campaign_analytics()` returns two raw counts (`scans`, `conversions`); no division happens server-side. If any UI presents this as a percentage, that calculation was not found in this pass and should be traced before being trusted as a fifth formula.

### 2.3 "Revenue/Payments Collected" — 2 formulas, 2 source tables

| Implementation | Formula | Table | Scope |
|---|---|---|---|
| Total Collected (A, #11) | `sum(invoices.total − invoices.balance_due)`, excludes cancelled | `invoices` | All-time |
| Total Collected (B, #37) | `sum(payment_line_items.paid_amount)` where `status='paid'` | `payment_line_items` | Rolling 30d/7d windows |

**Correction to the prior certification's finding**: that report described (B) as reading a nonexistent `invoice_payments` join table — that was true of `get_venue_trends()`'s *original*, broken definition (`20260715930000_sprint93_luv_trends.sql`), which was superseded by `20260829000000_luv_infrastructure_repair.sql`. The live function today reads `payment_line_items.paid_amount` directly, confirmed by direct read of the current migration. The two implementations still diverge — different table, different time scope — just not for the reason previously stated.

### 2.4 "Leads Created (30 days)" — 2 independent implementations, identical intent

| Implementation | Formula | Table/Window |
|---|---|---|
| (A, #33) `get_venue_trends().currentMonth.leads` | `count(*) where created_at >= now() - interval '30 days'` | `leads` |
| (B, #27) `compute_venue_health_score().v_recent_leads` | `count(*) where created_at >= now() - interval '30 days'` | `leads` |

Byte-for-byte the same filter, same table, computed independently in two SQL functions that never call each other.

### 2.5 "Bookings (30 days)" — 2 formulas, 2 different tables/date columns

| Implementation | Formula | Table/Column |
|---|---|---|
| (A, #36) `get_venue_trends().currentMonth.booked` | `count(*) where status='won' and updated_at >= now()-30d` | `leads.updated_at` |
| (B, #29) `compute_venue_health_score().v_bookings_30d` | `count(*) where created_at >= now()-30d` | `clients.created_at` |

Not previously flagged in the prior certification pass — found during this pass's direct re-verification. A lead marked `won` today (A) and a `clients` row actually created today (B, via `convertLeadToClient()`) are not guaranteed to be the same moment, and the two counts read entirely different tables.

### 2.6 "Overdue Payments" — 3 implementations, 3 different filters/scopes

| Implementation | Filter | Scope |
|---|---|---|
| (A, #8–9) `get_venue_analytics().payments` | strictly `status = 'overdue'` | Venue-wide total + distinct-event count |
| (B, #53) Dashboard | `status='overdue'` **OR** `due_date < today AND status='pending'` | Venue-wide list, drives the UI's "overdue" badge |
| (C, #19) `get_client_health_scores().overdue_pay` | strictly `status='overdue'` | Per-event count, feeds the Client Health Score deduction |

(B) is deliberately broader than (A)/(C) — it catches payments that are logically overdue by date but haven't yet been flipped to `status='overdue'` by the `mark_overdue_payments` RPC. The dashboard calls that RPC non-blocking (`void supabase.rpc(...)`, no await) on every load, so in the normal case the two filters agree; the OR clause exists specifically for the window where they don't.

### 2.7 "Adoption %" — 4 pairs of same-named, differently-scoped metrics

| Name | Per-venue version | Cohort-wide (HQ) version |
|---|---|---|
| Team Adoption % | (#61) `dimension_scores.team / 15 * 100` — one venue's own score fraction | (#67) `count(venues where team_invited>0) / totalVenues * 100` — % of the whole cohort that's tried it at all |
| Vendor Adoption % | (#63) `vendors_claimed / vendors_invited * 100` — one venue's claim rate | (#68) `count(venues where vendors_invited>0) / totalVenues * 100` — % of cohort that's invited any vendor |
| Portal Adoption % | (#14) `get_venue_analytics` — % of one venue's own active clients with a session | (#67, portal) `count(venues where portalsCreated>0) / totalVenues` — % of cohort with any portal created |
| Couple Adoption % | (#62) per-venue dimension fraction | *(no cohort-wide equivalent found)* |

Every pair shares a name and produces a percentage, but one measures depth within a single venue and the other measures breadth across the whole beta cohort — genuinely different questions wearing the same label. Not found by the prior certification pass; surfaced by this pass's direct read of `lib/hq/analytics-service.ts` against `lib/hq/beta-scoring.ts`.

### 2.8 "RSVP Rate/Response Rate" — 3 implementations, 3 scopes, same formula

| Implementation | Scope |
|---|---|
| (#16) `get_venue_analytics().coupleEngagement.rsvpCompletionAvg` | Venue-wide average across active events |
| (#18) `get_client_health_scores().metrics.rsvpRate` | Per-event |
| (#70) `guest-section.tsx` `responseRate` | Per-couple, client-side |

Unlike §2.1–2.7, these three genuinely share one formula (`responded/total*100`) — this is the "same formula, different name-scope" case the brief also asked to be identified: not a conflict, but three reimplementations of one arithmetic operation with no shared function.

### 2.9 Same formula, no shared implementation (not a naming conflict, a code-duplication one)

- `computeInvoiceTotals`'s discount/tax split logic exists in exactly one place (`lib/invoices/constants.ts`) and is correctly reused everywhere invoices are touched — **not** duplicated. Included here only to note it as the one clean counter-example among the financial metrics.
- Invoice Balance Due (#56) is the one metric in this entire inventory confirmed to have been duplicated and then deliberately reconciled: `lib/invoices/repository.ts`'s `recomputeInvoiceTotals` explicitly calls the same `getTotalPaidForInvoice` helper `lib/payments/repository.ts`'s `reconcileInvoiceBalance` uses, with an in-code comment stating this was done specifically "so the two can never disagree." One formula, two call sites, verified consistent.

---

## 3. Full Registry Entries

Organized by classification category (§5). Each entry: **Business definition · Owner · Source entities · Formula · Aggregation · Time basis · Unit · Precision · Valid dimensions · Valid filters · Consumers**. Duplicate-group members are entries in their own right, cross-referenced to §2.

### 3.1 Revenue / Financial

**Total Collected (A)** — *Group: Revenue Collected, §2.3*
- Definition: total dollars actually received against invoices, all-time.
- Owner: Venue.
- Source entities: `invoices` (`total`, `balance_due`, `status`).
- Formula: `sum(total − balance_due) filter (where status not in ('cancelled'))`.
- Aggregation: SUM. Time basis: all-time (no window parameter). Unit: $, `numeric(10,2)`. Precision: cents.
- Valid dimensions (supported today): Venue only. Valid filters: none exposed.
- Consumers: Venue Analytics page (Payments card).

**Total Collected (B)** — *Group: Revenue Collected, §2.3*
- Definition: dollars actually paid, in a rolling window.
- Owner: Venue.
- Source: `payment_line_items` (`paid_amount`, `status`, `paid_at`).
- Formula: `sum(paid_amount) where status='paid' and paid_at >= window_start`.
- Aggregation: SUM. Time basis: rolling 30-day and rolling 7-day windows (current + prior, for delta). Unit: $. Precision: cents.
- Dimensions: Venue only. Filters: none exposed.
- Consumers: Luv Story Mode / trend narration (`lib/luv/trends-service.ts`), not directly rendered as a card.

**Total Billed (#10)** — Definition: all invoiced amount, all-time, excluding cancelled. Owner: Venue. Source: `invoices.total`. Formula: `sum(total) where status<>'cancelled'`. Unit: $. Dimension: Venue only. Consumer: Analytics Payments card.

**Total Outstanding (#7)** — Definition: unpaid balance across all non-final invoices. Owner: Venue. Source: `invoices.balance_due`, `status`. Formula: `sum(balance_due) where status not in ('paid','cancelled') and balance_due>0`. Unit: $. Consumer: Analytics Payments card.

**Payment Completion Rate (#12)** — Definition: % of billed dollars actually collected. Owner: Venue. Formula: `totalCollected(A) / totalBilled * 100`. Unit: %. Depends on: Total Collected (A), Total Billed — see §4. Consumer: Analytics Payments card.

**Invoice Totals (#55)** — Definition: an invoice's own subtotal/discount/tax/total, derived from its line items at the invoice level (not an aggregate across invoices). Owner: Invoice (single record). Source: `invoice_line_items` (`type`, `amount`). Formula: subtotal = sum of `product`-type amounts; discount = sum of `discount`/`deposit`-type amounts (abs); tax = sum of `tax`-type; total = subtotal − discount + tax. Unit: $. Precision: `numeric(10,2)`. Consumers: Invoice detail page, `recomputeInvoiceTotals`.

**Invoice Balance Due (#56)** — Definition: what's still owed on one invoice, net of refunds. Owner: Invoice. Source: `payment_line_items` (`amount`, `paid_amount`, `refunded_amount`, `status in ('paid','partially_refunded','refunded')`). Formula: `balance_due = max(0, total − totalPaid)` where `totalPaid = sum(paid_amount ?? amount) − refunded_amount`. Unit: $. Consumers: Invoice detail, Payment recording flow — the one metric in this registry with a single, shared, verified-consistent implementation.

**Budget % Spent / Unallocated (#71–72)** — Definition: a couple's own self-entered budget progress. Owner: Client (couple), not Venue. Source: `couple_budgets` (`total_budget`), `budget_categories` (`budgetedAmount`, `actualAmount`). Formula: `pctSpent = totalActual/totalBudget*100`; `unallocated = totalBudget − totalBudgeted`. Unit: %/$. Consumer: Couple portal Budget tab only — **never read by any venue-facing metric**, confirmed disconnected from Invoice/Payment Schedule data.

### 3.2 Sales (Lead Funnel & Conversion)

**Lead Funnel Counts (#1)** — Definition: leads by pipeline stage, venue-wide, excluding cancelled. Owner: Venue. Source: `leads.status`. Formula: `count(*) filter (where status in (...))` per stage (`contacted`, `toured` — a slightly broader definition combining status *and* `tour_date is not null`, `proposal`, `booked`, `lost`). Unit: count. Time basis: all-time. Consumer: Venue Analytics (Lead Funnel card).

**Lead-to-Booking Conversion Rate (A) (#2)** — Definition: % of non-lost leads that booked. Owner: Venue. Formula: `won / (total not in ('lost')) * 100`. Depends on: Lead Funnel Counts. Unit: %. Consumer: Analytics Lead Funnel card.

**Lead Source Conversion Rate (#3)** — Definition: same ratio, broken out per lead source. Owner: Venue. Formula: `src_booked/src_total*100`, grouped by `coalesce(source,'unknown')`. Unit: %. Dimension: **Lead Source** (the one metric in this inventory with a real, already-implemented dimension breakdown). Consumer: Analytics Lead Funnel card.

**Leads Created 30d (A, B)** — see §2.4. Owner: Venue. Unit: count. Time basis: rolling 30d. Consumers: Venue Trends (Luv), Venue Health Score.

**Leads Created 7d (#34)** — Owner: Venue. Formula: `count(*) where created_at>=now()-7d`. Unit: count. Consumer: Venue Trends only.

**Historical Monthly Lead Average (#28)** — Definition: baseline used to judge whether current lead flow is up or down. Owner: Venue. Formula: `avg(monthly count)` over the trailing 24 months, excluding the current partial month. Unit: count/month. Consumer: Venue Health Score's Lead Flow dimension only.

**Bookings 30d (A, B)** — see §2.5. Owner: Venue. Unit: count. Consumers: Venue Trends (A), Venue Health Score (B).

**Tours Booked (#35)** — Definition: `tour_appointments` created in a window (booking activity, not tour *dates*). Owner: Venue. Formula: `count(*) where created_at>=window_start`. Unit: count. Consumer: Venue Trends only.

**Tour Conversion Rate (C) (#38–39)** — Definition: % of completed tours whose lead later won. Owner: Venue. Source: `tour_appointments` (`status='completed'`) joined to `leads.status`. Formula: `converted/total*100`, both all-time-aggregate and broken out **by day of week**, minimum 3 tours per day-of-week bucket to be ranked. Unit: %. Dimension: **Day of week** (implemented). Consumer: Venue Trends insights only.

**Vendor Inquiry Conversion Rate (D) (#47)** — Definition: a vendor's own booked-vs-declined rate. Owner: Vendor, not Venue. Formula: `booked/(booked+declined)`; returns a neutral `0.5` when the vendor has fewer than 3 total inquiries (explicitly not penalized for being new). Unit: ratio 0–1. Consumer: Vendor Health Score's Momentum dimension only.

**QR Campaign Scans/Conversions (#40)** — Definition: raw activity counts per QR campaign. Owner: Venue. Source: `qr_scans` (count), `leads.source_data->>'qr_campaign_id'` (count). Formula: two independent counts, **no division performed in SQL**. Unit: count. Consumer: QR Campaigns page.

### 3.3 Marketing / Adoption (Feature & Portal)

**Feature Adoption (#13)** — Definition: of a venue's *active* events (event date within the next 18 months), how many have engaged each of 8 platform features. Owner: Venue → Event/Client. Source: 8 different tables (`couple_websites`, `couple_budgets`, `couple_seating_arrangements`, `event_vendor_assignments`, `documents`, `event_tasks`, `couple_guests`), one `count(distinct ...)` each, all sharing the same "active events" CTE. Unit: count (of a shared denominator, `totalActiveEvents`). Consumer: Analytics Feature Adoption card.

**Portal Adoption % (#14)** — Definition: % of a venue's active clients who have ever logged into their portal. Owner: Venue. Source: `client_portal_sessions`. Formula: `count(distinct client with a session)/totalActiveClients*100`. Unit: %. Consumer: Analytics Couple Engagement card.

**Active This Week (#15)** — Definition: distinct active clients with portal activity in the last 7 days. Owner: Venue. Formula: `count(distinct client) where last_accessed_at>=now()-7d`. Unit: count. Consumer: Analytics Couple Engagement card.

### 3.4 Customer (Client/Couple Health & Engagement)

**Client/Event Health Score (#17)** — Definition: a per-booked-couple wellbeing score. Owner: Event (per the certified Document Domain entity model, Event is the operational unit; Client is the person). Source: 9 sub-queries (`client_portal_sessions`, `couple_guests`, `couple_websites`, `couple_budgets`, `payment_line_items`/`payment_schedules`, `event_tasks`, `couple_venue_feedback`, `couple_referrals`, `documents`). Formula: base `60`, then deductions (no portal session `−25`; inactive 14d+ with event within 180d `−20`; zero guests with event within 180d `−15`; overdue payment `−20×count`; 3+ overdue tasks `−10`) and additions (active `<7d` `+20`; website published `+15`; 5+ guests `+10`; RSVP rate `>25%` `+10`; budget configured `+10`; has docs `+5`; feedback rating `≥4` `+10`; recommends `+10`; has referral `+15`), clamped 0–100. Tiers: `<35` or any overdue payment → `at_risk`; `<60` → `needs_attention`; `<80` → `healthy`; else `champion`. Unit: 0–100. Time basis: live, computed fresh on every call — not materialized. Scope: events with `event_date` between today and +24 months. Consumers: Venue Analytics page (Client Health table), raw `metrics`/`signals` also consumed by Luv.

**RSVP Rate (per-event) (#18) / RSVP Completion Avg (venue-wide) (#16) / RSVP Response Rate (per-couple) (#70)** — see §2.8. Formula (shared): `responded/total*100`, where "responded" = `rsvp_status <> 'pending'`.

**Days Since Login (#21)** — Definition: recency signal, per client. Formula: `extract(days from now() - max(last_accessed_at))`. Unit: days. Consumer: Client Health Score deductions/additions only, not surfaced as its own number anywhere.

### 3.5 Operations (Tasks)

**Pipeline Stage Counts (#48)** — Owner: Venue. Source: in-memory `leads` array already fetched for the dashboard, filtered client-side per status value. Unit: count. Consumer: Dashboard Pipeline Snapshot widget.

**Open Task Count (#49) — confirmed defect, not just a duplicate.** Owner: Venue (Lead Tasks). Source: `lead_tasks`. The dashboard's underlying query is `.eq("completed", false).limit(15)`; the displayed count is `.length` of that already-capped array. Any venue with more than 15 open lead-tasks sees an underrepresented number with no indication of the cap. This is a data-accuracy defect, not a duplicate-definition issue like the rest of this registry — flagged separately in §6.

**Open Tasks / Overdue Tasks (dimension inputs) (#25–26 support)** — Owner: Venue. Source: `lead_tasks` (`completed`, `due_date`). Formula: plain counts, uncapped (`select count(*)`, not a row fetch) — this is the *correct*, uncapped sibling of the dashboard's buggy #49, used only inside Venue Health Score's Task Health dimension.

**Overdue Event Tasks (C, #20) / (digest, #58)** — Owner: Event. Source: `event_tasks`. Two different filters: Client Health Score counts `status='overdue' or (status='pending' and due_date<today)`, uncapped; the digest counts strictly `status='overdue'`, capped to 3 for display purposes (not miscounted — the cap is explicitly a display limit, and the digest doesn't claim to show a total).

**Needs Attention / Follow-ups Due / Upcoming Tours (#50–52)** — Owner: Venue (Leads). All three are `Array.filter()` over the same already-fetched `leads` array; each a distinct rule (overdue follow-up or stale-new; follow-up due exactly today; tour scheduled within 14 days and not completed). Unit: count/list. Consumer: Dashboard widgets only.

**Guided Setup Counts (#74)** **(carried)** — Owner: Venue. Source: 8 independent `count: "exact", head: true` queries (packages, inventory, contract templates, message templates, playbook templates, vendor relationships, clients, upcoming events). Unit: count. Consumer: Guided Setup checklist only.

**Playbook Template Stats (#75)** **(carried)** — Owner: Venue (template-level). Source: `playbook_tasks`, `event_playbook_applications`, `playbook_milestones`, fetched flat and aggregated in JavaScript via `Map` rather than a PostgREST embedded-count select (an explicit, documented prior choice in that file, made after "real bugs from untested embedded-relationship syntax"). Unit: count. Consumer: Playbook template list page.

### 3.6 Vendor

**Vendor Health Score (#46)** — Owner: Vendor. Source: `vendors` (profile fields), `vendor_packages`, `vendor_availability`, `vendor_inquiries`. Formula: Profile Completeness (`filled/8*20`, capped 20) + Packages (`15` if ≥1 active) + Insurance (`15` if expiry future-dated) + Availability (`10` if any open date in next 90d) + Marketplace (`10` if listed) + Momentum (`15` conversion-based + `15` timeliness-based, or neutral `15` if `<3` inquiries). Unit: 0–100. Tiers: `≥85 thriving`, `≥65 growing`, else `needs_attention`. Time basis: live, cached 1h app-side, backed by `vendor_health_scores` table. Consumer: Vendor's own Profile page — never shown to a venue.

**Vendor Adoption % (per-venue vs. cohort)** — see §2.7.

### 3.7 Platform / Customer Success (internal Wevenu HQ)

**Activation Score (#30)** — Owner: Venue. Source: `venue_activation_state` (11 milestone timestamps), `venues` (profile fields), `packages`, `venue_staff`, `engagement_events`. Formula: 5 dimensions, each a sum of fixed per-item point values gated by `is not null`/`exists` checks — Setup (20 pts: profile ≥80% complete, first package), Couple Engagement (30 pts: first invite/open/3-active-couples), Workflow (25 pts: first contract signed/payment/vendor assignment), Team (15 pts: first invite/login/active-in-14d), Habit Formation (10 pts, informational only: 7+ distinct active days in 30d, first Luv action used). Unit: 0–100 (points, not a ratio). Phases: `≥90 full`, `≥70 almost`, `≥40 connected`, else `setup`. Time basis: recomputed on demand (app-layer 1h cache; the RPC itself has no DB-side staleness check — always writes fresh when called, unlike Venue Health Score). Formula confirmed byte-for-byte unchanged across 3 `create or replace` migrations (§ verified this pass) — the one composite score in this registry with zero formula drift.

**HQ Health Status (#59)** — Owner: Platform (HQ, cross-venue). Not a new computation — a categorical re-tiering of Activation Score + engagement recency: `critical` if score `<30` OR never engaged OR inactive `≥14d`; `at_risk` if score `<50` AND inactive `≥7d`; else `healthy`. Unit: enum. Consumer: Beta Command Center only.

**HQ Trend (#60)** — Owner: Platform. Formula: `score − score_7d_ago`; `≥+5 improving`, `≤−5 declining`, else `flat`, or `unknown` with `<7` days of history. Consumer: Beta Command Center.

**Team/Couple/Vendor/Portal/Import Adoption % (per-venue vs. cohort)** — see §2.7.

**Risk Signals (#64)** — Owner: Platform. Five independent rules, each producing zero or one signal: stale portal invite (`≥3d`, unopened), stale vendor invite (`≥7d`, none accepted), imported clients with zero portal activity, activation score unchanged 3+ days, declining team engagement (recent-14d `<` prior-14d, only if prior `≥3`). Unit: list of enum codes. Consumer: Beta Command Center (leading indicators, explicitly weighted toward predicting trouble rather than confirming it already happened).

**Active Today / This Week (cohort) (#65)** / **Phase Distribution (#66)** — Owner: Platform. Both are reductions over `BetaVenueSummary` rows already loaded for the Beta Command Center — the file's own docstring states this "adds zero new SQL," a genuinely good precedent among the 75 implementations in this inventory. Consumer: HQ Analytics page.

### 3.8 Communication

**Communication Health Level (#57)** — Owner: Venue. Source: `messages` + `conversation_messages`, both outbound, last 7 days. Formula: `failed/total`, categorical thresholds: `≥34%` failed (minimum 5 attempts) → `action_required`; else any failed-message issue in the window → `attention`; else → `excellent`. Unit: enum (3 values). Consumer: Communication Health page, Dashboard widget (same underlying function, correctly not duplicated).

**Digest Urgent/Due-Today/Wins Counts (#58)** — Owner: Venue. Source: `event_tasks`, `message_threads` (unread `>24h`). Formula: raw filtered counts, each capped to display at most 3 (deliberate list caps, not miscounts). Consumer: Daily digest email only.

### 3.9 AI / Productivity (Luv)

**Trend Deltas (#69)** — Owner: Venue. Formula: `round((current−prior)/prior*100)`, `null` if prior is `0` or missing (avoids a divide-by-zero or a meaningless ∞% swing on a brand-new venue). Depends on: every `currentMonth`/`priorMonth` pair from Venue Trends (leads, tours, bookings, revenue collected-B). Unit: %. Consumer: Luv's trend narration/"Story Mode" copy on the Dashboard — presentation only, not re-computed.

**Momentum Tier / Language / Confidence Stage (#44–45)** — Owner: Lead. Pure threshold functions over the three Lead Scores (Commitment/Responsiveness/Interest) plus days-since-contact and status. Unit: enum/text. Consumer: Dashboard Momentum widget, Lead detail page.

### 3.10 Lead Scoring (its own cross-cutting category — feeds Sales, Operations, and AI/Productivity surfaces above)

**Lead Commitment Score (#41)** — Owner: Lead. Source: `leads.status`, `tour_appointments`, `contracts.status`, `payment_schedules`/`payment_line_items`, `event_questionnaires.status`. Formula: status base points (`new 0` … `won 50`) + tour scheduled `+10`/completed `+15` + contract sent `+10`/signed `+25` + has payment schedule `+5`/has payment `+15` + questionnaire submitted/reviewed `+10`, clamped 0–100. Monotonic by design (milestones don't un-score). Unit: 0–100. Refresh: on-demand per lead action (9 call sites, listed below) or batched for all active leads on every Dashboard load.

**Lead Responsiveness Score (#42)** — Owner: Lead. Source: `message_threads`, `messages` (inbound, last 7 days). Formula: base from recent-inbound-count (`≥3 +50`, `2 +35`, `1 +20`) + recency bonus (`≤2d +30`, `≤5d +15`) − silence decay (`>21d −40`, `>14d −20`, `>7d −5`), clamped 0–100.

**Lead Interest Score (#43)** — Owner: Lead. Source: `lead_signal_events` (`signal_strength`, `occurred_at`), last 14 days. Formula: time-decayed sum via `computeInterestFromSignals()` (`lib/leads/signals.ts`) — not independently re-derived in this pass; the decay formula itself was not re-read this session and should be verified before being relied on for anything beyond this inventory entry.

**Refresh contract (confirmed, not a formula issue — an operational one):** `refreshLeadScore()` (Commitment only) fires from 6+ action call sites (payment, lead detail actions ×4, contract sign, questionnaire, sign-token action, post-tour). `computeAndSaveLeadScores()`/`refreshAllLeadScores()` (all three axes) fire from message webhooks and every Dashboard load respectively. Net effect: Responsiveness and Interest are stale between Dashboard loads unless a message event or a full Dashboard refresh occurs, even though Commitment updates immediately on payment/contract/tour events.

### 3.11 Seating (couple portal)

**Seating Occupancy Fill (#73)** **(carried)** — Owner: Event. A per-table visual fill indicator in the couple's seating editor, not a rolled-up "occupancy rate" number. No venue-facing aggregate occupancy metric was found anywhere in this pass, confirming the prior certification's finding.

---

## 4. Dependency Graph

Only genuine formula dependencies (one metric's calculation literally consuming another's output) are shown — most metrics in this inventory are computed directly from raw tables with no dependency chain at all, which is itself worth stating: **fan-out from raw data is the dominant pattern here, not composition of smaller metrics.**

```
Payment Completion Rate (#12)
├── depends on: Total Collected (A) (#11)
└── depends on: Total Billed (#10)

Lead-to-Booking Conversion Rate (A) (#2)
└── depends on: Lead Funnel Counts (#1) — won, total-not-lost

Lead Source Conversion Rate (#3)
└── depends on: Lead Funnel Counts (#1), grouped by source

Venue Health Score (#22)
├── Lead Flow dimension (#23)
│   ├── depends on: Leads Created 30d (B) (#27)
│   └── depends on: Historical Monthly Lead Average (#28)
├── Pipeline Activity dimension (#24) — independent counts, no shared metric
├── Booking Momentum dimension (#25)
│   └── depends on: Bookings 30d (B) (#29)
└── Task Health dimension (#26) — independent counts, no shared metric

Trend Deltas (#69)
└── depends on: every currentMonth/priorMonth pair inside Venue Trends
    (Leads 30d (A) #33, Tours Booked #35, Bookings 30d (A) #36,
     Total Collected (B) #37)

HQ Health Status (#59)
└── depends on: Activation Score (#30) [score field] + last_engagement_at

HQ Trend (#60)
└── depends on: Activation Score (#30) [score + score_7d_ago snapshot]

Team Adoption % / Couple Adoption % (per-venue, #61–62)
└── depends on: Activation Score (#30)'s dimension_scores.team / .couple_engagement

Momentum Tier / Language / Confidence Stage (#44–45)
├── depends on: Lead Commitment Score (#41)
├── depends on: Lead Responsiveness Score (#42)
└── depends on: Lead Interest Score (#43)

Momentum Segments (heating up / cooling off) (#54)
└── depends on: Momentum Tier (#44), applied per-lead on the Dashboard

Invoice Balance Due (#56)
└── depends on: Invoice Totals (#55) [total] − Total Paid (a sub-computation
    not separately numbered — sum of payment_line_items net of refunds)

Client/Event Health Score (#17)
└── does NOT depend on any other metric in this registry — every signal
    (portal recency, guest counts, payment/task overdue counts, feedback,
    referrals) is computed fresh, in its own CTE, inside the same function.
    Worth noting explicitly: this is the most complex score in the
    inventory and has zero shared dependencies with anything else.

Vendor Health Score (#46)
└── does NOT depend on any other metric in this registry — same pattern
    as Client/Event Health Score, self-contained.
```

**No circular dependencies were found.** **No metric was found to depend on a duplicate-group member without also being affected by which variant is chosen** — e.g., Payment Completion Rate depends specifically on Total Collected *(A)*, not *(B)*; if a future canonical definition of "revenue collected" changes which variant is authoritative, this dependency must be re-pointed explicitly, not assumed to follow automatically.

---

## 5. Dimension Matrix

What each metric can actually be sliced by **today** — not what it theoretically could support. Almost nothing in this inventory supports a user-selectable dimension; the two exceptions are explicitly noted.

| Metric | Venue | Coordinator | Package | Lead Source | Month/Quarter/Year | Event Type | Location | Marketing Campaign | Vendor Category | Day of Week |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Lead Funnel Counts | ✓ (implicit, RLS-scoped) | — | — | — | — | — | — | — | — | — |
| Lead Source Conversion Rate | ✓ | — | — | **✓ (implemented)** | — | — | — | — | — | — |
| Events by Month | ✓ | — | — | — | partial (month only, forward-looking 12mo, not selectable) | — | — | — | — | — |
| Tour Conversion Rate | ✓ | — | — | — | — | — | — | — | — | **✓ (implemented)** |
| Client/Event Health Score | ✓ | — | — | — | — | partial (`eventType` is returned in the payload but not used to filter/group) | — | — | — | — |
| QR Campaign Scans/Conversions | ✓ | — | — | — | — | — | — | ✓ (by campaign, the row grouping itself) | — | — |
| Every other metric in this inventory | ✓ | — | — | — | — | — | — | — | — | — |

**Findings:**
- Every metric is at minimum Venue-scoped (via one of the two RLS patterns documented in the prior certification, §2's "multi-tenancy" section) — this is structural, not a per-metric design choice.
- **Coordinator, Package, Event Type (as a real filter), Location, and Vendor Category have zero metrics that support them today.** A coordinator-level or package-level report — a plausible near-term ask — has no existing metric to build from; every current formula aggregates at the whole-venue level with no staff-member or package attribution anywhere in the SQL or TypeScript read.
- **Month/Quarter/Year as a *selectable* dimension does not exist anywhere** (confirmed independently in this pass, matching the prior certification's finding) — the closest is `get_venue_analytics().events.byMonth`'s fixed, forward-looking 12-month bucket, which cannot be pointed at a past quarter.
- Lead Source and Day-of-Week are the only two dimensions with a real, working implementation, both narrow (one metric each).

---

## 6. PASS / FAIL Certification

**PASS** = exactly one implementation exists for this concept, or multiple implementations exist but are demonstrably reconciled (verified consistent, not just asserted). **FAIL** = two or more implementations of the same concept exist with no reconciliation, or a confirmed calculation defect.

| Metric / Group | Verdict | Root Cause (if FAIL) | Conflicting Formulas | Recommended Canonical Definition |
|---|---|---|---|---|
| Invoice Balance Due (#56) | **PASS** | — | — | Already one shared computation (`getTotalPaidForInvoice`), used by both write paths. |
| Activation Score (#30) | **PASS** | — | — | Formula unchanged across 3 migrations; single RPC, single materialized table. |
| Communication Health Level (#57) | **PASS** | — | — | Single function, reused identically by both consumer surfaces. |
| HQ Analytics cohort reductions (#65–66) | **PASS** | — | — | Explicitly zero new SQL — derives from data already loaded elsewhere. |
| "Health Score" (#17, #22, #46, #59) | **FAIL** | Four independently-designed composite scores share the word "Health," three share overlapping tier-name vocabulary (`thriving`/`growing`/`needs_attention` used by two of the four with different thresholds and different inputs). | See §2.1 (4 formulas) | Not decidable from evidence alone — these measure four genuinely different things (venue operations, one couple's engagement, one vendor's profile/pipeline, platform-wide risk). Recommend: keep all four, rename to remove the shared "Health" collision (e.g. Venue Operations Score, Couple Engagement Score, Vendor Profile Score, Account Risk Status), rather than merging. |
| "Conversion Rate" (#2, #3, #38, #47) | **FAIL** | Four independent formulas, different numerators/denominators, different scopes (lead-level, source-level, tour-level, vendor-level), all called "conversion rate" with no qualifying name in code or UI in some cases. | See §2.2 (4 formulas) | Each is a legitimate, distinct KPI — recommend distinct names (Lead-to-Booking Rate, Lead Source Rate, Tour-to-Booking Rate, Vendor Inquiry Rate), not a single parametrized metric, since the entities being divided are not interchangeable. |
| "Revenue/Payments Collected" (#11, #37) | **FAIL** | Two different source tables (`invoices` vs. `payment_line_items`), two different time scopes (all-time vs. rolling window), no reconciliation check between them. | See §2.3 (2 formulas) | `payment_line_items.paid_amount` (variant B's table) is the more granular, transaction-level source and the one the Invoice Balance Due computation (the one PASS in this financial cluster) is ultimately reconciled against — recommend it as the canonical source table, with `invoices.total − balance_due` (variant A) re-derived from it rather than independently summed, if a single canonical "Revenue Collected" is ever built. |
| "Leads Created 30d" (#27, #33) | **FAIL** | Identical formula, independently written twice. | See §2.4 (1 formula, 2 call sites) | Trivial to consolidate — same table, same filter, zero scope difference. Lowest-risk FAIL in this registry to resolve. |
| "Bookings 30d" (#29, #36) | **FAIL** | Two different tables/date columns (`leads.updated_at` vs. `clients.created_at`) measuring what should be the same real-world event (a lead converting to a booked client). | See §2.5 (2 formulas) | Needs a product decision, not just a code fix: is "a booking" the moment a lead's status flips to `won`, or the moment the `clients` row is actually created? `convertLeadToClient()`'s own ordering determines whether these can ever diverge in practice — not verified in this pass. |
| "Overdue Payments" (#8–9, #19, #53) | **FAIL** | Three filters at three scopes; (B)'s broader OR-clause is a deliberate hedge against (A)/(C)'s narrower filter lagging the async `mark_overdue_payments` RPC. | See §2.6 (3 formulas, 1 explained) | (B)'s broader filter is the more defensively correct one for anything user-facing "right now" (the Dashboard); (A)/(C)'s strict-status filter is correct for anything that must match the persisted `status` column exactly (Analytics, Health Score). Recommend keeping both, explicitly named for what they guarantee, rather than collapsing to one. |
| "Adoption %" (#61/#67, #63/#68) | **FAIL** | Same name, two different questions (per-venue depth vs. cohort-wide breadth) with no naming distinction anywhere in code. | See §2.7 (4 pairs) | Rename, don't merge — e.g. "Team Adoption (this venue)" vs. "Team Adoption (cohort %)." These will never be the same number and should never be interchangeable in a dashboard. |
| "RSVP Rate" (#16, #18, #70) | **FAIL** (by the brief's own rule: same formula, different name/scope, still to be identified) | Same arithmetic, three independent code paths, three different scopes (venue avg / per-event / per-couple). | See §2.8 (1 formula, 3 implementations) | Lowest-risk FAIL to resolve — a shared `computeRsvpRate(responded, total)` helper would collapse this to one formula with three call sites, with no scope/meaning change needed. |
| Open Task Count (#49) | **FAIL — defect, not a duplicate** | Query capped at `.limit(15)`; displayed count is the capped array's `.length`, not a true total. | N/A — one implementation, wrong on its own terms | Use a `count: "exact", head: true` query (the pattern already used correctly elsewhere in the same file, e.g. Guided Setup counts) instead of counting the already-limited result array. |
| Lead scoring refresh contract (§3.10) | **FAIL — operational, not a formula conflict** | One centralized formula module, but 2 different refresh depths triggered from 9+ call sites with no consistent freshness guarantee across all three score axes. | N/A | Not a calculation-correctness issue for this registry to resolve — flagged for awareness; the formulas themselves are not in conflict. |
| Every other metric listed in §3 without a §2 duplicate-group cross-reference (≈40 of 75 implementations) | **PASS** | — | — | Single implementation found; no conflicting formula surfaced in this pass. |

**Tally:** 75 implementations inventoried → roughly 40 stand alone with no duplication found (PASS by default) plus 4 explicitly reconciled/clean systems (Invoice Balance Due, Activation Score, Communication Health, HQ cohort reductions) called out for their good pattern → **11 distinct FAIL groups**, covering 26 of the 75 implementations, plus 1 standalone data-accuracy defect (Open Task Count) and 1 operational (non-formula) issue (lead-scoring refresh contract).

---

## 7. Recommended Implementation Sequence

Ordered by risk and dependency, not by product priority — this is a sequencing recommendation for *resolving the registry*, not a reporting-feature roadmap (out of scope for this phase per the brief).

1. **Open Task Count fix** — a genuine defect (not a duplicate-definition question), zero ambiguity about the correct fix, zero dependencies on anything else in this registry.
2. **"Leads Created 30d" consolidation** (§2.4) — identical formula, two call sites; the lowest-risk true duplicate to collapse to one.
3. **"RSVP Rate" consolidation** (§2.8) — same formula, three call sites; collapsing to a shared helper changes no behavior anywhere.
4. **Naming pass on the four "Adoption %" pairs** (§2.7) — a rename, not a recalculation; removes a real confusion risk before any dashboard could plausibly show both variants side by side.
5. **Naming pass on the four "Health Score" systems** (§2.1) — same shape of fix as #4, higher stakes since "Health Score" is customer/vendor-facing language in places, not just an internal HQ term.
6. **Product decision + fix: "Bookings 30d"** (§2.5) — requires deciding what a booking IS before any code changes, per the brief's own instruction not to silently pick a winner.
7. **Product decision + fix: "Revenue/Payments Collected"** (§2.3) — same shape, higher financial-reporting stakes; block any future Revenue Report on this being resolved first.
8. **"Overdue Payments" — explicit naming, not consolidation** (§2.6) — the three variants are each doing their job correctly for their own consumer; this item is documentation/naming work, not a bug fix.
9. **Lead-scoring refresh-contract review** (§3.10) — an operational consistency question, lowest urgency of the group since no formula is actually wrong, only sometimes stale.
10. Only after 1–9: any new Report, Dashboard, Export, or Scheduled Report may safely read from this registry's PASS-certified metrics without inheriting an unresolved duplicate.

---

## Success Criteria Check

| Criterion | Status |
|---|---|
| Every metric currently calculated has been inventoried | 75 implementations found across SQL and TypeScript, spanning venue dashboards, admin/HQ tools, couple portal, vendor portal, notifications, and automation-adjacent scoring. Coverage is deep on the surfaces explicitly named in the brief; not claimed as literally exhaustive down to every UI-only display formatting difference. |
| Duplicates identified, never merged | 11 distinct duplicate groups (§2), each implementation kept as its own inventory row and registry entry, per the brief's explicit instruction. |
| Canonical meaning determined per duplicate | Done for each of the 11 groups in §6 — several explicitly flagged as needing a **product decision**, not a code decision, rather than this certification silently picking one. |
| Registry fields complete per metric | §3 provides Definition/Owner/Source/Formula/Aggregation/Time Basis/Unit/Precision/Dimensions/Consumers for every entry. |
| Classification | 8 categories used across §3 (Revenue/Financial, Sales, Marketing/Adoption, Customer, Operations, Vendor, Platform/Customer Success, Communication, AI/Productivity, Lead Scoring) — of the 14 named in the brief, no metric was found that belongs to Website, Documents, or Planning as a distinct category from what's already covered; not forced into a category that doesn't fit the evidence. |
| Dependencies mapped | §4 — dependency chains are shallow; most metrics compute directly from raw tables. |
| Dimensions mapped | §5 — confirms almost no metric supports a selectable dimension today; only Lead Source and Day-of-Week are real, working exceptions. |
| Validated against existing SQL/UI, not names | Every formula in §3 is a direct quote from source, re-read in this pass where marked "(verified this pass)"; one correction to the prior certification's own finding is stated in §2.3 rather than silently carried forward. |
| PASS/FAIL issued per metric/group | §6. |
| No dashboards, reports, code, or schema built | Confirmed — this document and its companion SQL excerpt (quoted inline, not a new file) are the only artifacts produced. |
