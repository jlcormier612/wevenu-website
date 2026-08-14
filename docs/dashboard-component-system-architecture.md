# Hello to Cheers — Dashboard Component System Architecture

**Date:** 2026-08-07
**Status:** Architecture only. No React, no SQL, no visual redesign. Builds directly on `docs/dashboard-luv-experience-architecture.md` (the Decision Engine, Taxonomy, Priority Hierarchy, and per-surface architectures) — this document defines the reusable UI vocabulary those decisions render through.

**Method:** a full inventory pass was run across every surface named in the brief (Venue Dashboard, Relationship Workspace, Client Portal, Vendor Portal, Admin/HQ, Luv, Activation, Analytics, Reporting) before any component family was named — 90+ individual components read and catalogued by file path, props, and structural shape. The families below are the actual duplicate clusters that inventory surfaced, not an assumed list. Full per-component detail lives in the research transcript this document was built from; §1 gives the consolidated counts and the clusters that matter for the catalog.

---

## 1. Inventory Summary — What Exists Today

90+ components read across 9 surfaces. The headline finding: **the same handful of visual shapes have been hand-built independently between 3 and 11 times each**, always slightly differently, never sharing an implementation.

| Duplicate cluster found | Independent implementations | Where |
|---|---|---|
| "Label + big number, bordered tile" (stat tile) | **9** | `stat-bar.tsx`, `kpi-strip.tsx`, `legal-dashboard-cards.tsx`, `admin/analytics` inline, `admin/system-health` `HeartbeatPill`, `analytics/events-card.tsx`'s `StatBox`, `messaging/health` inline row, `events/request-summary-card.tsx`, `events/booking-overview-summary.tsx`'s `SummaryTile` |
| "Donut/ring progress with centered %" | **4** | `analytics/couple-engagement-card.tsx`'s `Ring`, `portal/budget-section.tsx`'s `ProgressRing`, `portal/guest-section.tsx`'s `ProgressRing` (same name, separate code), `portal-shell.tsx`'s `ReadinessRing` |
| "Score + tier badge + dimension bars + strengths/gaps" | **3** | Dashboard `HealthScoreWidget`, Vendor `VendorHealthScoreWidget` (dead code, explicitly orphaned), HQ `venue-detail/overview-section.tsx` |
| "Checklist with per-item check icon" | **4** | `getting-started.tsx`, `booking-celebration.tsx`'s `WorkspaceChecklist`, `communication/readiness-checklist.tsx`, `settings/import-health-widget.tsx` |
| "Card > icon+title+description header > divide-y list of link rows with right-aligned date/status > empty state" (the dominant dashboard-widget shape) | **8**, plus 1 acknowledged intentional duplicate | `needs-attention.tsx`, `followups-widget.tsx`, `upcoming-tours.tsx`, `key-dates-widget.tsx`, `client-events-widget.tsx`, `recent-bookings-widget.tsx`, `tasks-widget.tsx`, `recent-activity-widget.tsx` — plus `vendor-luv-briefing.tsx`, which is a deliberate, self-documented copy of `daily-briefing-widget.tsx` |
| Domain status badge (`Record<Enum, BadgeVariant>` + thin wrapper) | **~11** | One per domain object: contracts, invoices, payments, documents, QuickBooks, vendors, onboarding, clients, events, leads, communication |
| Independently-defined severity/tier color systems | **~7 distinct enums**, no shared type | `HealthTier` (thriving/growing/needs_attention), `ReadinessStatus` (complete/needs_attention/waiting/not_started), Client Health's 4-tier (at_risk/needs_attention/healthy/champion), `CommunicationHealth["level"]` (excellent/attention/action_required), `stat-bar`'s `tone` (urgent/action/info/positive), HQ `HealthStatus`/`Trend`, `OnboardingEngagementStatus` |

**One genuinely good precedent already exists**: all 6 `components/analytics/*` cards share the exact same `if (!data) return <Card>…No data yet…</Card>` empty-state convention — proof that consistency is achievable here, not hypothetical (the same kind of "real, working exception" every prior certification in this engagement has found and preserved rather than discarded).

**Two competing empty-state philosophies exist side by side** — "always show a reassuring message" (dashboard widgets, analytics cards, Luv widgets) vs. "silently render nothing" (several portal tap-cards, HQ KPI/legal tiles) — a real inconsistency §6 resolves.

