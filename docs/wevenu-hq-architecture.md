# Wevenu HQ & Marketing Site — IA Proposal

**Status:** Sprint 108.5 — steps 1–4 implemented (this revision documents what shipped, not just what was proposed)
**Date:** 2026-07-06
**Scope:** Internal operations center ("Wevenu HQ"), marketing site IA, shared design-system decision
**Reference implementation:** QuickCloud (`/Users/jensmac/Downloads/quickcloud-website-main`, `apps/web`) — the complete, current QC monorepo. (`/Users/jensmac/website/quickcloud-nextjs` is a stale marketing-only snapshot; not used as a reference here.)

**Ground rule, per direction:** reuse QC's *information architecture, UX patterns, and component conventions* — not its visual branding, not its raw markup, and (deliberately) not its raw-gray un-themed admin styling. Wevenu already has a more disciplined design system than QC's admin section does (see §4) — port the *shape*, upgrade the *skin*.

**Decisions already made** (via user sign-off, not open questions):
- **Access model:** a dedicated internal-admin table (QC's `AdminUser` model is the precedent), not an env-var email allowlist. This *replaces* the `WEVENU_ADMIN_EMAILS` check currently in `app/api/admin/beta/route.ts` and `app/api/admin/feedback/route.ts` — those are a placeholder that predates this decision.
- **App boundary:** Wevenu HQ lives in this repo, under `/admin/*` — same auth cookie, same Supabase client, same component library. Matches QC's own structure (`apps/web/app/admin/*` is one route group inside the same Next.js app as the marketing site and customer portal, not a separate deployment).
- **First pillar to build deepest:** Beta Command Center + adoption metrics. This is the cheapest incremental step — Sprint 108 already shipped `engagement_events`, `venue_activation_scores`, `venue_milestones`, and `get_beta_adoption_overview()`; today's page (`app/(app)/admin/beta/page.tsx`) is a flat table reading that RPC. Support/ops triage and feature-request management are real Wevenu HQ pillars too, but come after this one is deep.
- **Approved sequencing:**
  1. Finalize and approve this doc
  2. `hq_admins` + admin layout gate
  3. Build the Beta Command Center (now includes View-As, Health Trends, Activity Timeline, Health Badges — §2.2–§2.6 below)
  4. Expand into remaining HQ modules (Support, Feedback/Roadmap consolidation, Analytics, System Health)
- **Marketing site:** IA finalized in §3 below; **implementation deferred** until the HQ foundation and activation work are complete.
- **Home page:** the Beta Command Center is the default `/admin` route, not `/admin/beta` — for the next 6–12 months, beta health is the most important thing happening in the company, so it's the front door of HQ, not a sub-page. `/admin/beta` now just redirects to `/admin` for old links.
- **Route location:** HQ routes live at `app/admin/*` — a **sibling** of `app/(app)/*`, not nested inside it. Nesting under `(app)` would have doubled the chrome (the venue `WorkspaceShell` *and* `HqShell` both wrapping every page) — the exact "double-chrome" risk this doc flagged in §1 when discussing QC's `ConditionalChrome`. `HqShell` is HQ's own, complete layout.

---

## 1. Wevenu HQ — Internal Navigation IA

QC's `AdminShell.tsx` structures its left nav as **sections mixed with items in one flat array** (`{ section: string }` separators interleaved with `{ href, label, ownerOnly, icon }` entries), with role-based filtering (`ownerOnly`) and live badge counts on nav items. That exact shape maps cleanly onto Wevenu HQ:

```
Wevenu HQ
├── Beta Command Center          ← deepest pillar, build first
│   ├── Overview (KPI strip + cohort distribution)
│   ├── Venues (the existing /admin/beta table, evolved — see §2)
│   ├── Milestone Funnel
│   └── At-Risk Queue
├── Customer Success
│   ├── Venue Accounts (detail page per venue — see §2.3)
│   ├── Onboarding Progress
│   └── Notes & Tasks
├── Support
│   ├── Recent Errors
│   ├── Failed Imports
│   ├── Stuck Invitations (vendor + team)
│   └── Failed Notifications / Failed Digests
├── Feedback & Roadmap            ← already exists (/admin/feedback), folds in here
│   └── Feature Requests (votes, status)
├── Analytics
│   ├── Daily/Weekly Active Venues
│   ├── Activation Distribution
│   ├── Portal & Import Adoption
├── System Health
│   ├── Cron Job Status (digest, notifications)
│   ├── Email Delivery
│   └── Job/Webhook Log
└── Settings
    └── HQ Admin Roster (who has HQ access)
```

**As implemented** (`components/hq/hq-shell.tsx`), flattened to what actually has a page behind it: a "Beta" section (Beta Command Center, Feedback & Roadmap), an "Operations" section (Support — with a live badge count, Analytics, System Health), and a "Coming soon" section (Settings / HQ Admin Roster — not built, no CS/Customer-Success section as its own nav item since Venue Accounts already live under Beta Command Center's venue detail pages rather than a separate top-level area).

Notes carried over deliberately from QC:
- **Nav-item badge counts** (QC polls `/api/admin/tasks/urgent-count` on an interval and shows a count pill next to "Tasks"). Wevenu HQ's equivalent: a count pill on **Support** (open error/failed-import count) and **At-Risk Queue** (venues below 50% with no engagement in 7 days — already computable from `get_beta_adoption_overview()`'s `risk_flag`).
- **Role-gated nav items** via a boolean, not a permission matrix (see §4) — good enough for a 2-person-ish founding team; QC never needed more than `owner | team` and neither will Wevenu at this stage.
- **QC's top-bar "All systems operational" pill is a hardcoded stub in QC today** — worth building for real in Wevenu's System Health section (Sprint 108.5 already needs to know digest/notification cron health; don't repeat QC's stub).

---

## 2. Beta Command Center — deepened (first pillar)

Today's `app/(app)/admin/beta/page.tsx` is a single flat table. QC's `admin/dashboard/DashboardClient.tsx` shows the richer target shape: a **KPI strip where each tile scroll-anchors to its own detail panel further down the same page** — not separate tabs, not a drawer. This is a good fit here because the six panels from `docs/adoption-architecture.md` §6 (Distribution, At-Risk, Milestone Funnel, Feature Adoption, Infrastructure Indicators, Velocity) are exactly QC's "KPI tile → anchored panel" shape.

### 2.1 Overview — implemented as `/admin` (`components/hq/beta-command-center.tsx`)
- KPI strip (`components/hq/kpi-strip.tsx`): Total Beta Venues, Healthy, At Risk, Critical, Avg Activation %, Avg Team Adoption %, Avg Vendor Adoption %, Avg Couple Adoption %.
- **Drill-down mechanism, adapted from QC's tile-click pattern:** QC's dashboard has several distinct panels below its KPI strip, so a tile scroll-anchors to its panel. Wevenu HQ's first pass has one list below the strip, not several panels — so clicking Total/Healthy/At Risk/Critical **filters** the venue table to that health status, and clicking an Avg-% tile **sorts** the table by that metric (both in `components/hq/beta-command-center.tsx`'s client-side state). Same underlying idea (a KPI tile is a live control, not just a number) adapted to the shape of what's actually below it; scroll-anchoring becomes the right mechanism again once Milestone Funnel / Feature Adoption / Infrastructure panels (§2.7) are added.
- Cohort-wide panels (Distribution histogram, Milestone Funnel, Feature Adoption, Infrastructure Indicators, Velocity from `docs/adoption-architecture.md` §6) are **not** built in this pass — the core principle ("which customers need attention today" before "how many customers do we have") is answered by the KPI strip + venue table alone; the cohort-trend panels are analysis, not triage, and are reserved for §2.7/step 4.

