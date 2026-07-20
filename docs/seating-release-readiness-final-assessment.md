# Seating & Floor Plan Release Readiness — Final Assessment

Phase 3 of the platform's release-readiness review. Booking Financial Architecture (Phase 2) is closed; its five findings are documented Product Completion items, not reopened here. This assessment covers Seating & Floor Plan end-to-end, judged the way a coordinator would use it in a real booking, not the way an engineer would review the code.

## Methodology

A real booking was built from scratch through actual application paths: a client and confirmed event, a shared venue space, a reception floor plan with 15 round tables (150 seats, matching the event's guest count) plus stage/bar/dance-floor objects, a second floor plan for the ceremony, a saved layout template, a couple-portal session, and five real guests covering the interesting cases — a plus-one, a wedding-party member, an accessibility tag, a child, and a vendor meal. Every write went through the same SECURITY DEFINER RPCs and RLS-scoped tables the real coordinator UI and real couple portal use — `add_couple_guest`, `assign_guest_to_table`, `remove_guest_assignment`, `get_seating_data`, `applyTemplate`'s copy semantics — not superuser SQL. All test data was created and then fully deleted; final verification confirmed zero leftover rows.

Where a claim in this document is about UI/interaction that can't be exercised through REST (drag-and-drop feel, mobile touch behavior, print rendering), it's based on direct code inspection with file:line citations rather than a live click-through, and is labeled as such.

---

## What Held Up Well

**Floor plan CRUD and the multi-plan-per-booking model are solid.** Create, rename, and running two independent plans on one booking (a reception layout and a separate ceremony layout) all worked exactly as the workspace UI implies. `getAllFloorPlans` correctly lists both.

**Layout templates are a genuine copy-at-commitment feature, not a live link.** A template was created with a 10-capacity table, applied to a new floor plan, and then the template's own table capacity was changed to 16. The already-applied floor plan's copy stayed at 10 — confirmed with a live write, not just by reading `applyTemplate`'s code. This is the same trust pattern verified for Package pricing in Phase 2, correctly reused here.

**The Room Settings Notes field is real and wired**, contrary to an open question in an earlier internal audit doc — `handleNotesChange` in the editor calls `updateNotesAction`, which persists to `floor_plans.notes` and renders on the print page. Not orphaned.

**Access-level gating on the seating RPCs is correct and consistently enforced**, on both reads and writes. A portal session created with `access_level: 'financial'` got an empty `get_seating_data` payload and a `false` from `assign_guest_to_table` — verified live, not just read in the SQL. The previously-known gaps in these two functions (missing access-level check; a silent-failure bug in the couple UI's assign/remove flow that didn't roll back on error) are both confirmed fixed in the current code.

**Capacity validation is intentionally advisory everywhere, and that choice is applied consistently.** A table's capacity was dropped to 3 with 4 guests already seated at it — the RPC still allowed it, no error, no partial-block. The same soft-warning-only pattern shows up in the editor (a free-text capacity field with no validation), the couple's canvas (red stroke + ⚠ past capacity), and the coordinator's day-of lookup (same red-badge treatment). This isn't a half-built validation; it's a deliberate "never block a coordinator from doing what the room actually requires" design, executed the same way everywhere it appears.

**`guest_seat_assignments` is the best-secured table in the domain** — zero RLS policies at all, reachable only through the three SECURITY DEFINER RPCs. This is the one place in the whole feature area where the self-referencing-RLS/RETURNING hazard that has bitten this codebase before could have shown up, and it structurally can't, because there's no policy to self-reference.

**Print is real, not a stub.** Both the floor-plan SVG print view and the table-roster seating print view are fully implemented, including `@media print` layout rules — this was independently verified by direct inspection, not taken on faith from an older doc.

**The Event Order Section → Floor Plan link is unambiguous.** Unlike the couple-facing link (see Finding 2 below), a Section's `floor_plan_id` is an explicit foreign key set by the coordinator via `setSectionFloorPlanAction` — there's no inference, no "most recent wins" logic. The reconciliation banner built on top of it was already verified end-to-end with real chain-linked data in Phase 2 (20 committed vs. 16 placed correctly bucketed as "Changed") and wasn't re-run here.

---

## Genuine Architectural & Product Discoveries

**1. [High] There is no coordinator-side seat-assignment tool anywhere in the product.** The venue's own floor plan editor (`components/floor-plan/floor-plan-editor.tsx`) has zero code reference to a guest, a household, or a seat assignment — it is purely a layout tool for placing tables and shapes. The only place a guest can be assigned to a table is the couple's own portal canvas. The coordinator's other seating surface, `wedding-day-seating.tsx`, is explicitly, deliberately read-only — its own header comment says so, and it has no assign/remove/drag affordance of any kind. This means: if a couple doesn't do their own seating in the portal — because they're disengaged, because the venue offers full-service seating as part of the package, or because the coordinator is finishing the chart the week of the wedding — there is no in-app way for the coordinator to do it for them. Every other piece of this feature works; this is the one place where the actual workflow a real venue would expect (a coordinator can always step in and finish the job) doesn't exist.

**2. [High] Which floor plan the couple sees is decided silently, by whichever plan was most recently edited — not by an explicit coordinator choice.** Live-tested: with the reception plan already fully seated (guests assigned by the couple) and shared, a second, unrelated ceremony plan was also shared and then had a trivial edit made to it. `get_seating_data`'s query is `order by fp.updated_at desc limit 1` — the couple's view silently flipped to the ceremony plan, with the reception seating work (still fully intact in the database) no longer visible to them at all. A warning banner does exist for this — but only inside the coordinator's own workspace view, appears only after the fact, and nothing on the couple's side ever indicates that a different plan than the one they were working on might now be "live." No data is lost, but a couple's completed work can vanish from their own view with no explanation, triggered by an edit to an entirely different plan.

**3. [Medium] An un-converted guest plus-one is completely invisible to the seating system.** `couple_guests` has two different representations of "this guest has a plus-one": a lightweight `plus_one`/`plus_one_name` text label, and a full separate guest row (linked via `plus_one_of_guest_id`) created through an explicit "Convert to guest" action in the couple's own guest-list UI. This two-tier model is intentional, not a bug. But live-tested: assigning a guest with an un-converted plus-one to a table increments the seated count by exactly 1, and the plus-one's name never appears in the table's guest list, the printed roster, or the day-of lookup. Nothing anywhere warns a coordinator that some of the event's attending headcount may currently have no chair reserved for it. For a physical room setup, this is a real under-provisioning risk, not just a display inconsistency.

**4. [Medium] Two disconnected mechanisms exist in the schema for "which table is a guest at."** `couple_guests.table_number` (a legacy text column whose own migration comment reads "future: seating assignment") sits alongside the real, current `guest_seat_assignments` join table. A repo-wide grep found zero application-code references to `table_number` anywhere — it isn't causing active drift today, but it's exactly the kind of duplicate-state landmine that bites the next person who writes code against the wrong column without knowing the real one exists.

**5. [Low] Cross-booking inventory conflicts on floor plans are neither checked nor warned about.** `getUsageForEvent`'s own code comment says "reporting only, never enforced," and it's scoped to a single booking's own plans — nothing compares inventory placement across two different bookings on overlapping dates. Consistent with the domain's broader "advisory, never blocking" philosophy, so likely intentional, but worth naming explicitly under "Inventory interaction" and "Capacity validation," since a coordinator could double-commit the same physical round tables to two same-day events with no signal anywhere in this tool.

**6. [Low] Both drag-and-drop canvases are effectively desktop/mouse-only, with no explicit fallback messaging.** The venue editor uses `PointerEvent`s (which have latent browser-level touch support, though nothing in the component was built or tested for it); the couple's portal canvas uses native HTML5 drag-and-drop, which has no touch support at all without a polyfill. Confirmed by direct grep: zero references to `touch`, `mobile`, or responsive breakpoints in either file. A coordinator or couple opening either on a phone gets a silently degraded interaction, not a guided one.

**7. [Low] `client_access = 'edit'` is a reserved-but-dead value**, same pattern as other unused-enum-value findings elsewhere in this codebase — the check constraint allows it, but only `'hidden'` and `'view'` are ever written by application code.

---

## UX Discoveries

`wedding-day-seating.tsx` is a genuinely well-scoped tool — deliberately read-only, built for a coordinator standing in the room with a phone or tablet, and it doesn't try to be anything more. The editor's Notes/Room Settings panel, the projected-vs-stored distinction pattern reused from the Invoice work, and the print views all read as complete, intentional pieces of software, not placeholders.

Where the experience breaks down is exactly where Finding 1 lives: a coordinator who wants to help — or who needs to, because the couple hasn't done it — has no "Where do I do this?" answer, because there genuinely is nowhere to do it from the coordinator side. That's not a discoverability problem to fix with better labeling; the capability itself doesn't exist yet.

The multi-plan-sharing banner (Finding 2) is good instinct — the system does try to warn someone — but it warns the wrong audience. It tells the coordinator, after the fact, that the couple might be looking at a different plan than expected. It never tells the couple. A couple who spent an evening seating 150 guests and then can't find that work the next time they open their portal will reasonably assume something broke, not that an unrelated edit on the venue's side quietly changed which plan is "theirs."

The plus-one seam (Finding 3) is subtle but real: a couple sees "+1: Jordan Lee" as a friendly label in their guest list, and nothing about the Seating tab hints that this label needs to be "graduated" into a real, seatable guest before it can occupy a chair.

Nothing in this pass felt duplicated at the UI level — the two guest-plus-one mechanisms and the two table-number mechanisms are schema-level duplication, invisible to a user, not UX duplication a coordinator or couple would notice.

---

## Remaining Product Opportunities

*(Documented for prioritization, per the standing instruction not to build or redesign during this review — not committed to a roadmap by being listed here.)*

- A minimal coordinator-side seat-assignment capability — even a stripped-down reuse of the couple's own canvas interaction — for venue-managed or assisted seating.
- Make the "which plan is live for the couple" decision an explicit coordinator action instead of an implicit most-recently-updated inference, or simply restrict a booking to one actively-shared plan at a time.
- Surface un-converted plus-ones as a visible caveat wherever seated headcount is shown to a coordinator (print roster, day-of lookup) — e.g. "+1 guests not yet seated: 3."
- Remove the dead `couple_guests.table_number` column and the dead `client_access = 'edit'` constraint value in the Engineering Cleanup sprint, alongside the other confirmed-dead items already on that list.
- Consider a same-date, cross-booking inventory conflict check for floor-plan-placed items, matching the level of care already given to space double-booking elsewhere in Availability.
- Add either real touch support or an explicit "not optimized for mobile" notice to both drag-and-drop canvases.

---

## Release Blockers

Nothing found here requires reopening or redesigning what's been built — every mechanism that exists (CRUD, templates, RLS, access-level gating, print, reconciliation) works correctly under live testing. The one item that rises to blocker-adjacent status is Finding 1: the complete absence of a coordinator-side seat-assignment path. This doesn't break anything that ships today, but it does mean Seating, as it currently stands, is only a complete workflow for bookings where the couple fully self-serves through the portal. For any venue whose service model includes the coordinator doing or finishing seating themselves — a real, common pattern at full-service venues — this feature is not usable at all for that booking, not degraded, not usable. Finding 2 (silent multi-plan visibility flip) compounds this: it's the one place couple-visible state can change without the couple's own action causing it.

Neither finding is architectural in the sense the Booking Financial Architecture review used that word — nothing here requires new data model or a rework of what's shipped. Both are scoped, buildable additions.

---

## Recommendation: **Almost Ready**

The floor plan and seating mechanics that were built are solid, correctly secured, and behaved exactly as designed under direct attempts to break them — capacity, template copying, access-level gating, and print all held. "Almost," not "Ready," because Finding 1 means the feature doesn't yet cover the full range of how real venues run seating (coordinator-assisted, not just couple-self-service), and Finding 2 means the one workflow that is fully built has a real, demonstrated way for a couple to silently lose sight of already-completed work. Both are closable without touching the architecture underneath them.

### Prioritized Completion Checklist

1. **Coordinator-side seat assignment** — the one true release blocker; without it, Seating only serves self-service couples. *(High)*
2. **Make "which plan is live" explicit, not inferred** — close the silent multi-plan visibility flip before broad rollout. *(High)*
3. **Surface un-converted plus-ones wherever headcount is shown to a coordinator** — closes a real physical-under-provisioning risk. *(Medium)*
4. **Cross-booking inventory conflict visibility** — matches the bar already set elsewhere in Availability. *(Low, can follow release)*
5. **Touch/mobile support or explicit fallback messaging** on both canvases. *(Low, can follow release)*
6. **Engineering Cleanup sprint additions**: dead `table_number` column, dead `client_access = 'edit'` value. *(Cleanup, not release-blocking)*
