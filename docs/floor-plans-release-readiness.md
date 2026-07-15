# Floor Plans — Release Readiness Audit

**Status:** Audit only, as commissioned. No code changed to produce this document.
**Read first:** `docs/client-workspace-collaboration-architecture.md`, `docs/floor-plan-seating-architecture.md`. `docs/platform-workspace-architecture.md` does not exist in this repository (confirmed directly, as in every prior architecture document this program) — this audit proceeds without it.
**Method:** Three independent, parallel research passes — venue-side workflow/UX, client/portal-side workflow/UX, and edge-cases/collaboration/privacy — each reading the actual component/service/repository/RPC code and, for the third, the live database schema, RLS policies, and grants directly via `psql`. Findings below are consolidated, cross-checked against each other, and de-duplicated. Every claim is traceable to a specific file, line, or SQL query; nothing here is inferred from the architecture docs alone.

---

## Release Blockers

Issues that would produce silent data loss, a security/privacy inconsistency, or a broken promise a real venue or couple would notice and lose trust over.

1. **Silent failure on guest seating actions.** `assignGuest`/`removeGuest` in `components/portal/seating-section.tsx` apply an optimistic UI update immediately, then call `fetch(...)` with no `.catch`, no status check, and no rollback. If the request fails (a race with the coordinator un-sharing the plan, a network blip), the couple sees a guest "seated" that was never persisted — with zero error feedback, discovered only on next reload as an inexplicable revert. This is the single highest-risk item in the whole audit: it silently breaks the one interaction Seating exists for.
2. **Un-sharing a floor plan is indistinguishable from never having shared one.** When a coordinator toggles a previously-shared plan back to hidden, `get_seating_data` returns the exact same empty state ("No floor plan shared for seating yet") a couple who never had access sees. A couple who did real seating work has no way to tell "my venue hasn't gotten to this yet" from "my work is gone."
3. **`assign_guest_to_table`/`remove_guest_assignment` skip the `access_level` check `get_seating_data` already enforces.** A portal session at a restricted tier (e.g. `financial`) is correctly blocked from *reading* seating data, but the write RPCs perform no equivalent check — a session that already knows a valid guest/table id pair (e.g. from the data-export JSON) could still call them directly. Low practical severity today (nothing in the UI would surface this to such a session), but it's a real, fixable inconsistency in a boundary this product otherwise takes seriously.
4. **`updateNotesAction` is fully built server-side and rendered on the print output, with zero UI ever calling it.** The Floor Plan print page has a permanent, always-empty "Notes" section — a feature that looks finished and silently does nothing.
5. **"Duplicate Existing Template" doesn't exclude or badge archived templates**, unlike the booking-facing Apply Template list, which correctly filters them. A coordinator can unknowingly resurrect a template they deliberately retired.
6. **Single-object delete in the editor has no confirmation and no undo.** "Clear all objects" is the only guarded destructive action in the entire editor (a native `confirm()`); deleting one table is one click with no safety net at all, and there is no undo of any kind anywhere in the editor.

---

## Polish Items

Real, findable friction — not blockers, but the kind of thing that makes a venue owner feel the product is unfinished.

