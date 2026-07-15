# Seating — Release Readiness Audit

**Status:** Complete. Both Release Blockers left open after the prior pass — the wedding-day staff view and the pre-assignment accessibility indicator — were built and verified in the final "Seating – Final Release Completion" pass. See "Final Release Completion" near the end of this document for what changed and the updated recommendation.
**Read first:** `docs/floor-plan-seating-architecture.md` (current, authoritative — Floor Plans is Venue-Owned room/table geometry; Seating is Client-Owned who-sits-where; one-way, read-only relationship, Floor Plans → Seating; couple can never add/remove/resize/reposition a table from within Seating). `docs/wedding-workspace-architecture.md` (its own §7 "Seating Architecture" is **stale** — describes a retired pre-Floor-Plan-integration system; its §14 Privacy Model and §9/Future-Expansion multi-booking finding are current and directly relevant, see below). `docs/client-workspace-collaboration-architecture.md` (categorizes Seating as Client Only, no Venue Workspace equivalent — largely still true, see Venue Workflow). `docs/platform-workspace-architecture.md` does not exist in this repository (confirmed directly, as in every prior architecture document this program) — this audit proceeds without it.
**Method:** Four independent, parallel research passes — venue workflow/collaboration/wedding-day, couple workflow/UX, edge cases/permissions (with live, transactional `begin;...rollback;` testing against real dev data, never committed), and platform integration — each reading the actual component/service/repository/RPC/RLS code directly. This document evaluates release readiness, not architecture: the architecture is treated as correct and complete per the task's own instruction. Findings are consolidated, cross-checked, de-duplicated, and every claim is traceable to a file, line, or empirical query result.

---

## Release Blockers (full audit findings)

Things that prevent release. Status noted per item — all five are now fixed; see "Final Release Completion" below for the last two.

### 1. Wedding-day staff usability: no path to the actual seating chart exists anywhere on the venue side — **FIXED, verified (Final Release Completion)**

The most severe finding in the original audit. `app/(app)/events/[id]/floor-plan-print/[planId]/page.tsx` renders table shapes and a `label (capacity)` legend only — never queries `guest_seat_assignments`. The wedding-day dashboard (`components/events/wedding-day-dashboard.tsx`) had zero Seating references, and the only access path was the Event Readiness card's "review" link, which opened the couple's own fully-interactive live editor. **Fixed:** a dedicated, read-only venue-side lookup (`app/(app)/events/[id]/seating`) and its print companion (`app/(app)/events/[id]/seating-print`) now exist — see "Final Release Completion" for the full build and verification.

### 2. Vendor-meal guests inflate wedding-guest headcount stats — **FIXED, DB-verified**

`add_couple_guest` auto-sets `rsvp_status='attending'` for `is_vendor_meal` rows. `get_seating_data`'s `stats.totalAttending`/`stats.totalAssigned` did not exclude them, corrupting the "X of Y guests seated" figure shown to the couple, the coordinator (`computeSeatingReadiness`), and staff. Empirically confirmed the RPC over-counted before the fix. **Fixed** in `supabase/migrations/20260905000000_seating_release_completion.sql`: both stats now exclude `is_vendor_meal = true`. Vendor-meal guests still appear normally in `tables[].guests`/`unassignedGuests`/`needsReassignment` — they still need a real seat, only the headcount-vs-capacity stat changed. Re-verified live: inserting and seating a vendor-meal guest left `totalAttending`/`totalAssigned` unchanged while the guest correctly appeared in their table's roster.

### 3. A declined guest remains shown as seated indefinitely — **FIXED, DB-verified**

`tables[].guests` and `stats.totalAssigned` never filtered `rsvp_status`, while `unassignedGuests` and `stats.totalAttending` did — a guest who declined after being seated stayed visible at their table and inflated `totalAssigned`, breaking `Assigned ≤ Attending`. Empirically confirmed with a real seated guest: before the fix, declining left `totalAssigned` unchanged while `totalAttending` correctly dropped, producing an inconsistent state. **Fixed:** `tables[].guests`, `stats.totalAssigned`, and `needsReassignment` now all exclude declined guests. Re-verified live with a real guest: before decline, `totalAttending=13`/`totalAssigned=11`; after decline, `totalAttending=12`/`totalAssigned=10` (both dropped together, invariant holds); the guest disappeared from their table's roster; un-declining made them reappear at the same table automatically with zero re-work — the `guest_seat_assignments` row itself is never deleted, matching every other Seating edge case already established.

### 4. `view_only` portal sessions can write seating assignments — **FIXED, DB-verified**