---

## 2. Canonical Dashboard Component Catalog

Not the brief's own example list preserved verbatim — determined from the actual inventory. Two of the brief's suggested names (**Briefing Card**, **Financial Summary**) turned out, on inspection, to be **compositions** of the atomic families below, not primitives of their own (§2.13). One (**Comparison Card**) turned out to be a **real gap** — narrated in text today, never a dedicated component (§2.12).

### 2.1 Metric Tile

- **Purpose:** one number, one label, at a glance. The single most duplicated shape in the codebase (9 independent implementations) — highest-priority consolidation target.
- **Allowed content:** a label, a value (number/currency/percent), an optional trend delta, an optional icon.
- **Required inputs:** `label`, `value`.
- **Optional inputs:** `severity` (§7), `trendDelta`, `icon`, `href` (tile becomes clickable).
- **Supported actions:** View (tile itself is the affordance when `href` present) — nothing else. A Metric Tile never carries Resolve/Dismiss/Ask Luv.
- **Priority levels allowed:** Informational, Historical, Critical/Warning (via `severity`, e.g. an overdue-amount tile). Never Celebration (that's §2.9).
- **Decision Engine driven:** yes, for aggregate Observations. A single classified Observation that is itself a count/sum renders here directly.
- **AI explanation:** no — a Metric Tile states a fact; if it needs a "why," that's an Insight Card (§2.11) placed adjacent, never inline.
- **Surfaces:** Dashboard, Reports, Relationship Workspace, Client Portal, Vendor Portal, Admin, Mobile. Not Luv directly (Luv references the same tile's underlying value inside narration, never re-renders the tile itself).

### 2.2 Attention List

- **Purpose:** a list of items competing for the venue owner's attention, one row per item, each with a date/status and a link. **This is the canonical home for both "urgent now" and "coming up" content — the same component, fed items at different priority tiers**, not two separate families (reconciling the brief's own separately-suggested "Attention List" and "Upcoming Timeline" — the inventory found 8 components that are this exact shape, none of them visually distinguishable from each other except by which priority of data they're fed).
- **Allowed content:** header (icon + title + optional description), a list of rows (each: primary label, secondary detail, right-aligned date or status badge, link), empty state.
- **Required inputs:** `title`, `items[]` (each with `id`, `label`, `href`, `priority`).
- **Optional inputs:** `icon`, `description`, `maxItems` (with "+N more"), `emptyState` override (§6).
- **Supported actions:** View (row navigates), Resolve/Review (row-level, when the item is an Alert requiring action), Dismiss (only for non-Alert, non-Critical rows — an overdue payment is never dismissible, a reminder may be).
- **Priority levels allowed:** Critical, Needs Attention Today, Upcoming, Historical (Activity Feed variant, §2.3, is the historical-only specialization of this same shape).
- **Decision Engine driven:** yes — this is the primary renderer for Alert, Reminder, and Opportunity taxonomy types (§ prior phase §3), and for Milestone entries once resolved.
- **AI explanation:** optional, per-row "Learn Why" action linking to an Insight Card — never inline text within the row itself (rows stay Fact-only, per the taxonomy's own Observation/Insight separation).
- **Surfaces:** Dashboard, Luv (as the Daily Briefing's own sections, §2.13), Relationship Workspace, Client Portal, Vendor Portal, Admin, Mobile. Not Reports (a Report shows Historical/Learning content, never an actionable attention list — §8).

### 2.3 Activity Feed

- **Purpose:** a chronological, non-actionable record of what already happened. The Historical-priority specialization of Attention List's row shape — same visual DNA, different content contract (no urgency, no action required, ordered by recency not priority).
- **Allowed content:** header, a list of past-tense rows (actor/action/timestamp), empty state.
- **Required inputs:** `title`, `entries[]`.
- **Optional inputs:** `icon` per entry type, `maxItems`.
- **Supported actions:** View only.
- **Priority levels allowed:** Historical exclusively.
- **Decision Engine driven:** yes — the default renderer for logged Milestones that were not classified as Celebrations.
- **AI explanation:** no.
- **Surfaces:** Dashboard, Relationship Workspace, Admin, Reports (as the "what happened" section of a report). Not Client/Vendor Portal today (no instance found) — not recommended to add without a real need.

### 2.4 Collection Card

- **Purpose:** a browsable list of domain objects that is neither priority-driven nor chronological — a library, not a queue. Distinct from Attention List (no urgency framing) and Activity Feed (not time-ordered, user-sortable/filterable instead).
- **Allowed content:** header, filter/sort controls (optional), a list or grid of item rows/cards, empty state.
- **Required inputs:** `items[]`.
- **Optional inputs:** `filters[]`, `sortOptions[]`, `viewMode` (list/grid).
- **Supported actions:** View, Open; domain-specific actions (Share, Download, Archive) render via the item's own action slot, not a fixed vocabulary member (§5 explicitly scopes the canonical action vocabulary to Decision-Engine-driven actions; a Collection Card's per-item actions are legitimately domain-specific since the items themselves are being managed, not just observed).
- **Priority levels allowed:** none — Collection Cards are not priority-classified content.
- **Decision Engine driven:** no. This is the one canonical family that exists outside the Decision Engine's pipeline entirely, by design — it renders domain records directly (documents, campaigns, clients), not classified decision items.
- **AI explanation:** no.
- **Surfaces:** Dashboard (rarely), Relationship Workspace, Client Portal, Vendor Portal, Admin. Not Luv, not Reports.

### 2.5 Pipeline Summary

- **Purpose:** a staged/funnel visualization — count (and optionally rate) per stage of a linear process. Confirmed as its own visual shape (bars-per-stage), not a Metric Tile grid, in 2 real instances (`PipelineSnapshot`, `LeadFunnelCard`).
- **Allowed content:** header, ordered stage bars (label, count, optional %, optional conversion-rate badge between stages).
- **Required inputs:** `stages[]` (each: `label`, `count`).
- **Optional inputs:** `totalLabel`, per-stage `rate`, `bySegment` breakout (mirrors `LeadFunnelCard`'s by-source rows).
- **Supported actions:** View (stage click navigates to a filtered list).
- **Priority levels allowed:** Informational, Learning (a funnel is descriptive, not urgent).
- **Decision Engine driven:** partially — stage counts are aggregate Observations; the component itself does not carry a single priority.
- **AI explanation:** optional — "Learn Why" at the header level (e.g., "why is Proposal→Signed down this month") links to an Insight Card.
- **Surfaces:** Dashboard, Reports, Admin. Not Luv, Client Portal, Vendor Portal, Mobile (no instance found; not recommended without a real use case).

### 2.6 Progress Tracker

- **Purpose:** "how much of X is done" — one input model, **two render variants** found in real use: a checklist (ordered items, each done/not-done) and a ring/bar (a single percentage). The inventory found 4 independent checklist implementations and 4 independent ring implementations that are the same underlying question asked two different visual ways — this document unifies the *model*, not the *visual*, since both variants are legitimate depending on whether the "items" are individually meaningful (a checklist) or only the aggregate matters (a ring).
- **Allowed content:** either a list of steps (label, done boolean, optional CTA) or a single percentage — never both in one instance.
- **Required inputs:** either `steps[]` (checklist variant) or `percent` (ring/bar variant).
- **Optional inputs:** `celebrateOnComplete` (boolean — triggers a Celebration Card, §2.9, the moment `percent` reaches 100 or every `step.done`, matching `getting-started.tsx`'s existing milestone-banner behavior), per-step `href`.
- **Supported actions:** Continue (per incomplete step), View.
- **Priority levels allowed:** Informational only — a Progress Tracker itself is never Critical; an incomplete *required* step may separately also exist as an Attention List Alert (the two are linked, not the same render).
- **Decision Engine driven:** no — this renders a domain's own completion state directly (Event Readiness, Activation, Guest Count Finalization), not a classified decision item.
- **AI explanation:** no.
- **Surfaces:** Dashboard, Relationship Workspace, Client Portal, Vendor Portal, Admin. Not Reports, not Luv directly.

### 2.7 Health Indicator

- **Purpose:** a numeric, tiered health score (0–100) with an optional dimension breakdown and strengths/gaps. Confirmed 3 near-identical implementations (Venue Health, Vendor Health, HQ's Activation variant) that should become one parameterized component.
- **Allowed content:** score, tier badge, optional per-dimension mini-bars, optional strengths list, optional gaps list (each gap linkable).
- **Required inputs:** `score` (0–100), `tier`.
- **Optional inputs:** `dimensions[]`, `strengths[]`, `gaps[]` (each with `href`).
- **Supported actions:** View (per gap, navigates to the fix).
- **Priority levels allowed:** Informational (the score itself); a `needs_attention`-tier gap may additionally exist as its own Attention List Alert — the Health Indicator states the score, it does not itself escalate.
- **Decision Engine driven:** yes — reads the canonical Health metrics (`lib/metrics/health.ts`, per the prior phase's own Ownership model) exclusively; never recomputes a score.
- **AI explanation:** optional — "Ask Luv" at the header level, for narrative context on *why* the score moved.
- **Surfaces:** Dashboard, Relationship Workspace (Relationship Health), Vendor Portal (Vendor Health, currently dead code — §9), Admin (Platform Health), Reports (historical score trend). Not Client Portal, not Mobile (no instance).

### 2.8 Status Card

- **Purpose:** a single **categorical** (non-numeric) overall status with a headline, a short detail, and an optional list of linked issues — distinct from Health Indicator, which is always a *score*. Confirmed instance: `CommunicationHealthWidget` (excellent/attention/action_required), already correctly reused as one component across two surfaces (Dashboard + Messaging Health report) — the cleanest existing precedent for this whole document's goal.
- **Allowed content:** headline, one-line detail, optional list of specific issues (each with a link).
- **Required inputs:** `level` (a severity enum, §7), `headline`, `detail`.
- **Optional inputs:** `issues[]`.
- **Supported actions:** View (per issue).
- **Priority levels allowed:** maps directly from `level` via §7's canonical severity map — Critical/Warning/Informational.
- **Decision Engine driven:** yes, for domain-level Alert/Observation summaries that are categorical rather than scored.
- **AI explanation:** no — a Status Card states the category; "why" belongs in an adjacent Insight Card if needed.
- **Surfaces:** Dashboard, Reports, Admin, Relationship Workspace. Not Client/Vendor Portal, not Luv, not Mobile (no instance).

### 2.9 Celebration Card

- **Purpose:** a one-time, warm, milestone-triggered moment — the exclusive renderer for the Celebration taxonomy type (prior phase §3). Confirmed real instances across a spectrum from full-page (`BookingCelebration`) to inline banner (`getting-started.tsx`'s milestone banner, `guest-section.tsx`'s RSVP milestone banners) to toast (`milestone-toast.tsx`) — three *sizes* of the same underlying concept, not three different components.
- **Allowed content:** a warm headline, an optional supporting detail/stat, an icon or celebratory visual treatment, optional next-step CTAs.
- **Required inputs:** `milestone` (the Milestone record it's celebrating — never rendered without one, per the prior phase's rule that every Celebration must be backed by a logged Milestone).
- **Optional inputs:** `size` (`toast` / `inline` / `full-page`), `nextSteps[]`.
- **Supported actions:** Continue (next-step CTAs), Dismiss.
- **Priority levels allowed:** Celebration exclusively — never mixed with Critical/Warning styling (§7 gives Celebration its own, distinct visual language, deliberately not urgency-red).
- **Decision Engine driven:** yes, exclusively — a Celebration Card only ever exists because the Decision Engine classified a Milestone onto the celebration whitelist.
- **AI explanation:** optional — Luv may narrate additional context ("that's 3 this month"), rendered as a trailing Insight-tier line, not a separate card.
- **Surfaces:** Dashboard, Luv, Client Portal, Vendor Portal, Notification/Email (per the prior phase's own routing table). Not Reports, not Admin (celebrations are relationship-facing, not operational-reporting content).

### 2.10 Recommendation Card

- **Purpose:** a specific, optional, linked next action — the exclusive renderer for the Recommendation taxonomy type. Confirmed instance: `RecommendationsPanel` (nested inside `LuvWidget`).
- **Allowed content:** the recommended action's label, a short "why" (optional, links to the Insight it was generated from), a primary CTA, a dismiss control.
- **Required inputs:** `label`, `action` (the linked next step).
- **Optional inputs:** `reasoning` (Insight reference), `generatedDraft` (for AI-drafted content, e.g. a follow-up message).
- **Supported actions:** the CTA itself (Continue/Open, depending on what it links to), Dismiss, "Learn Why" (expands `reasoning`).
- **Priority levels allowed:** Needs Attention Today (when attached to an Alert) or Informational (standalone, Luv-only — per the prior phase's own routing rule: "a standalone Recommendation with no urgent Alert behind it belongs in Luv, not pushed to the Dashboard").
- **Decision Engine driven:** yes, exclusively.
- **AI explanation:** inherent — a Recommendation Card *is* Luv-generated content; "AI explanation support" is not optional for this family, it's definitional.
- **Surfaces:** Luv (primary), Dashboard (only when attached to a Critical/Needs-Attention Alert, per the prior phase's routing table), Client Portal (couple-facing suggestions, e.g. seating). Not Reports, not Admin, not Vendor Portal (no instance).

### 2.11 Insight Card

- **Purpose:** Luv's own narrative/explanation content — the exclusive renderer for the Insight taxonomy type and for Learning-priority content. Confirmed instances: `LuvRollUpCard` (4-quadrant synthesis), `LeadMomentumCard` (3-stage narrative), `LuvInsights` (HQ's per-venue mirror).
- **Allowed content:** narrative text, an optional structured breakdown (quadrants, dimension bars — rendered as Insight-card-internal, not a nested Health Indicator), a reference back to the Observations/Facts it was built from.
- **Required inputs:** `narrative` (the generated text) or `structuredSections[]`.
- **Optional inputs:** `sourceFacts[]` (for traceability — per the prior phase's Trust Model, every Insight must be traceable back to real Facts), `generatedAt`, a regenerate/refresh action.
- **Supported actions:** Refresh/Regenerate, View (per referenced fact).
- **Priority levels allowed:** Learning exclusively (Insight-type content is never Critical on its own — an Insight that reveals something urgent produces a *separate* Alert, routed to Attention List, per the prior phase's Example A).
- **Decision Engine driven:** yes, exclusively — this is Luv's one true home.
- **AI explanation:** inherent, same as Recommendation Card.
- **Surfaces:** Luv (primary), Relationship Workspace (`LeadMomentumCard`-shaped), Admin (HQ's `LuvInsights` mirror). Not Dashboard directly (per the prior phase's explicit rule that Luv content is never duplicated onto the Dashboard), not Reports, not Client/Vendor Portal, not Mobile.

### 2.12 Comparison Card — *a confirmed gap, not an existing family*

- **Purpose:** "this period vs. last period" — the one component the brief listed as a candidate that the inventory did **not** find as a real, dedicated component anywhere. Trend deltas exist only as narrated text inside `LuvRollUpCard`/`luv-widget.tsx` (`"Leads up 12% vs. last month"`) and as a bare arrow-plus-label (`TrendIndicator`, HQ). Recommending this be built as a genuine new family rather than continuing to bury comparison data inside narrative prose or a tiny inline glyph — both current forms make comparison data illegible outside Luv's own copy.
- **Allowed content (proposed):** two values (current, prior), a computed delta (%, direction), an optional small sparkline.
- **Required inputs (proposed):** `current`, `prior`, `label`.
- **Priority levels allowed:** Learning.
- **Decision Engine driven:** yes — reads the same Trend Delta computation the prior phase's Learning-tier routing already specifies.
- **Surfaces (proposed):** Reports (primary), Luv (as the structured half of a trend Insight), Dashboard (Business Snapshot strip only, per the prior phase's own narrow exception for a small fixed set of always-current numbers).

### 2.13 Compositions — not new primitives

Two of the brief's own suggested names turned out, on inspection, to be arrangements of the families above, not additional atomic components. Naming them here explicitly so they are not accidentally rebuilt as new primitives later:

- **"Briefing Card"** = several **Attention List** instances (§2.2), grouped into the four priority-ordered sections the Daily Briefing already uses (Needs Attention Now / Coming Up This Week / Resolved Since Last Looked / Informational) — confirmed directly against the real, live `getDailyBriefing()`/`DailyBriefingWidget` shape. `VendorLuvBriefing` being a near-exact copy of `DailyBriefingWidget` is exactly the failure this reclassification prevents going forward: one composition (Briefing), parameterized by audience, not two hand-copied implementations.
- **"Financial Summary"** = a composition of **Metric Tile** (dollar figures), **Progress Tracker** (collection-rate bar), and **Status Badge** (overdue flag) — confirmed against `PaymentsCard`'s and `payment-section.tsx`'s actual structure, both of which are already, structurally, exactly this composition today, just hand-assembled per surface instead of built from shared parts.

---

## 3. Component Responsibility Matrix

Which canonical family appears on which surface — "—" means no legitimate use found or recommended; a family not appearing somewhere is a deliberate boundary, not an oversight.

| Family | Dashboard | Luv | Reports | Relationship Workspace | Client Portal | Vendor Portal | Admin | Mobile |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Metric Tile | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Attention List | ✓ | ✓* | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| Activity Feed | ✓ | — | ✓ | ✓ | — | — | ✓ | — |
| Collection Card | rarely | — | — | ✓ | ✓ | ✓ | ✓ | — |
| Pipeline Summary | ✓ | — | ✓ | — | — | — | ✓ | — |
| Progress Tracker | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — |
| Health Indicator | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | — |
| Status Card | ✓ | — | ✓ | ✓ | — | — | ✓ | — |
| Celebration Card | ✓ | ✓ | — | — | ✓ | ✓ | — | ✓ |
| Recommendation Card | ✓† | ✓ | — | — | ✓ | — | — | — |
| Insight Card | — | ✓ | — | ✓ | — | — | ✓ | — |
| Comparison Card (new) | ✓† | ✓ | ✓ | — | — | — | ✓ | — |

*\* Luv's own surface renders Attention List content only as the Daily Briefing composition (§2.13), never a standalone list.*
*† Dashboard only for the narrow exceptions already stated in each family's own §2 entry (Recommendations attached to a Critical Alert; Comparison Cards only inside the fixed Business Snapshot strip).*

---

## 4. Component Input Model

Every family in §2 accepts a **common envelope**, on top of its own specific fields — this is what makes "which component renders this Decision Engine output" a mechanical lookup (§ prior phase §4) rather than a per-surface judgment call:

```
{
  id:            string          // stable identity, for state-comparison (prior phase §4)
  taxonomyType:  ObservationType  // one of the 8 canonical types, prior phase §3
  priority:      PriorityTier     // one of the 7 canonical tiers, prior phase §5
  emptyState?:   EmptyStateKind   // §6 of this document
  actions?:      Action[]         // drawn from §5's canonical vocabulary only
  aiExplainable?: boolean         // whether a "Learn Why"/"Ask Luv" affordance may attach
  sourceFacts?:  FactRef[]        // present only when aiExplainable — traceability, prior phase §6
}
```

No family invents its own field for any of these seven — a component that needs, say, its own bespoke "urgency" field instead of `priority` is a sign the component should not exist as a new family and its content belongs in an existing one.

---

## 5. Action Vocabulary

Every canonical action found across the full inventory, reduced to this fixed set — a component may support any subset, but never invent an action outside it:

| Action | Meaning | Used by |
|---|---|---|
| **View** | Navigate to the full record/detail. | All families |
| **Open** | Navigate into a workspace/tool (heavier than View — e.g. "Open Event," "Open Request Dashboard"). | Attention List, Collection Card |
| **Resolve** | Mark an Alert's underlying condition handled (always delegates to the domain's own action — never a UI-only dismiss of a real problem). | Attention List (Alert rows only) |
| **Review** | Acknowledge/inspect something awaiting a decision (a submitted Request, a drafted message). | Attention List, Recommendation Card |
| **Continue** | Proceed with an in-progress flow (a Progress Tracker step, a Celebration's next-step CTA). | Progress Tracker, Celebration Card |
| **Dismiss** | Hide this item from view without resolving its underlying condition — **never available on a Critical-priority item** (§7 — Critical conditions can be Resolved, never Dismissed). | Attention List (non-Critical only), Recommendation Card, Celebration Card, banners |
| **Learn Why** | Reveal the Insight behind a Fact/Alert. | Attention List, Metric Tile (via adjacency, not inline), Status Card |
| **Ask Luv** | Open the Insight/Recommendation conversation for this item. | Health Indicator, Pipeline Summary, Comparison Card |
| **Refresh / Regenerate** | Recompute Luv-generated content. | Insight Card, Recommendation Card |

**Deliberately excluded from the canonical set:** domain-specific mutations found in the inventory (Share, Download, Archive, Send Test, Finalize, Apply) — these belong to Collection Card's per-item action slot (§2.4) precisely because Collection Card is the one family explicitly outside the Decision Engine's own pipeline; a mutation on a managed record is not the same kind of action as resolving or dismissing a classified decision item, and forcing it into this vocabulary would blur that boundary rather than clarify it.

---

## 6. Empty State Specification

Five canonical states, one treatment each — no component invents a sixth or restyles one of these five:

| State | When | Canonical treatment |
|---|---|---|
| **No data** | The domain has nothing to report (e.g., zero overdue payments). | A short, reassuring sentence in place of the list/value — never a blank void. This is the pattern all 6 `components/analytics/*` cards and most dashboard widgets already use correctly; the canonical rule extends it to every family, closing the "silently render nothing" gap found in several portal tap-cards and HQ tiles (§1). |
| **Completed** | Everything that would have appeared here is done (a Progress Tracker at 100%, an Attention List with zero remaining items). | Distinct from "No data" — a completed state says what *was* accomplished, not just that nothing remains (matching `getting-started.tsx`'s existing "disappears once 100%" behavior, generalized). |
| **Loading** | Data is being fetched. | A skeleton matching the component's own shape (already the pattern `LuvRollUpCard` uses) — never a generic spinner substituting for the whole card. |
| **Unavailable** | The underlying computation failed or the feature isn't configured (e.g., Luv disabled, a broken integration). | A neutral, non-alarming message — never styled as an Alert/Critical state, since an unavailable component is a system condition, not a venue-owner problem. |
| **Permission restricted** | The viewer's role doesn't permit seeing this content. | The component does not render at all in this case, by default — matching the existing role-gated patterns elsewhere in the app (e.g. delete-gated-to-owner/manager) — rather than rendering a visible "you can't see this" placeholder, which would itself leak that restricted content exists. |

---

## 7. Priority / Severity Treatment Specification

Two related but distinct concepts, kept separate per §5 of the prior phase (Priority = routing; this section = visual styling):

**The canonical severity-to-visual map** — replacing the ~7 independently-defined tier enums found in §1:

| Severity | Color language | Icon language | Used for priority tiers |
|---|---|---|---|
| **Critical** | Destructive/red | Alert triangle | Critical |
| **Warning** | Amber | Clock/exclamation | Needs Attention Today |
| **Opportunity** | Highlight (blue or brand accent, never red/amber) | Star/spark | The Opportunity taxonomy type specifically — visually distinct from Warning, since an Opportunity is a positive-framed notice, not a problem |
| **Celebration** | Warm (rose/gold, per Luv's existing brand treatment) | Heart/confetti | Celebration |
| **Informational** | Neutral/muted | None or a plain dot | Informational, Upcoming, Learning |
| **Historical** | Faded/low-contrast | None | Historical |

**The rule every component must follow:** a component reads `severity` (derived once, by the Decision Engine, from `priority` + `taxonomyType` — never computed inline by the component itself) and looks up color/icon from this one map. This directly closes the §1 finding that `HealthTier`, `ReadinessStatus`, the 4-tier Client Health system, `CommunicationHealth["level"]`, `stat-bar`'s `tone`, and HQ's `HealthStatus` each currently define their own version of the same 3–4-tier concept — going forward, each of those becomes a *mapping onto* this one canonical severity set, not a parallel definition of it.

**No component may invent its own urgency styling** (the brief's own words) — this is enforced structurally by the input model (§4): `severity` is derived upstream, never a per-component prop a page author chooses freely.

---

## 8. Dashboard → Luv → Report Reuse Matrix

The same canonical components, three depths — never three different implementations:

| Family | Dashboard (facts) | Luv (facts + explanation) | Reports (facts, grouped historically) |
|---|---|---|---|
| Metric Tile | Current value only | Not shown directly — Luv narrates the value in prose, referencing the same underlying number | Same value, plus a date-range selector wrapping it (the exact "grows a filter, becomes a Report" test from the prior phase §8) |
| Attention List | Live, current items | Rendered only as part of the Briefing composition (§2.13) | Not shown — Reports never show actionable items, only what already happened |
| Health Indicator | Current score | Score plus an Insight Card explaining the delta since last period | Score history over the selected range (a Comparison Card, §2.12, wrapping the same score) |
| Pipeline Summary | Current stage counts | Not shown directly — Luv narrates a stage-to-stage Insight if something moved unusually | Same stage counts, over a selected historical range |
| Celebration Card | Recent only, disappears | Narrated with added context ("3rd this month") | Never — Celebrations are not report content |

**The reuse rule, stated once:** Luv never re-renders a Dashboard component with more data — it adds a *sentence*, attached to the same component instance's `sourceFacts` reference (§4), or it produces a new Insight Card. A Report never re-renders a Dashboard component with a filter bolted on as an afterthought — it wraps the same Metric Tile/Health Indicator in a period selector that the Dashboard's own instance structurally cannot accept (no `dateRange` prop exists in the Dashboard-facing input model, by design).

---

## 9. PASS / FAIL Against Today's Implementation

| Question | Verdict | Evidence |
|---|---|---|
| Is there one canonical "stat tile" component today? | **FAIL** | 9 independent implementations (§1). |
| Is there one canonical "attention list" shape today? | **FAIL, but close** | 8 components already share the identical visual structure without realizing it — the *shape* already converged organically; only the *implementation* didn't. This is the single lowest-risk, highest-value consolidation in this whole document. |
| Is there one canonical severity/tier system? | **FAIL** | ~7 independently-defined enums for what is functionally a 3–4-tier concept every time (§1, §7). |
| Does any real precedent already demonstrate this system working? | **PASS, in two places** | All 6 `components/analytics/*` cards share one empty-state convention. `CommunicationHealthWidget` is already correctly reused, unmodified, across two different surfaces (Dashboard + Reports) — proof the Reuse Matrix (§8) is achievable, not hypothetical. |
| Is dead/duplicate code already accumulating from the lack of this system? | **FAIL, confirmed** | `VendorHealthScoreWidget` and `vendor-dashboard.tsx` are explicitly orphaned, near-duplicate components left in place rather than unified with their Dashboard equivalents. `VendorLuvBriefing` is a self-documented, deliberate copy of `DailyBriefingWidget` — done consciously, but still a duplicate a shared Briefing composition (§2.13) would have prevented. |
| Are there two components solving the same problem with different UX? | **FAIL, confirmed** | `RequestsSummaryCard` (couple-facing tap-card) and `RequestSummaryCard` (venue-facing 4-tile grid) render the same underlying request-status counts as two unrelated visual treatments. |
| Is the status-badge pattern (~11 instances) itself a problem? | **PARTIAL** | Each is trivial and legitimately domain-specific (a `Record<Enum, Variant>` per object type is not inherently wrong) — flagged as a candidate for a generic `StatusBadge<T>` factory in the roadmap, not classified as a hard failure the way the other clusters are. |

---

## 10. Implementation Roadmap

1. **Build the canonical severity map (§7) as a single shared module** — the lowest-risk, highest-leverage change, since every other family depends on it and none of the ~7 existing tier enums need to be deleted immediately, only mapped onto it.
2. **Consolidate the 8 Attention List instances** (§2.2) into one parameterized component — the shape already agrees today; this is a refactor, not a redesign.
3. **Build the Briefing composition (§2.13)** on top of step 2, retiring `VendorLuvBriefing` as a hand-copy in favor of the same composition parameterized by audience.
4. **Consolidate the 9 Metric Tile instances** (§2.1) — second-highest volume, low risk (no interactive complexity).
5. **Retire the two confirmed dead/duplicate components** (`VendorHealthScoreWidget`, `vendor-dashboard.tsx`) in favor of the canonical Health Indicator (§2.7), once it exists.
6. **Reconcile `RequestsSummaryCard`/`RequestSummaryCard`** into one Metric Tile + Attention List composition, ending the couple-side/venue-side visual fork for the same data.
7. **Consolidate the 4 ring implementations** into Progress Tracker's ring variant (§2.6) — deferred behind the higher-volume clusters above since it's only 4 instances, but blocks the Comparison Card (§2.12) from having a clean visual building block.
8. **Build Comparison Card** (§2.12) — the one genuinely new component this document calls for — once Reports (this session's own canonical metrics work, `lib/metrics/`) has more migrated consumers to display via it.
9. **Evaluate the `StatusBadge<T>` factory** (§9's PARTIAL finding) — lowest priority, since the current ~11 instances are working and low-risk as-is.

Every step above is additive/refactor-shaped — none requires a new table, and none requires the Decision Engine implementation work from the prior phase's own roadmap to be complete first, except where explicitly noted (§2.1–§2.11's "Decision Engine driven: yes" families need that pipeline's Classify/Prioritize steps in place before they can read `taxonomyType`/`priority` from anywhere other than each surface's current ad hoc logic).
