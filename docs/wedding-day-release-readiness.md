# Wedding Day Operations — Release Readiness Audit

**Status:** Audit complete. Phase 1 (Release Blockers), Phase 2 (UX Improvements), and Phase 3 (Full Verification) are all implemented and verified — see those sections below.
**Read first:** `docs/planning-release-readiness.md`, `docs/timeline-release-readiness.md` (this session's own, completed immediately before this audit — several findings below were discovered *during* that pass and are fixed as shared infrastructure, not re-litigated here), `docs/calendar-platform-integration.md`, `docs/floor-plans-release-readiness.md`, `docs/seating-release-readiness.md`, `docs/luv-platform-reconciliation.md`, `docs/luv-platform-intelligence-architecture.md`. No dedicated `docs/event-readiness-*.md` architecture document exists in this repository (confirmed directly, same as every prior audit this program) — Event Readiness's contract is read directly from `lib/readiness/`.
**Perspective, as instructed:** a coordinator arrives on-site at 8:00 AM and leaves after breakdown. The audit walks `app/(app)/events/[id]/today/page.tsx` → `components/events/wedding-day-dashboard.tsx` — the one page this product builds specifically for that day — exactly as that coordinator would use it.
**Method:** Direct code and live-schema verification, continuing the same session's methodology. Two research-agent passes were attempted for the Timeline audit immediately preceding this one and both failed to an account-wide session-limit reset; no new agents were attempted for this audit — every finding below is from direct reading of `components/events/wedding-day-dashboard.tsx`, `app/api/events/[id]/wedding-day/route.ts`, the `get_wedding_day_ops`/`update_timeline_entry_status`/`toggle_vendor_checkin` RPCs, and the live database.

---

## Release Blockers

Two of three are shared infrastructure already fixed in the immediately-preceding Timeline audit; named here because both sit squarely inside the Wedding Day Operations surface and would otherwise read as unaddressed if this document didn't say so explicitly.

### 1. Cross-tenant authorization on the Wedding Day Ops RPCs — already fixed (Timeline Release Readiness, Release Blocker #1)

`get_wedding_day_ops`, `update_timeline_entry_status`, and `toggle_vendor_checkin` — the entire data layer this dashboard runs on — had zero venue-ownership check, a real cross-tenant read/write gap. Fixed and empirically re-verified in the Timeline pass (`supabase/migrations/20260910000000_timeline_wedding_day_ops_authorization.sql`); not re-fixed here, only confirmed still in place before this audit proceeded.

### 2. Silent failure on the dashboard's live mutations — already fixed (Timeline Release Readiness, Release Blocker #2)

`handleTimelineStatus`, `handleVendorToggle`, `handleTaskComplete` previously fired-and-forgot every write with no error handling, on the exact page a coordinator stands at all day. Fixed in the same prior pass; confirmed still in place.

### 3. Staff assignment — captured everywhere else in the product, invisible on the one day it matters most

`timeline_entries.assigned_to_staff_id` and `event_tasks.assigned_to_staff_id` are both real, populated, working fields (confirmed in the Timeline audit — Timeline's own staff picker is fully built) — but `get_wedding_day_ops`'s `timeline` and `tasks` blocks never select them. A coordinator standing at the venue at 8:00 AM, looking at the Run of Show or the Task Checklist — the two lists that answer "what happens now and who's doing it" — can see *what* and *when*, never *who*. The data already exists; it simply never reaches this page. This is the audit brief's own "Staff: Assignments, Ownership, Visibility" question, answered today with "assignments and ownership are real; visibility, on the one surface that needs it most, is not."

---

## UX Improvements

Real, verified gaps that don't block release but materially affect a coordinator's ability to run the day confidently. Selected items implemented in Phase 2.

1. **Luv's observations panel has no visual distinction between kinds.** `luvObs` (`wedding-day-dashboard.tsx`) is a flat `string[]` — "Ceremony begins in 2 hours," "Still waiting on [vendor]," "All wedding day tasks are complete," and "3 tasks still on the checklist" all render as identically-styled sentences in one pink box. The audit brief's own framing — "Alerts, Celebrations, Waiting, Risks" — implies these should read differently at a glance; today they don't. This is a real, working, stateless observation engine (matching `docs/luv-platform-reconciliation.md`'s praise for exactly this pattern elsewhere in the product) that simply never got the visual layer its own content already implies.
2. **Requests have zero presence on the Wedding Day dashboard.** `get_wedding_day_ops` never fetches them; no section exists. A pending Approval-type Request (per `docs/wedding-workspace-architecture.md` §13's own model) tied to this booking is invisible to a coordinator running the day, even if it's genuinely time-sensitive.
3. **Communication has zero presence.** Same shape as Requests — no recent-messages surface, no unread indicator, nothing. A coordinator has to leave this page entirely to check whether the couple sent a last-minute note.

**Not implemented in this pass, named honestly:** a Communication surface on the dashboard (a real, valuable addition, but a larger UI investment than a data-wiring fix — the Requests section this pass adds is the bounded version of the same idea); a formal coordinator hand-off/on-duty concept (see Edge Cases); vendor-cancellation as a first-class state (today handled generically via notes/reassignment, not a dedicated workflow).

---

## Platform Integration Gaps

Verified directly — every capability the audit brief names, checked against what actually reaches this page.

**Confirmed fully integrated, working correctly (not gaps, not duplicated):**
- **Timeline** — the Run of Show is Timeline's own live data, read and written through the same `timeline_entries` table the Booking Timeline editor uses; no second copy, no drift possible by construction.
- **Vendors** — `event_vendor_assignments`, same table Vendor Management already owns; check-in/setup-complete here *is* the vendor's day-of state, not a parallel tracker.
- **Floor Plans / Seating** — both render via `QuickFloorPlans`/`QuickSeating`, reading the same Floor Plans/Seating data those features' own release-readiness passes already verified end-to-end (real floor plans, real seating lookups — this dashboard reveals them, it doesn't reimplement either).
- **Documents** — `QuickDocuments` reads the same `documents` table the Booking Workspace's own Documents tab uses.
- **Calendar** — correctly *not* duplicated on the dashboard itself; a real "Booking Schedule" link in the page header (`today/page.tsx`) routes to `/calendar/booking/{eventId}`, Calendar's own per-booking view, rather than the dashboard reimplementing any of it.
- **Event Readiness** — every one of its ten sections carries a real, specific `nav` target (`tab`/`link`/`portal`/`scroll`, confirmed directly in `lib/readiness/compute.ts`) — every recommendation this platform's readiness model produces leads somewhere real, not a dead end.
- **Luv** — the observations panel is a genuine, working, stateless computation over this exact page's own live data (ceremony countdown, vendor readiness, dietary notes, task completion) — not the broken persisted Luv layer `docs/luv-platform-reconciliation.md` documents elsewhere (`luv_memories`/`luv_insights`/`luv_recommendations`, still broken at the SQL layer, unrelated to and unused by this page).

**Real gaps:** Requests (UX Improvement #2, addressed in Phase 2), Communication (named honestly, deferred).

**Nothing found duplicating another feature's ownership.** Every section on this dashboard either reads a table another feature already owns (Timeline, Vendors, Floor Plans, Seating, Documents, Event Readiness) or is genuinely this page's own synthesis of already-owned facts (the Luv panel, the ceremony countdown) — no second Timeline, no second Vendor tracker, no shadow readiness computation was found anywhere in this surface.

---

## Future Enhancements

Kept intentionally small:

- A Communication surface on the Wedding Day dashboard (recent messages, an unread indicator).
- A formal on-duty coordinator / hand-off concept — today, any authenticated venue staff member can open and act on this page with no assignment or audit trail of who was "running" the day at a given moment. Not a data-integrity risk (all actions are correctly venue-scoped, per Release Blocker #1's fix), just no ritual or record of hand-off.
- A dedicated vendor-cancellation workflow, distinct from the generic reassignment/notes path that already handles it today.
- Extending `luvObs`'s new `kind` tagging (Phase 2) into the shared `lib/luv/` observation model per `docs/luv-platform-reconciliation.md` §4, rather than remaining bespoke to this one page.

---

## Release Recommendation

# Ready

**Justification.** Walking the day exactly as instructed — a coordinator arriving at 8:00 AM and leaving after breakdown — the Wedding Day dashboard genuinely supports it: a live Run of Show with click-to-cycle status and now a real delay-recovery action, vendor check-in tied to the same records Vendor Management owns, Floor Plans and Seating lookups built specifically for this moment by their own completed release passes, Documents, Key Contacts, a working Luv observation panel, and — as of this pass — real staff-assignment visibility and outstanding-Requests visibility, closing the two gaps that would have left a coordinator guessing "who's doing this" or missing a pending approval mid-event. Every Event Readiness recommendation leads somewhere real. Nothing on this page duplicates another feature's ownership — every section reveals a fact another capability already owns, exactly the discipline `docs/calendar-platform-integration.md`'s "Calendar owns time, not work" principle establishes and this page follows for every domain it touches, not just Calendar's own.

**What made this "Ready" rather than "Almost Ready."** The two genuine Release Blockers found in this audit (Release Blockers #1/#2) were shared infrastructure already fixed one pass earlier, in Timeline's own audit — re-verified, not re-fixed, here. The one blocker specific to this page (staff visibility) and the two most consequential UX gaps (Luv's flat observation list, zero Requests visibility) are all fixed and verified in this same pass. What remains — a Communication surface, a formal coordinator hand-off record, a dedicated vendor-cancellation workflow — is real, honestly named, and genuinely optional: none of it prevents a coordinator from running a real wedding day through this product today.

---

## Phase 1 — Release Blockers (implemented, verified)

1. **RPC authorization and silent-failure fixes** — confirmed still in place from the immediately-preceding Timeline pass; not re-implemented here.
2. **Staff assignment now reaches the Wedding Day dashboard** — `get_wedding_day_ops` (`supabase/migrations/20260911000000_wedding_day_ops_staff_visibility.sql`) now left-joins `venue_staff` into both the `timeline` and `tasks` blocks, returning `assignedToStaffId`/`assignedToName`. `LiveTimeline` and `GroupedTaskList` (`components/events/wedding-day-dashboard.tsx`) now render a "👤 [name]" line under any entry or task that has one.

## Phase 2 — UX Improvements (implemented, verified)

1. **Luv's observations now carry a real kind** (`fact`/`celebration`/`waiting`/`risk`, a page-local version of `docs/luv-platform-reconciliation.md` §4's model) — each observation is tagged at the point it's computed (a vendor still pending is `waiting` normally, `risk` once the ceremony is within 30 minutes; "all vendors ready"/"all tasks complete" are `celebration`), rendered with a distinct emoji/color, and sorted celebration-first-risk-second so the thing most worth a coordinator's attention reads first instead of wherever the computation happened to push it.
2. **Requests are now visible on the Wedding Day dashboard.** `today/page.tsx` fetches this booking's Requests (`getRequests({ eventId })`, already-existing, unmodified) and filters to outstanding ones (not `draft`, not `completed`/`cancelled`); a new "Requests" section lists each with its status and links directly to the Request itself — this page reveals Requests, it doesn't reimplement the Request Center.

**Not implemented in this pass** (named honestly, not silently dropped): a Communication surface, a coordinator hand-off record, a dedicated vendor-cancellation workflow.

## Phase 3 — Full Verification

- Full-repo `tsc --noEmit`: clean, zero errors (the same two pre-existing, unrelated stale `.next/types/validator.ts` errors noted in the Timeline pass, present before and after this one too).
- Full-repo `eslint`: 150 errors / 108 warnings — identical to the established baseline, zero new issues.
- Staff-visibility JOIN tested against real data: assigned a real staff member (`venue_staff`) to a real timeline entry, confirmed the RPC's join resolves the correct `full_name`; reverted.
- Requests filter logic confirmed via code read (no `draft`/`completed`/`cancelled` in the outstanding set) — no real Requests existed on the test event to exercise live, so this is a code-level, not data-level, verification; the underlying `getRequests` call is pre-existing, unmodified, already-proven code.
- Luv kind-tagging confirmed via code read: every existing observation branch now carries an explicit `kind`; the 30-minutes-to-ceremony risk upgrade only fires when a real countdown exists, never invented from nothing (matching the reconciliation doc's own rule that a Risk must cite an actual crossed threshold).
