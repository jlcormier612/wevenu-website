# Timeline — Release Readiness Audit

**Status:** Audit complete. Implementation follows in this same document's Phase 1/2/3 sections.
**Read first:** No dedicated `docs/timeline-*.md` design document exists in this repository (confirmed directly — Timeline is the one major feature area without one, unlike Calendar, Floor Plans, Seating, and Planning, each of which got a dedicated architecture doc before its own release-readiness audit). Timeline's architecture instead has to be assembled from `docs/wedding-workspace-architecture.md` (§3, §4, §8 — Timeline's ownership/collaboration model), `docs/shared-template-architecture.md` (Timeline Templates' intended shape), `docs/calendar-platform-integration.md` (§2/§4 — Timeline's deliberate non-presence on Calendar), and `docs/floor-plan-seating-architecture.md` (§6, cited as Timeline's own collaboration-model precedent). `docs/event-readiness-*` and `docs/request-*` do not exist in this repository either (confirmed, same as every prior audit this program).
**A finding about the docs themselves, worth stating up front:** `docs/shared-template-architecture.md` describes Timeline Templates as "four names, hardcoded into the application itself. Not venue-owned, not editable, not duplicable, not versioned" and states plainly at its close: "Nothing above is implemented. Timeline Templates remain unbuilt until this is approved." The live schema (`timeline_templates.venue_id`/`is_default`/`is_archived`/`space_id`) proves a real, venue-owned, editable, archivable, space-tagged template system was in fact built since that doc was written — the doc is stale on this point, exactly the same class of drift found in every prior architecture doc this program (Planning, Seating). What the doc got right and remains true: the *old*, hardcoded four-template system it describes was never removed — it still runs today, unconditionally, side-by-side with the new one (Release Blocker #3).
**Method:** Direct schema and code verification for every claim below — `information_schema`/`pg_proc`/`pg_policy` queries against the live local database, and direct reads of `lib/timeline/`, `lib/timeline-templates/`, `components/events/timeline/`, `components/timeline-templates/`, `app/api/portal/timeline/`, and the Wedding Day dashboard/RPCs. Two parallel research-agent passes were also launched for deeper UX/edge-case coverage but both failed mid-run to an account-wide session-limit reset; their partial output is not relied on here except one independently-corroborated fact (no duration/drift handling exists), matched by this document's own direct verification of the same fact. Every claim below is traceable to a file, line, or live query result, not to the failed agents' output.

---

## Release Blockers

Things preventing release. All three fixed in this pass — see Phase 1.

### 1. Three Wedding Day Ops RPCs have zero cross-tenant authorization check — the single most severe finding of this audit

`get_wedding_day_ops(p_event_id)`, `update_timeline_entry_status(p_entry_id, p_status)`, and `toggle_vendor_checkin(p_assignment_id, p_field)` are all `SECURITY DEFINER`, all owned by `postgres` (`rolbypassrls = true`, confirmed directly via `pg_roles`) — meaning all three run with **full RLS bypass**, regardless of the correctly-configured RLS policies already sitting on `timeline_entries`/`event_vendor_assignments`/`events`. None of the three contains any check that the calling coordinator's own venue (`current_user_venue_id()`, the exact helper this codebase's own RLS policies already use) matches the venue that owns the target row. Concretely, today:

- Any authenticated coordinator at any venue can call `get_wedding_day_ops('<any other venue's event id>')` and read that venue's entire wedding-day operational picture — timeline, vendor contact info, emergency contacts, and guest dietary/health data — by supplying a UUID they don't own.
- The same coordinator can call `update_timeline_entry_status` or `toggle_vendor_checkin` against another venue's `timeline_entries`/`event_vendor_assignments` row and it will silently succeed — a real cross-tenant write, not just a read.
- `toggle_vendor_checkin` additionally fires `_trigger_vendor_checkin_notification` on success (confirmed via its trigger definition), meaning an unauthorized cross-venue call also produces a real, spoofed "vendor has arrived" notification inside a venue the caller has no relationship to.

By contrast, every couple/guest-facing portal RPC touching the same tables (`update_portal_timeline_entry`, `add_portal_timeline_entry`, `get_guest_timeline`, `get_journey_timeline`) is correctly, robustly scoped — token lookup, expiry check, role check, and an explicit `venue_id =`/`client_id =` ownership check on the target row, in every one of them. This is not a systemic pattern across the codebase; it is isolated to these three coordinator-facing RPCs, which appear to have been built on the (false) assumption that "only reachable from a logged-in coordinator's own event page" is a security boundary — it isn't, since `supabase.rpc(...)` is directly callable by any authenticated session with nothing but the function name and its arguments.

### 2. Silent failure on all three Wedding Day dashboard mutations — the same class of bug already found and fixed once this program, now on the highest-stakes surface in the product

`handleTimelineStatus`, `handleVendorToggle`, and `handleTaskComplete` (`components/events/wedding-day-dashboard.tsx`) each apply an optimistic UI update, then `await fetch(...)` the corresponding PATCH with **no `.catch`, no `response.ok` check, and no rollback** — identical in shape to Floor Plans' own Release Blocker #1 ("Silent failure on guest seating actions"), which that audit called "the single highest-risk item in the whole audit" for exactly this reason. Here the stakes are higher, not lower: this is the dashboard a coordinator uses *during the live wedding itself*, and the dashboard already re-fetches from the server every 30 seconds (`setInterval(fetchData, 30_000)`) — meaning a failed write (an expired session, a network blip standing in a venue with poor signal, an RLS rejection) doesn't just fail silently once, it gets silently *reverted* on the very next poll, with zero indication to the coordinator that anything went wrong, in the middle of a live event they cannot pause. The backend route (`app/api/events/[id]/wedding-day/route.ts`) already returns real, meaningful error bodies (400/500 with a message) for every one of these failure modes — the frontend simply never reads them.

### 3. Applying a Timeline Template has no duplicate-prevention anywhere it's actually reachable, and two competing template systems are both live at once

Two independent "apply a template" paths exist today, and neither guards against re-application:

- **The new, venue-owned system** (`TimelineSetupCard` → `applyTimelineTemplateAction` → `applyTimelineTemplateToEvent`, `lib/timeline-templates/apply.ts`) is reasonably self-gated — the card only ever renders `if (!hasTimeline && templates.length > 0)`, so it disappears once any entry exists. But the underlying `applyTimelineTemplateToEvent` function itself has no duplicate check at all — it's reachable only through the gated card today, but nothing in the function itself would stop a second call.
- **The old, hardcoded four-template system** (`components/events/timeline/template-picker.tsx`'s `TemplatePicker`, backed by `TIMELINE_TEMPLATES` in `lib/timeline/constants.ts` — exactly the "four names, hardcoded into the application itself" system `docs/shared-template-architecture.md` describes and which was never retired) is rendered **unconditionally in the Timeline editor's own toolbar, every time the editor is open**, regardless of how many entries already exist. Clicking "Use Template" here, on a Timeline a coordinator has already spent hours hand-building, silently appends a second, mismatched, non-editable-source template's worth of entries with zero warning, zero "you already have N entries" messaging, and no undo.

This directly fails all three things the audit brief asks about — "preventing accidental duplicates," "replacing timelines," "reapplying intentionally" — not because reapplying is impossible, but because it's *silently possible at any time, indistinguishable from a first-time apply, with no confirmation step*.

---

## UX Improvements

Real, verified gaps that don't block release but materially affect usability. Selected items implemented in Phase 2.

1. **No bulk delay recovery.** Timeline entries have no duration/end-time (confirmed: no such column anywhere in the schema), only a single `entry_time`. There is also no "push everything after this back by N minutes" action anywhere — a coordinator recovering from a late ceremony has to manually re-edit every subsequent entry's time, one at a time. This doesn't require the architectural work `docs/shared-template-architecture.md` flagged as an open question (Reference-Point-as-another-Item, durations) — a bulk time-shift over the existing point-in-time field is a bounded, additive feature, not a redesign.
2. **No automatic "what's happening right now" indicator.** `status` (`not_started`/`in_progress`/`complete`) is entirely coordinator-set by clicking through `STATUS_CYCLE` — there's no comparison against the current wall-clock time to suggest or highlight which entry should be current. A coordinator has to remember to click.
3. **Two competing "New Template" experiences read as one, confusingly.** Beyond the duplicate-application risk (Release Blocker #3), a coordinator has no way to tell, from either entry point, that "Use Template" (editor toolbar) and "Set up this booking's timeline" (the setup card) draw from two entirely different, unrelated template libraries — one hardcoded and un-editable, one venue-owned and fully editable.
4. **No search in the Timeline Template library**, matching the same gap already found and left open in Planning's own template library.
5. **Archived-template exclusion is correctly implemented** (`getTemplates()` defaults to `is_archived = false`, confirmed) — named here only to note it's *not* a gap, unlike the pattern Floor Plans found and had to fix for its own "Duplicate Existing Template" flow.

**Not implemented in this pass, named honestly:** a real Reference-Point/dependency model for Timeline items (explicitly the open architectural question `docs/shared-template-architecture.md` itself deferred — out of scope for "do not redesign Timeline"); full retirement or merge of the old hardcoded template system into the new one (a real, valuable consolidation, but a redesign, not a bug fix); template-library search.

---

## Platform Integration Gaps

Verified directly, not assumed. Most of Timeline's platform integration is genuinely solid — stated here so the real gaps aren't lost among a long list of things that already work correctly.

**Confirmed fully integrated, working correctly (not gaps):**
- **Planning** — `event_task_context_links.timeline_entry_id` is genuinely bidirectional (confirmed in `lib/playbooks/repository.ts`), matching `docs/wedding-workspace-architecture.md`'s own finding.
- **Calendar** — correctly *not* present as its own venue-wide item type, by explicit design (`docs/calendar-platform-integration.md` §2/§4: "Timeline doesn't need its own Calendar item type; it needs the existing `event` item's link to route into the day-of schedule"). Confirmed live: `timeline_entry` exists only as a Calendar item *type* scoped to the per-booking Operational Schedule / Booking Schedule lens (`lib/calendar/types.ts`, "Calendar Integration Phase 3"), never on the venue-wide month grid. This is correct architecture, not a gap.
- **Event Readiness** — `computeTimelineReadiness` (`lib/readiness/compute.ts`) is real, live, and feeds the overall readiness score with a correct completion detail string.
- **Luv** — real and correctly actionable: a live observation flags "Events approaching without a day-of timeline," with a working recommendation (`{ label: "Build the day-of timeline", link: "/events/{id}", type: "navigate" }`) — confirmed in `lib/luv/observations.ts`.
- **Guests** — correctly no direct link. Guests has no timeline-shaped fact of its own; nothing to connect.
- **Couple/Guest portal RPCs** (`update_portal_timeline_entry`, `add_portal_timeline_entry`, `get_guest_timeline`, `get_journey_timeline`) — all correctly and robustly scoped (token → expiry → role → row-ownership), the strongest-built authorization surface found anywhere in this audit, standing in direct contrast to Release Blocker #1.

**Real gaps:**
- **Requests** — `RequestSourceFeature` includes `"timeline"` as a literal type value with **zero real call sites anywhere in the codebase**, confirmed via grep. This is the exact same "reserved but dead" pattern Floor Plans' own audit found for its `"floor_plans"` value — not a regression, but not built either.
- **Notifications** — zero coverage. No reminder fires before a Timeline entry's time, no notification is ever generated from Timeline activity of any kind. Confirmed via grep: zero references to `timeline` anywhere in `lib/notifications/`.
- **Automation** — zero coverage, same as Notifications — confirmed via grep, no Timeline-related action or trigger exists in the automation surface.

---

## Future Enhancements

Kept intentionally small:

- A real Reference-Point/dependency model for Timeline items ("2 hours before ceremony," one item relative to another) — the single largest legitimate architectural gap named by `docs/shared-template-architecture.md` itself, explicitly out of scope for a "do not redesign" pass.
- Retiring or merging the old hardcoded four-template system into the new venue-owned one — a real, valuable consolidation; this pass closes the safety gap (Release Blocker #3) without removing either system.
- A Request Framework bridge for Timeline (`RequestSourceFeature.timeline`, currently dead).
- Timeline-derived notifications/reminders and automation triggers.
- Template-library search.
- A true drift/delay model (durations, automatic downstream re-timing) beyond the bounded manual bulk-shift this pass adds.

---

## Release Recommendation

# Almost Ready

**Justification.** Timeline's core, load-bearing workflow is genuinely solid — the venue-owned Templates system is real (not the stale doc's "four hardcoded names"), applying a template to a booking works, section/entry editing, drag/drop reordering, staff assignment, and per-entry notes all work today, and the Wedding Day dashboard's Live Timeline (click-to-cycle status, ceremony countdown, gold "in progress" highlight) is a genuinely well-built live-execution surface once its authorization and error-handling gaps are closed. The couple/guest-facing portal RPCs are the best-built authorization surface found anywhere in this audit.

**Why not "Ready" outright before this pass.** A real cross-tenant authorization gap on the three coordinator-facing Wedding Day Ops RPCs, a silent-failure risk on the exact surface a coordinator depends on during a live wedding, and an unguarded duplicate-application path on a feature old enough to still coexist with the system that replaced it — all three fixed and verified in this pass, below.

**What's still open, honestly:** a real Reference-Point/dependency model for Timeline items, full retirement of the old hardcoded template system, a Request Framework bridge, and Timeline-derived notifications/automation. None of these are defects in what ships — they're real, correctly-scoped future investment, consistent with "do not redesign Timeline."

---

## Phase 1 — Release Blockers (implemented, verified)

1. **Cross-tenant authorization fixed** on `get_wedding_day_ops`, `update_timeline_entry_status`, `toggle_vendor_checkin` (`supabase/migrations/20260910000000_timeline_wedding_day_ops_authorization.sql`) — each now checks the target row's `venue_id` against `current_user_venue_id()` before returning data or writing. Caught and fixed a real bug in the fix itself during verification: `v_venue_id != current_user_venue_id()` silently passes when the right side is `NULL` (three-valued SQL logic — `x != NULL` is `NULL`, not `TRUE`, and `plpgsql`'s `IF NULL THEN` doesn't execute), corrected to `IS DISTINCT FROM`. Empirically re-verified against real data post-fix: all three RPCs now correctly reject a caller with no matching venue (`get_wedding_day_ops` → `{"error":"not_found"}`; `update_timeline_entry_status` → raises and leaves the row unchanged; `toggle_vendor_checkin` → `{"error":"not_found"}`, row unchanged), confirmed via direct query before/after each call.
2. **Silent-failure fixed on all three Wedding Day dashboard mutations** (`components/events/wedding-day-dashboard.tsx`) — `handleTimelineStatus`, `handleVendorToggle`, `handleTaskComplete` now capture the pre-mutation state, check `response.ok`, and on any failure revert the optimistic update and toast an error, instead of silently discarding the result and letting the next 30-second poll erase the coordinator's change with no explanation.
3. **Duplicate-application guard added to the old hardcoded template picker** (`components/events/timeline/template-picker.tsx`) — the toolbar's always-visible "Use Template" button now warns (an inline banner plus a confirm step) whenever the Timeline already has entries, naming exactly how many, before appending a second template's worth on top. The new venue-owned system (`TimelineSetupCard`) was already correctly self-gated to first-apply-only; this closes the gap on the one path that wasn't.

## Phase 2 — UX Improvements (implemented, verified)

1. **Delay recovery** — a new `shiftEntriesAfter` capability (`lib/timeline/repository.ts` → `lib/timeline/service.ts` → `shiftEntriesAfterAction`), wired into the Wedding Day dashboard's Live Timeline as a per-entry "Running late?" action: shifts every timed entry strictly after the chosen one by N minutes, in one write, leaving the anchor entry and everything before it untouched. Deliberately bounded — no durations, no dependency graph, no redesign of the timing model, just a bulk update over the existing point-in-time field, closing the real "recover from delays" gap named in the original audit brief without touching the open architectural question `docs/shared-template-architecture.md` itself deferred.

**Not implemented in this pass** (named honestly, not silently dropped): a real Reference-Point/dependency model; retiring or merging the old hardcoded template system; Timeline Template library search; an automatic "what's happening right now" time-based indicator (today's cycle-by-click status remains manual).

## Phase 3 — Full Verification

- Full-repo `tsc --noEmit`: clean, zero errors (two pre-existing, unrelated stale `.next/types/validator.ts` errors, present before and after this pass).
- Full-repo `eslint`: 150 errors / 108 warnings — identical to the established pre-existing baseline, zero new issues introduced.
- RPC authorization fix: empirically re-verified against real dev data for all three functions, both the rejection path (above) and, by construction, the acceptance path (the identical `current_user_venue_id()` helper already used successfully by every RLS policy in this codebase, e.g. `event_tasks_all`).
- Delay recovery: tested against a real event's real timed entries (07:00/08:00/09:00/11:00/11:30/12:30) — shifting from the 08:00 anchor by +15 minutes correctly left 07:00 and 08:00 untouched and moved every later entry by exactly 15 minutes; reverted, confirmed back to original times.
- Duplicate-application guard: confirmed via code read that the warning banner and confirm step render whenever `existingEntryCount > 0`, wired from the one call site (the toolbar, non-empty-state) that needed it — the two empty-state call sites correctly pass no count (default `0`), since applying there is always a genuine first application.
- Silent-failure fix: confirmed via code read that all three handlers now branch on `response.ok`, revert to the captured `previous` state on failure, and toast — matching the exact pattern already verified working for Floor Plans' own equivalent fix earlier this program.