### 2.2 Venue list — implemented (`components/hq/beta-venue-table.tsx`)
Columns, in the order specified: Venue, Health Badge, Activation %, Trend, Last Login, Team Adoption %, Vendor Adoption %, Couple Adoption %, Risk Factors, Last Activity. Two notes on what "Last Login" vs. "Last Activity" mean concretely, since the raw event log doesn't separate them by default:
- **Last Login** = most recent `engagement_events` row with `actor_type in ('venue_user', 'team_member')` — i.e. the coordinator or a team member did something.
- **Last Activity** = most recent `engagement_events` row from *any* actor, including couples and vendors touching their own portals — the broader signal.
- Filter pills from QC's `AccountsClient.tsx` (by lifecycle stage, with counts) are superseded here by the KPI strip itself acting as the filter control (§2.1) — a second, separate pill row would just duplicate that control.
- Kept as a `<table>` (`components/ui/table.tsx`) rather than porting QC's card-row layout, per the original reasoning in this doc.
- Row click → full detail page (§2.3).

### 2.3 Venue detail page — implemented at `/admin/venues/[venueId]`
A single long scrolling page of stacked cards (QC's `RealAccountDetailClient.tsx` shape), in this order:
- **Overview** (`components/hq/venue-detail/overview-section.tsx`) — score, health badge, trend, phase label, the five-dimension breakdown, and top-3 gaps.
- **Activity Timeline** + **Luv Insights** side by side (`activity-timeline.tsx`, `luv-insights.tsx`) — see §2.4 and §2.6.
- **Engagement** (`engagement-section.tsx`) — team roster, vendor invitations, and couples, each with adoption-relevant status (last active, invite status, portal last access).
- **Support** (`support-section.tsx`) — internal notes, follow-up tasks, last/next contact date. Backed by three new tables: `venue_hq_notes`, `venue_hq_tasks`, `venue_hq_crm_state` (one row per venue: `last_contacted_at`, `next_contact_at`).
- **View As** entry point (`view-as-button.tsx`) in the page header — see §2.5 for what it actually does.

### 2.4 Venue Activity Timeline
A single chronological feed merging two existing sources — no new event data needed, just a combined read:
- `engagement_events` (every raw event: portal opens, contract signed, invoice paid, team logins, etc.) — already written by `recordEngagementEvent()` across `lib/portal/service.ts`, `lib/payments/service.ts`, `lib/team/service.ts`, `lib/contracts/service.ts`, `lib/vendor-auth/service.ts`.
- `venue_milestones` (the subset that crossed a celebration threshold — `first_couple_portal_open`, `first_contract_signed`, etc.) — visually distinguished in the feed (celebration icon + accent color) rather than listed as a plain event, since a milestone is a relationship threshold, not just an occurrence (same distinction `docs/adoption-architecture.md` §3 draws for the couple-facing toasts).
- Implementation: one query unioning both tables ordered by `occurred_at`/`fired_at`, capped/paginated (QC's `ActivityClient.tsx` loads a flat list with `timeAgo()` formatting and no pagination UI beyond a fixed page size — fine to copy as-is for an internal tool).

### 2.5 View-As — implemented as a Phase 1 read-only snapshot, not full impersonation
The original design called for a signed impersonation cookie plus a middleware-level block on mutating requests. Building that out surfaces a real infrastructure problem: **almost every RLS policy in this app resolves access through `current_user_venue_id()`**, a single Postgres function keyed off `auth.uid()` from the request's JWT. Cookies aren't visible to Postgres — there's no per-request channel to tell `current_user_venue_id()` "resolve to venue X instead" without either (a) minting a custom JWT claim per impersonation session, or (b) a session-scoped Postgres setting, which doesn't survive across the multiple independent HTTP requests one page load makes via PostgREST. Either is real, valuable infrastructure — and not something to half-build inside a feature pass.

**What shipped instead:** "View As" is a genuine, audited, read-only feature — just scoped to a dedicated HQ-rendered snapshot rather than a literal drop-in to the venue's own `/dashboard`:
- The button (`view-as-button.tsx`) is a form bound to a server action (`startViewAsAction`) that logs an `hq.view_as` engagement event (`actor_type: 'hq_admin'`) — audited, and it shows up for free in the Venue Activity Timeline (§2.4) — then navigates to `/admin/venues/[venueId]/view-as`.
- That page reuses the exact same `getVenueHqDetail()` data as the CRM-style detail page, but renders only Overview + Timeline + Engagement (no Support/notes — that's HQ-internal, not "the venue's view"), behind a persistent "Viewing as {Venue} — read-only" banner.
- This is enabled by ten new `*_hq_select` RLS policies (one per table the detail page reads) that let an authenticated `is_hq_admin()` user read across every venue — the real unlock here isn't the button, it's that HQ can now read cross-venue data at all outside of bespoke `SECURITY DEFINER` RPCs.

**Deliberately deferred (Phase 2):** true in-app impersonation — an HQ admin browsing the actual `/dashboard`, `/leads`, `/vendors` UI as if logged in as the venue — requires either custom JWT claims (mint a scoped, time-limited token via Supabase's admin API) or a first-class "acting as" session concept threaded through `current_user_venue_id()`. Worth building once View-As Phase 1 proves out which support scenarios actually need it.

### 2.6 Customer Health Trends, Health Status Badges & Risk Signals — implemented in `lib/hq/beta-scoring.ts`
Every threshold below is a named constant with a one-line comment explaining it, specifically so tuning during beta is a one-line diff:
- **`venue_activation_score_history`** — new table, one row per venue per day, upserted inside `compute_venue_activation_score()` alongside its existing work. `venue_activation_scores` gained a `score_7d_ago` column, populated from this history table on every recompute.
- **Trend** (`computeTrend`): `improving` (delta ≥ +5 vs. 7 days ago), `flat` (-5..+5), `declining` (≤ -5), `unknown` until a venue has 7+ days of history. Surfaced via `↗ ↘ →` (`components/hq/health-badge.tsx`'s `TrendIndicator`).
- **Health Status** (`computeHealthStatus`): `Critical` (score < 30, or no engagement in 14+ days), `At Risk` (score < 50 and no engagement in 7+ days — the original two-tier `risk_flag` logic, kept as the middle tier), `Healthy` otherwise.
- **Risk Signals** (`computeRiskSignals`) — leading indicators, weighted deliberately over lagging ones (a low score already confirms trouble; these predict it):
  - `portal_invite_no_open` — invite sent 3+ days ago, never opened
  - `vendor_invite_pending` — vendor invited 7+ days ago, none accepted
  - `imported_no_engagement` — couples imported, zero portal activity
  - `activation_stalled` — score unchanged for 3+ days (via the history table)
  - `team_participation_declining` — team-attributed event volume down vs. the prior 2-week window (only signals if there was meaningful prior activity, to avoid noise on brand-new venues)
  - `no_recent_activity` — the lagging-indicator catch-all, kept for completeness
- **Team/Couple adoption %** reuse the activation model's own dimension weighting (`dimension_scores.team` / 15, `dimension_scores.couple_engagement` / 30) so these numbers stay consistent with the score shown everywhere else. **Vendor adoption %** has no equivalent weighted dimension in the activation model, so it's a simpler `claimed / invited` ratio — a separate heuristic, not a fragment of the 100-pt score. All three documented inline in `beta-scoring.ts`.

**Security fixes bundled into this migration** (found while extending `get_beta_adoption_overview()` and the activation-score functions, fixed since the blast radius and fix were both small and directly adjacent): four `SECURITY DEFINER` functions — `compute_venue_activation_score`, `record_engagement_event`, `check_relationship_milestones`, `get_beta_adoption_overview` — took a `venue_id` (or, for the overview, nothing at all) with no internal check that the caller was authorized for that venue. Any authenticated user could previously have called any of them for a venue that wasn't theirs via a direct RPC call, bypassing the app-layer checks entirely. All four now verify `current_user_venue_id() = p_venue_id` (or `is_hq_admin()`) inside the function body itself, not just in the calling TypeScript.

### 2.7 What's explicitly *not* being built yet
Support/Ops triage (errors, failed imports, stuck invitations), deeper Feedback/Roadmap tooling, and the cohort-wide analysis panels (Distribution histogram, Milestone Funnel, Feature Adoption, Infrastructure Indicators, Velocity — `docs/adoption-architecture.md` §6) are real Wevenu HQ pillars per the original ask, but are sequenced *after* this pass, per your prioritization. The nav in §1 reserves their place; they stay as stub/empty states until their turn.

---

## 3. Marketing Website IA (lighter pass — not this sprint's deep pillar)

QC's marketing site (`apps/web/app/*`) is a **flat, ungrouped route structure** — every top-level directory is a page, no `/marketing` route group. Translated to Wevenu's actual product surface (VenueOS, VendorOS, Couple Portal, Luv, Wedding Website):

```
/                    Home — Hero + product cards + CTA
/venueos             Product page (coordinator side)
/vendoros            Product page (vendor side)
/couple-portal       Product page (couple side)
/luv                 Product page (the AI layer — this is Wevenu's clearest differentiator, treat it like QC's "AI-platform overview" page which sat above the 7 individual product pages)
/wedding-websites     Product page
/pricing
/compare             Hub → /compare/vs-spreadsheets, /compare/vs-generic-crm  (mirrors QC's /compare/vs-consultants pattern — reframe against the *status quo* Wevenu replaces)
/case-studies        (empty/stub until beta produces real ones)
/about
/security            (mirrors QC's — reasonable even pre-beta, given payment/PII data)
/contact
/beta                Beta application / request-access — this is the one page that must exist before beta per your original priority list; everything else here can lag.
```

Component patterns worth porting directly:
- **Hero**: QC's two-column hero (headline+CTA left, stacked value-prop cards right) rather than a literal dashboard screenshot — a reasonable default for Wevenu too, especially pre-beta when there's no polished screenshot library yet.
- **Product card** (`Products.tsx`'s `ProductCard`): icon, tagline, checkmark bullet list, "Learn More" → dedicated page. Directly reusable shape for VenueOS/VendorOS/Couple Portal/Luv/Wedding Websites cards on the homepage.
- **"How it works" diagram-in-a-dark-frame** pattern (a static architecture PNG framed in `rounded-2xl border bg-slate-900`) — good placeholder pattern for Wevenu's product pages before real product screenshots exist.
- **Comparison table** (`/compare` hub: reframe stat strip + gradient comparison cards + full checkmark/x table) — ports directly, just re-skinned.

**Open question this doc does not resolve:** this repo's root route (`app/page.tsx`) currently just redirects straight to `/dashboard` — there's no marketing site here at all today. QC keeps marketing + admin + customer portal in *one* Next.js app. Before writing a single marketing route, decide: does Wevenu's marketing site live in *this* repo (matching QC's actual precedent, requiring the root redirect to move behind an unauthenticated check), or in a separate repo/deployment (matching your original phased priority list, which treated "Beta Landing Website" as distinct from the app)? Recommend the latter for now — it's lower-risk to ship a static beta-landing page on its own subdomain than to rewire this app's root route while Sprint 108 work is mid-flight.

---

## 4. Shared Design System — what to reuse vs. adapt vs. build new

QC's own admin section is **not** a good visual reference: `AccountsClient`/`AdminShell`/etc. hardcode raw Tailwind grays (`bg-white border-gray-200`, `text-gray-900`) with **no dark-mode support**, while QC's *marketing* pages use a proper CSS-variable token system (`--color-primary-500`, `[data-theme="dark"]` overrides). That's a known, named seam in QC itself (its admin and marketing sections never got unified).

Wevenu is already ahead of QC here: `app/globals.css` has a full semantic token set (`--primary`, `--success`, `--warning`, `--info`, `--muted`, `--destructive`, chart colors, sidebar tokens) plus 23 shadcn/ui primitives already in `components/ui/` (`Card`, `Badge`, `Table`, `Sheet`, `Tabs`, `DropdownMenu`, etc.), all already dark-mode aware (per the `/loop`-era work removing the System theme option). **Do not port QC's raw admin styling.** Build Wevenu HQ entirely on Wevenu's existing tokens/primitives — this sidesteps the exact drift QC has today.

| QC pattern | Reuse directly? | Wevenu translation |
|---|---|---|
| Nav sections + role-gated items + badge counts | **Reuse the shape** | New `HqShell` component, built on Wevenu's existing sidebar tokens (`--sidebar-*` already in globals.css) instead of QC's hardcoded slate/blue |
| KPI tile → scroll-anchor to detail panel | **Reuse directly** | Same mechanism (`scrollIntoView`), Wevenu `Card` instead of raw divs |
| Filter pills w/ counts | **Reuse directly** | Wevenu `Badge` variants instead of QC's per-stage hardcoded color map |
| Full-page detail view (no drawer) | **Reuse directly** | Matches Wevenu's own convention elsewhere in the app (e.g. vendor detail, client detail pages already work this way) |
| Modal overlay (`fixed inset-0 flex items-center justify-center`) | **Adapt** | Wevenu already has `components/ui/sheet.tsx` (a proper Sheet/Dialog primitive) — use that instead of QC's hand-rolled overlay div, which QC itself never centralized into a shared component |
| Native HTML5 drag-and-drop Kanban | **Defer** | Only relevant if/when a support-ticket or feature-request board becomes genuinely pipeline-shaped; not needed for the Beta Command Center pillar |
| Plain-div bar charts (no chart library) | **Adapt** | Fine for simple internal bars, but run anything user-facing-adjacent (even internal) through the `dataviz` skill's palette/contrast rules rather than QC's ad hoc color picks |
| "All systems operational" static pill | **Adapt into real thing** | Wire to actual cron/health signals (digest send success, notification engine failures) rather than copying QC's hardcoded stub |
| Global command-palette search | **Build new** | QC doesn't have one in admin either (only docs search) — no pattern to port |

---

## 5. Access Model — `hq_admins` (replaces the env-var allowlist)

QC's `AdminUser` Prisma model (`email`, `passwordHash`, `role: owner|team`, `isActive`, hand-rolled signed-cookie session) is the right shape, adapted to reuse Wevenu's existing Supabase auth instead of a second credential system:

```sql
create table public.hq_admins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'team' check (role in ('owner', 'team')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
```

- Reuses Wevenu's existing Supabase Auth session (no second password/cookie system — this is the one place to *diverge* from QC, since QC's hand-rolled signed-cookie session predates it having a real auth provider for admins, and Wevenu already has one).
- **Implemented:** `app/admin/layout.tsx` checks `hq_admins` (via `getHqAdmin()` / `is_hq_admin()`) and redirects non-admins to `/dashboard` — the layout-level gate. `integrations/supabase/proxy.ts` adds a **second**, middleware-level check on both `/admin/*` and `/api/admin/*`, closing the exact gap this doc flagged in QC's own (disabled) middleware check.
- Replaced `WEVENU_ADMIN_EMAILS` in `app/api/admin/feedback/route.ts` with an `hq_admins`/`is_hq_admin()` lookup (`app/api/admin/beta/route.ts` was deleted — its one caller, the old flat table page, was replaced by the server-rendered `/admin` home page, which calls `getBetaOverview()` directly rather than fetching its own API route).
- `owner` vs `team` gates the same things QC gates: financial/business-sensitive figures (if HQ ever surfaces revenue) and admin-roster management. Bootstrapping the first `hq_admins` row is manual by design (see the migration's header comment) — there's no self-service signup path.

---

## 6. Sequencing

1. **Finalize and approve this doc** — done.
2. **`hq_admins` + admin layout gate** — done. `supabase/migrations/20260710020000_sprint108_5_hq_admins.sql`, `lib/hq/service.ts`, `app/admin/layout.tsx`, `integrations/supabase/proxy.ts`.
3. **Beta Command Center** — done, at `/admin` (the default HQ home page):
   - `supabase/migrations/20260711000001_sprint108_5_beta_command_center.sql` — score history, HQ CRM tables, ten `*_hq_select` policies, four security-guard fixes (§2.6), expanded `get_beta_adoption_overview()`
   - `lib/hq/beta-types.ts`, `lib/hq/beta-scoring.ts` — the documented, tunable scoring model (§2.6)
   - `lib/hq/beta-service.ts`, `lib/hq/venue-detail-service.ts`, `lib/hq/crm-service.ts` — services
   - `app/admin/actions.ts` — server actions (notes, tasks, next contact, View-As audit log)
   - `components/hq/*` — `HqShell`, `KpiStrip`, `BetaVenueTable`, `BetaCommandCenter`, `HealthBadge`/`TrendIndicator`, and `venue-detail/*` (Overview, Activity Timeline, Engagement, Luv Insights, Support, View-As button)
   - `app/admin/page.tsx` (home), `app/admin/venues/[venueId]/page.tsx` (detail), `app/admin/venues/[venueId]/view-as/page.tsx` (read-only snapshot — §2.5's Phase 1 scope)
   - **Not built in this pass:** cohort-wide analysis panels (§2.7) — reserved for step 4.
4. **Expand into remaining HQ modules** — done, for Support/Ops, Analytics, and System Health:
   - `supabase/migrations/20260712000001_sprint108_5_hq_ops_analytics.sql` — three more `*_hq_select` policies (`notification_log`, `task_reminders`, `venue_notification_preferences`) so these modules could read cross-venue without new bespoke RPCs, same pattern as step 3.
   - **Analytics** (`/admin/analytics`, `lib/hq/analytics-service.ts`) — active-today/this-week, activation phase distribution, team/vendor/portal/import adoption %. Deliberately zero new SQL: every figure is a reduction over the same `BetaVenueSummary[]` the Beta Command Center already fetches via `getBetaOverview()`.
   - **Support** (`/admin/support`, `lib/hq/support-service.ts`) — stuck vendor invitations (pending 5+ days) and stuck team invitations (invited, never accepted, 5+ days), plus notification/digest delivery failures from `notification_log`. A nav badge on "Support" shows the combined count (`components/hq/hq-shell.tsx`).
   - **System Health** (`/admin/system-health`, `lib/hq/system-health-service.ts`) — cron "heartbeats" (most recent digest send / most recent reminder send, flagged stale past a threshold), delivery counts by channel over 7 days, and a raw recent delivery log.
   - **Scope call, stated plainly:** "Recent Errors" and "Failed Imports" from the original ask are **not built**. Neither has real backing data today — there's no general application error log, and the CSV import wizard (`lib/import/`) runs synchronously from the client with no background job or failure record to read. Both pages say this explicitly rather than shipping an empty state that looks built but isn't; building either is a real (and separate) instrumentation project, not a UI task.
   - **Feedback & Roadmap** — no changes needed; `/admin/feedback` already existed and was already in the HQ nav from step 3.

**A route-structure correction made during implementation:** HQ routes moved from `app/(app)/admin/*` (as originally sketched) to a sibling `app/admin/*`, outside the `(app)` route group entirely — nesting inside `(app)` would have wrapped every HQ page in both the venue `WorkspaceShell` and `HqShell` at once. `HqShell` is a complete, independent layout.

**A migration-numbering gotcha, twice:** two of this project's Sprint 108.5 migration files landed on the exact same timestamp prefix as pre-existing, unrelated migration files already sitting in the repo (`20260711000000` collided with `sprint87_venue_analytics.sql`; `20260712000000` collided with `fix_portal_helpers.sql`). Both had to be bumped by one second (`...000001`) — `supabase migration up`'s bookkeeping table primary-keys on the timestamp, so an exact collision fails silently-ish (the actual DDL applies, only the tracking insert errors). Worth grepping `ls supabase/migrations | grep <timestamp-prefix>` before naming a new migration file in this repo, since its migration history isn't in strict chronological/sprint order.

**Marketing site (§3):** IA is finalized above; implementation remains deferred until the HQ foundation and activation work are complete, per your instruction. The repo-location question in §3 stays open until that work begins.