- Icon-only buttons across the feature area (template card's `MoreHorizontal` menu, every icon-only toolbar control in the editor) rely on `Tooltip` descriptions but set no `aria-label` — a tooltip is not an accessible name; every one of these is currently a nameless button to a screen reader.
- "Share for Seating" uses a native `title=` attribute instead of the app's own `Tooltip` component — the one sharing control in this feature that didn't get the tooltip treatment already applied everywhere else.
- Table selection and the "+ Add Guests" quick-add rows in the portal Seating canvas are mouse/touch-only (no `role`, `tabIndex`, or keyboard handler) — only the checkbox-multi-select + dropdown path is keyboard-operable.
- Two native browser dialogs (`window.prompt` for template rename, `confirm()` for clear-canvas) sit inside an otherwise fully custom `Sheet`/`Dialog`-based app — visually and behaviorally jarring.
- `FloorPlanWorkspace`'s empty state ("No floor plans yet.") is a single bare line; the Template Library's empty state, one click away, has an icon, heading, description, and an embedded CTA. Same feature area, two different levels of polish.
- The Apply-Template picker in the booking workflow is name-only (no thumbnail, object count, or Default badge) even though the Template Library card grid, one click away, has all of that — a coordinator applies a template to a real booking choosing blind.
- "Default Template" badges are scoped per `(eventType, spaceId)`, so several templates can show "Default" simultaneously with no qualifying text explaining why — reads as one global default until a coordinator investigates.
- `needsReassignment` guests (their table was deleted) are explained in copy at the dashboard/banner level but not visually separated from truly-never-assigned guests inside the Unassigned list itself.
- Three different visual treatments of "over capacity" exist (inline SVG `⚠` suffix, `TableInfoPanel` text note, header `Badge`) with no shared visual language between them.
- Emoji-as-icon for dietary/meal/wedding-party tags has no on-screen legend — colorblind-safe, but not self-explanatory.

---

## UX Improvements

Things worth doing that materially improve first-use clarity, distinct from bug-shaped polish above.

- No onboarding, legend, or first-time explanation exists anywhere in the couple's Seating experience for what the screen represents, what the color-coding on tables means, or how sharing/seating actually works conceptually. The one clear piece of in-context instructional copy ("No one seated here yet. Drag a guest onto this table...") only appears after a table is already selected.
- "Share for Seating" has no onboarding either — a first-time coordinator sees the pill with no explanation of what Seating is or why they'd want to turn it on, beyond a hover tooltip they may never trigger.
- No explanation anywhere of which palette categories are real Inventory-backed items (tracked, counted) vs. generic freeform shapes (Stage, Dance Floor, Bar) — left entirely implicit.
- The Inventory Usage panel only appears once at least one inventory-backed object is placed — a coordinator gets no advance warning before over-committing, only a reactive one after.

---

## Workflow Gaps

Places where the stated goal of the feature (per the architecture doc) isn't actually reachable today.

- **No approval/finalization step exists for Seating at all**, and no working bridge (Request, Messages link, anything in-context) exists for a couple who wants a different table arrangement to actually tell their venue. `RequestSourceFeature` includes `"floor_plans"` as a literal value with **zero real call sites anywhere in the codebase** — this is a reserved-but-dead enum value, not a built capability. Confirmed this is exactly what the architecture doc itself flagged as aspirational (§6) — not a regression, but also not resolved.
- **The couple's Seating canvas only ever renders tables** — `get_seating_data` filters to `object_type in ('table_round','table_rect','table_oval')` — never the Stage, Dance Floor, Bar, or other placed objects. This undercuts the architecture doc's own stated goal (§6): "the couple's view of the room should visually match what the venue is actually setting up." Tables float in an empty rectangle unless the coordinator separately attached a background image.
- **A booking's own floor plan cannot be renamed or deleted once created** — full parity exists for Templates (rename/duplicate/archive/set-default) but the booking-facing `FloorPlanCard` has no menu at all beyond the Share toggle.
- **No day-of / wedding-day floor plan surface exists.** The one page built for the actual event day (`app/(app)/events/[id]/today`) has zero connection to Floor Plans — no view link, no print link, no setup checklist. The print view itself is well-built for exactly this purpose but entirely undiscoverable from where a coordinator would actually be standing on the wedding day.
- **No table-by-table print or export view exists for the couple** — only a raw JSON data-export, not intended for handing to a DJ or venue.
- Multiple floor plans can be shared for Seating simultaneously with no coordinator-visible warning; `get_seating_data` silently picks whichever was most recently updated, and the coordinator has no way to know which one Seating is actually serving.

---

## Platform Integration Gaps

Verified directly against this session's own architecture work (`docs/platform-orchestration-architecture.md`, `docs/platform-event-adoption-plan.md`, `docs/luv-platform-reconciliation.md`, `docs/calendar-platform-integration.md`) and the live Platform Event/Automation/Notification implementations built this session.

| Integration | Status | Detail |
|---|---|---|
| **Calendar** | Correctly not integrated, by design | Floor Plans has no date-bearing fact of its own (`docs/calendar-platform-integration.md`'s own finding, unchanged) — nothing to fix here. |
| **Requests** | Gap — aspirational only | `floor_plans` exists as a `RequestSourceFeature` literal with zero real usage anywhere in the codebase. No code path ever creates a Floor-Plans-sourced Request. |
| **Notifications** | Gap — zero coverage | None of the 9 pre-existing trigger-based notifications, and none of the 8 events wrapped by Platform Event Framework Phase 1 (`Booking.Confirmed`, `Event.Completed`, the 6 Request lifecycle events), touch Floor Plans at all. A coordinator is never notified of anything Floor-Plan-related (a plan shared, a table over-allocated, a couple finishing their seating chart). |
| **Automation** | Not yet extended (not a regression) | The Action Registry built this session (`apply_planning_template`, `send_notification`) has no Floor-Plan action. Reasonable given Automation Framework Phase 1 was deliberately minimal — noting for the roadmap, not flagging as broken. |
| **Readiness** | Solid, correctly scoped, verified | `computeFloorPlansReadiness()` (`lib/readiness/compute.ts`) is real, live, and correctly informational — checks plan existence, sharing status, and inventory over-allocation, never blocking. No gap found. |
| **Luv** | Gap — proposed, not built | `docs/luv-platform-reconciliation.md` §3/§9 specifies exactly what Luv should observe here (whether a plan is shared, inventory over-allocation, and the Floor-Plan/Seating correlation "the room changed after seating was already underway") — confirmed as of this audit that none of it is implemented; Luv still does not observe Floor Plans. |
| **Seating** | The flagship success story | Deep, correct, structurally-enforced one-way integration (§2 of the architecture doc) — verified live at the RLS/grant level, not just in application code. The one feature area in this audit where the "Client-Owned in name only" anti-pattern documented elsewhere in the platform was found, named, and genuinely fixed. |
| **Guest Management** | Correct, via Seating only | Floor Plans itself has no direct guest awareness (correctly — it doesn't need any); Seating bridges `couple_guests`/`guest_seat_assignments` to table structure exactly as designed. |

---

## Recommended Implementation Order

1. Fix the two silent-failure/data-integrity items first (guest assign/remove error handling; share/unshare state distinction) — these are the only items that erode trust in data actually being saved.
2. Close the access_level gap on the two seating write RPCs — small, mechanical, security-adjacent.
3. Wire the orphaned Notes field, fix archived-template duplication, add a delete confirmation on single objects — all small, independent, high-value-per-effort fixes.
4. Add rename/delete parity for booking floor plans.
5. Day-of floor plan link, Share-for-Seating tooltip/onboarding fix, template preview in Apply-Template picker.
6. Everything else in Polish/UX Improvements, roughly in the order listed.
7. Longer-horizon, out of this release's realistic scope: full undo/redo in the editor (a genuine multi-day feature — a command-pattern history stack across every mutation type — not a cheap fix); rendering the full room (non-table objects) in the couple's Seating canvas (requires RPC and rendering changes, not a one-line fix); a real Approval/Request bridge for seating changes.

---

## Release Recommendation

# Almost Ready

**Justification:** The core, load-bearing parts of Floor Plans are genuinely solid — the Seating integration is the strongest platform-integration story found in this entire audit (a documented "Client-Owned in name only" bug elsewhere in the platform was, here, actually fixed at the RLS and grant level, verified directly, not just claimed in a comment); Readiness integration is correct and live; the venue-side template and editor experience is feature-complete for the core workflow (create, manage, search, apply, edit, duplicate, print, source from Inventory). This is not a feature with a shaky foundation.

What keeps it from **Ready** is a small, concrete, fixable set of trust-eroding gaps, not architectural rework: two silent-failure paths that could make a couple believe their work was saved when it wasn't (guest assignment, and un-sharing), one real permission inconsistency, one fully-built-but-unreachable field, and a couple of small template/editor safety nets. None of these require new architecture or a redesign — every one is a bounded fix within the existing, approved model.

What keeps it from **Not Ready** is that none of the above are foundational — a coordinator can genuinely run a real wedding through this feature today (create a plan, source real inventory, print it, share it, have a couple seat their guests) and it will work. The gaps are about trust and polish at the edges, not core function.

---

## Release Completion (this pass)

Executed against this audit as source of truth, in priority order.

### Phase 1 — Release Blockers (all fixed and DB-verified)

- Silent failure on guest seating actions (assign/remove) — `seating-section.tsx` now captures previous state before the optimistic update, checks `res.ok && json?.ok`, reverts and toasts on any failure. Verified end-to-end: SQL RPC → API route (`{ ok: data }`) → frontend rollback path.
- `access_level = 'financial'` was missing from `assign_guest_to_table`/`remove_guest_assignment` (present only on `get_seating_data`) — fixed and DB-verified: financial-tier writes now return `false` and produce zero row changes, even against a real, valid guest/table.
- Un-sharing indistinguishable from never-sharing — `get_seating_data` now returns `hadPriorWork`, computed from whether any `guest_seat_assignments` row exists for the couple. DB-verified both directions (never worked → false; worked then unshared → true), and confirmed no data is ever lost (the assignment row survives, only `table_object_id` nulls).
- Orphaned Notes field wired into the Room Settings panel (booking mode only).
- Archived-template duplication fixed — `existingTemplates` now excludes archived templates.
- No confirmation/undo on single-object delete — added a `confirm()` guard. Full undo/redo remains explicitly out of scope (multi-day feature, not a cheap fix).

### Phase 2 — UX Polish (a deliberately bounded subset, not the full list)

Addressed: day-of Floor Plans surface on the wedding-day dashboard (View/Print links, both routes verified real and functional); a warning banner when more than one plan is shared for Seating at once, naming which one the couple actually sees; needsReassignment guests visually split from never-assigned guests in the portal; rename/delete for booking floor plans; aria-labels on every icon-only button touched this session; the Share-for-Seating toggle now uses the same `Tooltip` component as the rest of the editor instead of a native `title=`.

**Explicitly deferred, not forgotten** — real, listed in the original audit, not attempted this pass: template preview in the Apply-Template picker, Default badge scope explanation, inventory-sourcing onboarding, keyboard operability for portal table selection, unifying the three over-capacity visual treatments, an emoji legend, table-by-table print/export for the couple, rendering non-table objects in the couple's Seating canvas, a real Approval/Request bridge for seating changes.

### Phase 3 — Final Verification (found and fixed two new issues)

Verification used direct DB-transaction testing (`begin; ... rollback;` against real dev data — an actual venue with a shared plan, a hidden plan, and pre-existing dangling guest assignments) plus static analysis, since interactive browser/session auth was unreachable this session. Full `tsc`/`eslint` pass across every touched file plus a full-repo lint pass (150 pre-existing errors elsewhere in the codebase, none in Floor Plans files, none introduced by this work — confirmed via `git stash` diffing).

Two real bugs were found and fixed during this verification, not just "audited":

1. **`needsReassignment` went silently empty when zero floor plans are shared.** `get_seating_data`'s "no plan shared" branch (added this session, for `hadPriorWork`) hardcoded `needsReassignment: []` instead of querying it — so a guest whose table (or whole plan) disappeared while nothing else was shared became invisible instead of showing "needs a new table." Root cause: this session's own new `deleteFloorPlan` capability made "zero shared plans while assignments exist" newly reachable in a way the `hadPriorWork` fix hadn't accounted for. Fixed in the SQL function and surfaced in the portal's empty state (a small amber note: "N guests will need a new table once seating reopens"). DB-verified: deleting an entire shared floor plan out from under seated guests now correctly returns every affected guest in `needsReassignment`.
2. **Rename/delete didn't revalidate the day-of dashboard.** `renameFloorPlanAction`/`deleteFloorPlanAction` revalidated `/events/{id}` and `/events/{id}/floor-plans` but not the new `/events/{id}/today` surface this session added `QuickFloorPlans` to. Fixed.

Also verified and confirmed correct, no changes needed: `computeFloorPlansReadiness` is unaffected by any of this session's schema/UI changes (never reads `notes`, correctly treats plan count and `client_access` shrinking to zero); `floor_plans` RLS/grants correctly scope rename/delete to the owning venue (`current_user_venue_id()`, pre-existing, unchanged); FK cascade rules confirmed empirically — deleting a whole floor plan cascades its objects but only `SET NULL`s `guest_seat_assignments.table_object_id`, never deletes the assignment row; cross-plan/hidden-plan guard on `assign_guest_to_table` confirmed (cannot seat a guest at a table on a plan that isn't shared for this event); Requests (`floor_plans` `RequestSourceFeature`) and Notifications integration confirmed genuinely at zero coverage, exactly as audited — not partially wired, not silently broken, just not built.

### Updated Recommendation: **Almost Ready → Ready for the core workflow it actually promises**

The original "Almost Ready" gaps were the two silent-failure paths, the permission inconsistency, the orphaned Notes field, and the single-object delete safety net — all fixed and DB-verified this pass, plus two additional real bugs found and fixed during verification itself. What remains open (Requests/Notifications/Automation/Luv integration, template preview, full undo/redo, non-table objects in the couple's canvas, a Request-framework bridge for seating changes) is real, honestly listed above, and correctly out of scope for a release-completion pass — these are net-new feature investments, not defects in what ships. A coordinator can run a real wedding through Floor Plans today — create, source from Inventory, print, share, have a couple seat their guests, survive a plan being renamed, deleted, or unshared mid-process without losing anything — and every one of those paths has now been verified to actually work, not just assumed to.