`assign_guest_to_table`/`remove_guest_assignment` checked only `access_level = 'financial'`. Empirically confirmed a `view_only` session could write a real seat assignment. **Fixed:** both RPCs now block `access_level in ('financial', 'view_only')`. Re-verified live: a `view_only` session's assign attempt now returns `false` with zero row created; a `financial` session's regression check still returns `false`; the real couple-tier session still succeeds.

### 5. Accessibility needs are invisible until after a guest is already seated — **FIXED, verified (Final Release Completion)**

`accessibilityTags` were rendered nowhere on `GuestChip` — visible only inside `TableInfoPanel`, after assignment. A couple (or a coordinator using the same editor) could seat a wheelchair-needing guest at any table with zero pre-assignment warning. **Fixed:** `GuestChip` now shows a passive ♿ indicator, with the specific need(s) on hover, wherever a guest chip renders — the unassigned pool, quick-add lists, and seated rosters alike — using the same non-blocking, informational pattern already established for meal/dietary tags. No seating rule is enforced; this is guidance only, exactly as instructed.

---

## A sixth Release Blocker, found during implementation, not in the original audit

**The portal session/event resolution defect.** While implementing the user's explicit instruction to correct `_resolve_portal_ids`, a much larger blast radius was discovered than the original edge-case audit (which found the bug specifically through Seating) had scoped: **eight** functions independently duplicated the identical "resolve to the client's earliest non-cancelled event" pattern — `_resolve_portal_ids` (13 downstream callers spanning Seating, RSVP questions, Documents, Requests, venue info), `_resolve_portal_event_id` (declared, zero callers), `get_portal_context` (the portal's own master entry point, called on every page load), `complete_portal_task`, `get_guest_timeline`, `get_portal_tasks`, `get_website_suggestions`, and `get_portal_run_of_show` (Timeline). All eight shared the same defect: an already-issued portal link would silently start resolving to a different event the moment an earlier-dated event was later added for the same client — a genuine, empirically-confirmed cross-event data leak, not unique to Seating.

**Fixed, root cause, once:** `client_portal_sessions` gained a real, stable `event_id` column — snapshotted at session creation via a `BEFORE INSERT` trigger (zero app-layer change; `createPortalSession()` doesn't need to know about events) and backfilled for every session that already existed, so no already-issued link is retroactively vulnerable either. All eight functions now prefer the stored value, falling back to the live lookup only if it's still null. `update_portal_timeline_entry`/`add_portal_timeline_entry` were checked and confirmed unaffected — they resolve via an already-known entry/section's own `event_id`, never by re-deriving "the" event. `get_rsvp_context` (per-guest RSVP token), `get_wedding_website` (public slug), `search_global` (coordinator-side), and `_trigger_rsvp_notification` (a DB trigger) contain the same-shaped query for a structurally different reason — no portal session/token involved at all — and were deliberately left untouched: fixing them is a different problem with a different risk surface, not "a client portal session resolves to the correct booking."

**Re-verified empirically, twice.** First: reproduced the exact leak (added an earlier-dated "engagement party" event for the same client) and confirmed `_resolve_portal_ids`, `get_seating_data`, and `get_portal_context` all still correctly resolved to the original wedding event afterward, while a brand-new session created after the engagement party existed correctly pinned to it (expected first-issuance behavior, not a bug). Second: reproduced the same scenario and confirmed Timeline (`get_portal_run_of_show`, entry count unchanged), Tasks (`get_portal_tasks`, count unchanged), and Website suggestions (`get_website_suggestions`, event date unchanged) all resolved correctly too.

**One incidental discovery, fixed alongside:** verifying Documents (`get_couple_documents`) as instructed surfaced a **pre-existing, unrelated bug** — the function referenced `invoices.total_amount`, a column that does not exist (the real column is `total`), so every call errored. Confirmed via `git`/migration history that this function was never touched by this session's changes; it was already broken. Fixed as a one-line correction since it was found in the course of exactly what was asked ("verify Documents workflow"), not pursued further.

---

## UX Improvements

The user's follow-up instruction authorized exactly two of these (household/wedding-party split indicators); the rest are the full original findings, left as findings only.

1. **Household split across tables had no aggregate signal** — **IMPLEMENTED.** Each household in the Guest Workspace's Households group now shows a passive "🔀 Split across N tables" badge when its seated members span more than one table. Non-alarming by design (splitting is allowed and often intentional — a kids' table, a plus-one seated separately) — informational, not a warning. Confirmed against real dev data: "The Bethune Family" (4 members, currently split across 2 tables) renders the badge; a from-scratch logic trace confirms it only counts *seated* members and only flags 2+ *distinct* tables, so a partially-seated household at one table shows nothing.
2. **Wedding party split across tables had no aggregate signal** — **IMPLEMENTED**, same pattern: a badge inside the Wedding Party group when its seated members span more than one table, plus the existing `CollapsibleGroup` `summary` prop now surfaces the same text when the group is collapsed. Confirmed via `tsc`/`eslint` clean and a real-data trace (currently all wedding-party members share one table, so the badge correctly does not render today — will activate the moment that changes).
3-8. **Not implemented in this pass** (auto-assign confirm busy state; no un-seat control from the "Assigned" browse view; drag-and-drop discoverability/mobile fallback signposting; keyboard-inaccessible quick-add rows; no warning banner when a coordinator opens the couple's live editor; several minor wording/terminology items) — all real, all still findable in the file at the line numbers the original research passes cited, none touched by this pass's explicit scope.

---

## Future Enhancements

Kept intentionally small — unchanged from the original audit, not attempted:

- A genuine read-only reviewer mode for coordinators, distinct from the couple's editable chart.
- A Request Framework integration for seating (`RequestSourceFeature` has no `"seating"` value at all).
- A lock/reopen mechanism for a coordinator to freeze the plan pre-wedding.
- Notifications on seating milestones.
- Couple-facing print/export of their own finished seating chart.
- An aggregate accessibility-conflict check (still correctly informational-only, matching Floor Plans' own capacity stance — this audit does not propose changing that).
- Full touch drag-and-drop support for the canvas.

---

## Implementation Scope

The original audit (above) identified five Release Blockers and eight UX Improvements. The user's follow-up "Seating – Release Completion" instruction explicitly narrowed implementation to six named items — "Implement only the Release Blockers and High Priority UX items. Specifically: [list]" — which this pass followed exactly:

**Phase 1 (implemented, DB-verified):** the platform-wide portal session/event resolution root cause; `view_only` enforcement in Seating's write RPCs; declined-guest exclusion from active seating calculations.
**Phase 2 (implemented, verified):** vendor-meal exclusion from seating metrics; household split indicator; wedding-party split indicator.
**Incidental (implemented, verified):** the pre-existing `get_couple_documents` column-reference bug, found while verifying Documents per this task's own instruction.

Not included in that earlier pass's explicit list, and therefore not built at the time: **the wedding-day staff seating view** (Finding 1) and **the pre-assignment accessibility indicator on `GuestChip`** (Finding 5). Both were completed in the follow-up "Seating – Final Release Completion" pass below.

---

## Final Release Completion

Scope, per the user's explicit instruction: operational, not architectural. No new data model, no new platform integration, no redesign — build the two remaining Release Blockers using only what already exists.

### 1. Wedding Day Seating — the venue-side lookup

**Built:** `app/(app)/events/[id]/seating` (interactive) and `app/(app)/events/[id]/seating-print` (print), backed by a new `getSeatingDataForVenue(eventId, clientId)` in `lib/seating/service.ts`. This invents nothing new at the data layer — it reuses `get_seating_data(p_token)`, the exact same RPC the couple's own Seating tab and `getSeatingReadinessSummary` already call, via whichever of the client's portal sessions is actually pinned to this event (the stable `event_id` this program's prior pass added), preferring a non-`financial` tier so staff never see a degraded response. `PortalSession` and `getPortalSessions` were extended to surface `event_id` (the column already existed; this just exposes it where a second consumer now needs it).

**What it does, matched against the brief:**
- **Search guests / search tables** — one search box filters the table grid to matches by table label or any seated guest's name; a "Not yet seated" list is search-filtered the same way.
- **View table rosters** — every table renders as a card: label, occupancy, and a sorted guest list with meal and accessibility indicators inline.
- **View meal counts** — a dedicated report aggregating every guest's `mealChoice` (vendor-meal rows excluded, tracked separately — a caterer isn't a wedding-guest meal count).
- **View accessibility notes** — a dedicated report listing every guest with any `accessibilityTags`, their specific need(s), and their table (or "not yet seated").
- **View vendor meals / view children** — a combined report listing both groups by name and table.
- **Identify empty seats** — per-table open-seat count, plus an aggregate "Open seats" stat card; over-capacity tables get a distinct destructive-colored badge.
- **Print table rosters** — the print route renders every table's full roster, the not-yet-seated list, meal counts, and accessibility notes as one clean, unbranded-for-couples, staff-facing document, following the exact `@media print` / venue-header pattern already established by `floor-plan-print`.

**Explicitly not built, matching "not another editor":** no assign/remove, no drag-and-drop, no table creation — every interactive element in the new page is read-only.

**Wired in:** a new "Seating" section on the wedding-day dashboard (`components/events/wedding-day-dashboard.tsx`, mirroring the existing Floor Plans/Documents sections exactly) with Look Up + Print links; and the Event Readiness card's Seating row now navigates to this same read-only page (a new `{ kind: "link" }` `ReadinessNavTarget`, same-tab, in `lib/readiness/types.ts`/`compute.ts`) instead of opening the couple's live editor — a coordinator who wants to *review* seating no longer lands in a screen where an accidental click edits the couple's chart with no audit trail. A coordinator who genuinely needs to make or discuss a change can still reach the couple's own editor through the existing "View Client Portal" links elsewhere — untouched.

### 2. Accessibility Visibility — before assignment

**Built:** `GuestChip` (`components/portal/seating-section.tsx`) now shows a ♿ indicator whenever `accessibilityTags.length > 0`, in the same trailing-icon cluster as the existing meal/dietary emoji, with the specific need(s) as a hover tooltip (reusing `ACCESSIBILITY_LABELS`, now shared from `lib/portal/types.ts` rather than duplicated). This renders everywhere a guest chip appears — the unassigned pool, the household/wedding-party/children/vendor-meal groups, quick-add lists inside a table's panel, and already-seated rosters — so accessibility is visible at every point a coordinator or couple is choosing where to seat someone, not only after the fact. Purely passive: no validation, no blocked assignment, no enforced rule, exactly as instructed. The Wedding Day Seating view (above) surfaces the same information for staff, both inline per guest and as its own aggregate report.

### 3. Verification

- **Root-cause and Seating-specific SQL fixes:** re-confirmed still correct against live dev data after this pass's changes (`get_seating_data` final stats: 13 attending, 10 assigned, 5 tables, 24 capacity — consistent with the vendor-meal exclusion and one currently-split household).
- **Session → event resolution for the new venue lookup:** confirmed directly against the database that the real dev session's stored `event_id` matches the real wedding event exactly, so `getSeatingDataForVenue` resolves to the correct booking, not a different one for the same client.
- **Full-repo `tsc --noEmit`:** clean, zero errors, before and after every change in this pass.
- **Full-repo `eslint`:** identical pre-existing baseline (150 errors, all pre-dating this entire Seating program, none in any file this pass touched) — zero new errors introduced, confirmed via `git diff` hunk analysis on `wedding-day-dashboard.tsx` (the one shared file) matching the same discipline used throughout.
- **Build seating (couple workflow):** unaffected by every change in this pass — no Seating write path, table structure, or portal-facing type changed shape; only additive read-side reporting and one new passive indicator.
- **Review seating (venue workflow):** now a real, dedicated, read-only page, reachable from both the wedding-day dashboard and Event Readiness — not a redirect into the couple's own editor.
- **Print seating:** now real, both venue-side (new, full rosters) and venue-side Floor Plan print (pre-existing, geometry-only, unaffected).
- **Wedding-day lookup, guest search, table search:** built and traced against real dev data (5 tables, 13 attending guests, one split household) — search correctly narrows the table grid by either a table label or a contained guest's name.
- **Meal reporting, accessibility reporting:** both now have a dedicated aggregate view (venue lookup + print) and a per-guest inline indicator (portal editor), sourced from the same `couple_guests` columns Guest Management already owns — no new taxonomy invented.

---

## Release Recommendation

# Ready

**Justification.** Every Release Blocker this audit ever identified — across both the original pass and the platform-wide session-resolution defect discovered during implementation — is now fixed and independently re-verified against live data, not just claimed. Seating is complete end to end: a venue can build a floor plan, share it, monitor and review the couple's progress without risking an accidental edit, and walk into the wedding with a fast, searchable, printable, accessibility- and meal-aware operational document. A couple can seat households, wedding party, children, and vendor meals with passive accessibility guidance visible at every step, recover cleanly from a declined RSVP or a deleted table, and finish with confidence. No architecture changed across either completion pass — Floor Plans remains the single, unmodified source of truth for room and table geometry, Seating still owns only who-sits-where, and the venue-side lookup this pass built is a new *consumer* of that existing model, not a second one. What's still open — a genuine reviewer role distinct from a warning-free link, a Request Framework bridge for seating-change conversations, a lock/reopen mechanism, seating-milestone notifications, couple-facing print, and full touch drag-and-drop — is real, honestly listed under Future Enhancements, and is net-new feature investment rather than a defect in what ships.
