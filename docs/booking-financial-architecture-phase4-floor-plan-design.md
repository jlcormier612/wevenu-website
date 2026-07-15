# Phase 4 — Floor Plan as the Operational Representation of Event Order

**Status: design only. No implementation has started.** Sixth document in the Booking Financial Architecture series, following the roadmap's own Phase 4 entry. Phase 3 shipped and is verified (`docs/booking-financial-architecture-phase3c-implementation.md`) — Event Order is now the real, trusted source of what a booking includes. This document reframes Phase 4 against that fact, per your direction: not "Floor Plan reconciliation" as a bolt-on feature, but **Floor Plan becoming the first system that actually operates on what Event Order has already decided.**

**Companion document:** `docs/floor-plan-seating-architecture.md` — the same kind of cross-domain design question (two systems describing the same room), already answered once for Floor Plans ↔ Seating, in the exact house style this document follows. Read together, Event Order ↔ Floor Plan ↔ Seating forms one coherent chain: Event Order decides *what and how many*, Floor Plan decides *where*, Seating decides *who*.

---

## The governing question

Every design decision below was run through the same test, and the answer is recorded next to each one:

> **Does Event Order own this decision? Or is Floor Plan simply visualizing it?**

If Event Order owns it, Floor Plan may only *display* it — never re-author it, never let a coordinator create a second, competing version of it by placing objects. If Floor Plan owns it (physical position, room layout, which staff-facing objects exist), Event Order has no opinion and shouldn't try to. The one deliberately narrow exception is *count* — Floor Plan's placed objects are allowed to disagree with Event Order's committed quantities, because disagreement is exactly the signal this phase exists to surface. But even that disagreement is read-only: seeing it never changes either side.

---

## 1. Current state — what already exists, verified directly against schema

Grounding this design in what's actually built, not what the roadmap assumed was built:

- **Multiple Floor Plans per Event already ships.** `20260815000000_floor_plans_multi.sql` dropped `floor_plans`' original one-per-event unique constraint specifically for "Ceremony, Reception, Cocktail Hour, Rain Backup" — your framing isn't a new capability to build, it's already the live data model. Confirmed: zero schema work needed for Event↔FloorPlan cardinality.
- **`event_order_sections.floor_plan_id` already exists**, added in Phase 2's foundation migration, explicitly reserved for this phase, nullable, `on delete set null`. One Section links to at most one Floor Plan. This phase wires it up; it doesn't invent it.
- **A real, structured reconciliation path already exists for inventory-sourced items on both sides.** `event_order_lines.inventory_item_id` (provenance = `'inventory'`) and `floor_plan_objects.inventory_item_id` both reference the same `inventory_items` row. Where both sides point at the same Inventory item, comparing counts is exact — no fuzzy text matching between an Event Order line's `description` and a Floor Plan object's `label` required, or wanted.
- **Floor Plans has no "finalized" checkpoint today.** The roadmap's Phase 4 entry assumes a "coordinator marks a floor plan final" moment to anchor the mismatch check. That moment doesn't exist yet — `floor_plans` has no status or finalized timestamp of any kind. This phase has to add it.
- **A separate, pre-existing gap this phase now depends on and should fix while here:** `floor_plans`/`floor_plan_objects` RLS is still the legacy `owner_user_id = auth.uid()` pattern from Sprint 18 (before Team Collaboration), while every Event Order table uses the modern `current_user_venue_id()` pattern. Today, any staff member who isn't literally the venue owner cannot see Floor Plans at all. Once a coordinator (not necessarily the owner) is linking Event Order Sections to Floor Plans as part of normal authoring, this stops being a dormant gap and becomes an active bug blocking the feature for exactly the people who'd use it. Recommending this be folded into Phase 4's own migration rather than filed as separate, deferred cleanup — it's the same shape of fix the roadmap already calls out by name for other tables, just discovered on this one now that this phase touches it.

---

## 2. Ownership

Stating this as plainly as the Seating document does, because the two are structurally identical:

- **Event Order owns *what and how many*.** Sections, Lines, quantities, descriptions, provenance — none of that is Floor Plan's to decide or restate. A Floor Plan should never be the place a coordinator types "we're doing 15 round tables" as an original decision; that's an Event Order Line.
- **Floor Plan owns *where and how it's arranged*.** Room dimensions, object position, rotation, which specific physical objects exist in the layout, background image, print output for setup crews. Event Order has no opinion on any of this and never gains one.
- **Neither owns the other's domain, and this phase does not blur that.** A coordinator can still place 18 round tables on a Floor Plan whose linked Section says 15 — Floor Plan placement is never blocked, gated, or auto-corrected by Event Order's count. The mismatch is *information*, surfaced at a checkpoint, not a constraint.

This is the same ownership shape the roadmap already specified ("Floor Plan still owns placement, Event Order still owns quantity") — this document doesn't change that conclusion, it makes the mechanism concrete enough to build.

---

## 3. How Sections relate to multiple Floor Plans

Your prompt asked specifically for this evaluation. The answer, given what's already built: **the relationship is naturally one Section to one Floor Plan, and an Event with several Floor Plans simply has several Sections each pointing at the one that governs it.**

A real example, using the schema as it exists today:

| Event Order Section | Linked Floor Plan | What reconciliation means here |
|---|---|---|
| Ceremony | "Ceremony Layout" | Ceremony Section's inventory-sourced lines (chairs, arch, aisle runner) vs. objects placed on the Ceremony floor plan |
| Cocktail Hour | "Cocktail Hour Layout" | Cocktail Section's lines (high-top tables, bar) vs. that floor plan's objects |
| Reception | "Reception Layout" | Reception Section's lines (round tables, head table, dance floor) vs. that floor plan's objects |
| *(none)* | "Rain Backup" | No linked Section — this floor plan simply isn't reconciled against anything, which is correct: it's a contingency layout, not a committed one |

Nothing about this needs a many-to-many join table or a new schema shape. A Section pointing at zero or one Floor Plan, and a Floor Plan having zero or many Sections point at it (uncommon in practice, but not worth forbidding — a coordinator combining Cocktail Hour and Reception into one physical room with one Floor Plan is a real venue layout, not an edge case to reject), is exactly what the existing nullable FK already expresses. **This phase's job is to make that relationship visible and useful in the UI, not to redesign it.**

One explicit non-goal, stated because it's the natural next question: this phase does **not** attempt event-wide reconciliation (summing every Section's chair count against every Floor Plan's total chairs, ignoring which Section maps to which room). That would silently assume a coordinator's Sections and Floor Plans line up one-to-one in a way this schema deliberately doesn't require. Reconciliation only ever compares a Section against *its own* linked Floor Plan — never the aggregate.

---

## 4. The reconciliation mechanism

**What gets compared:** for a Floor Plan with a linked Section, group that Section's Lines by `inventory_item_id` where `provenance = 'inventory'`, sum `quantity` per item. Separately, group that Floor Plan's `floor_plan_objects` by `inventory_item_id` (where set), count objects per item. Compare the two groupings.

**What doesn't get compared, and why that's correct, not a gap:** Lines with `provenance = 'package'` or `'custom'` have no `inventory_item_id` and therefore nothing on the Floor Plan side to count against — a bundled "Reception Package" line or a freeform "Late-night snack bar" custom line was never going to correspond to a countable object. This mirrors exactly the boundary the Seating document already named for chairs-vs-tables double-counting (§7): **the honest answer is that some commitments aren't the kind of thing a floor plan reconciles against, and the feature should say nothing about them rather than force a comparison that doesn't mean anything.** A venue that wants richer reconciliation coverage gets it by using itemized, inventory-sourced Lines (already possible today, and the direction Phase 6 pushes further) — not by this phase inventing a second, looser matching heuristic.

**Where the check runs:** only at the moment a coordinator marks a Floor Plan **Final** — a new, narrow checkpoint this phase adds (`floor_plans.finalized_at timestamptz`, nullable, mirroring `event_orders.finalized_at`'s exact shape rather than inventing a new status vocabulary). Never live, never on every edit, never blocking placement. This matches the roadmap's original call and your instruction that visualization must never gate or silently alter a commitment.

**What "mismatch" produces:** a dismissable, non-blocking notice, per inventory item, in both directions — "Reception Section commits 15 Round Tables; this Floor Plan places 18" and the reverse. Dismissing it doesn't change either side's data; it's acknowledgment, not resolution. There is no "sync" button that pushes one side's number onto the other — that would silently let a visualization step create or overwrite a commitment, exactly the failure mode you flagged as never acceptable. If the coordinator wants to change what's committed, they go make an Event Order edit deliberately in Event Order's own screen; if they want to change what's placed, they edit the Floor Plan. This phase only ever tells them the two disagree.

**Unfinalizing:** marking a Floor Plan Final is reversible (clear `finalized_at`), same as Event Order's own status — a coordinator isn't locked out of further editing by having checked reconciliation once.

---

## 5. What happens when each side changes after a Floor Plan is finalized

Direct application of the governing question to every real change scenario, matching the Seating document's own "what happens when X changes after Y already committed" section (§5) in shape:

1. **An Event Order Line's quantity changes after the linked Floor Plan was marked Final.** Event Order owns this decision — the edit proceeds with zero friction, exactly as it does today. The Floor Plan's `finalized_at` is left untouched (a finalized layout doesn't silently un-finalize because a number changed elsewhere), but the mismatch notice recalculates the next time anyone views that Floor Plan, since it's a read-time comparison, not a stored snapshot — no risk of it going stale in a way that matters, since nothing was ever frozen to begin with.
2. **A Floor Plan object is added, removed, or its `inventory_item_id` is changed after Final.** Floor Plan owns this — placement editing is never gated by having been finalized once. Same as above: the mismatch notice simply reflects the new counts next time it's viewed. Marking Final is a checkpoint a coordinator chooses to revisit, not a lock.
3. **A Section's `floor_plan_id` is changed to point at a different Floor Plan, or cleared.** This is an Event Order authoring decision — Event Order owns it, no gate. The old Floor Plan simply stops having a linked Section (reconciliation notice disappears there); the new one gains it.
4. **A Floor Plan is deleted while a Section still points at it.** Matching the exact precedent already set for Seating (§5.3 of the companion doc — `on delete set null`, never cascade, never blocking): the Section survives, its Lines survive, `floor_plan_id` simply becomes null. A coordinator's Event Order authoring is never destroyed by a Floor Plan being deleted, the same principle already proven correct once in this codebase for the identical shape of relationship.
5. **A Section is deleted while its Floor Plan is marked Final.** Floor Plan is untouched — it was never Event Order's to remove. The reconciliation notice for that Floor Plan simply has nothing to compare against anymore and stops appearing, same as an unlinked Floor Plan today.

None of these five require locking, blocking, or cross-system validation at write time — every one resolves cleanly at *read* time, because reconciliation was never anything other than a comparison. This is what "visualization never silently creates or changes a commitment" looks like as an actual mechanism, not just a stated intent: there is no code path anywhere in this design that writes to `event_order_lines` from Floor Plan, or to `floor_plan_objects` from Event Order.

---

## 6. Applying the governing question to the specific decisions this document makes

Making the test's application explicit, since that was the point of the reframing:

| Decision | Event Order owns it | Floor Plan merely visualizes it |
|---|---|---|
| How many round tables this event has committed to | ✅ | |
| Where those tables physically sit in the room | | ✅ |
| Whether a mismatch exists between committed and placed counts | | ✅ (a fact Floor Plan surfaces about Event Order's own data — Floor Plan doesn't decide what "correct" looks like, it just shows disagreement) |
| Resolving a mismatch | ❌ neither — resolution is always a deliberate, separate edit on whichever side was wrong, never automatic |
| Which Section a Floor Plan corresponds to | ✅ (Event Order Section authoring, via `floor_plan_id`) | |
| Marking a layout print-ready ("Final") | | ✅ (Floor Plan's own checkpoint — has no bearing on Event Order's own Open/Finalized lifecycle, a deliberately separate concept) |
| Custom/package line items with no floor-plan equivalent | ✅ (Event Order owns them fully; Floor Plan has nothing to say about them, by design) | |

---

## 7. Platform principle this phase establishes

Continuing the practice already running through this series (`docs/trust-risk-register.md`'s TR-* entries, the roadmap's "expand, then contract," Phase 3c's amendment-traceability rules) — one new principle worth naming explicitly, since it's the actual mechanism behind everything above and will recur the next time two systems describe the same real-world thing from different angles (Travel ↔ Communication's send confirmations is a plausible future instance):

> **When two systems describe the same real-world fact from different vantage points, exactly one of them owns the decision. The other may compare, display, and flag disagreement — but a comparison is not a sync, and disagreement is not an error state requiring resolution. The non-owning system should never gain a write path back into the owning system's data, no matter how convenient a "fix it for me" button would be.**

This is the same discipline already proven once for Floor Plans ↔ Seating (`floor-plan-seating-architecture.md` §2–§5) and now applied a second time for Event Order ↔ Floor Plans — worth treating as a standing pattern for this platform generally, not a one-off decision re-derived per feature.

---

## 8. What this phase does not do

- Does not touch Invoice, Payment, or any money-moving system — Phase 3 already established Event Order as their source of truth; this phase only adds a second, purely visual/comparative consumer.
- Does not attempt reconciliation for package- or custom-provenance lines, for the reasons in §4.
- Does not attempt event-wide (cross-Section) reconciliation, for the reasons in §3.
- Does not add any blocking behavior anywhere — not during Floor Plan editing, not during Event Order editing, not at Final.
- Does not change Seating in any way — Seating continues reading `floor_plan_objects` exactly as the companion document already specified; this phase adds a second, independent consumer of the same Floor Plan data, not a change to the one that already exists.

---

## Open questions for review before implementation

1. Is `floor_plans.finalized_at` (mirroring Event Order's own field name/shape) the right checkpoint mechanism, or would a more general per-Floor-Plan status column read better in the UI given Floor Plans already has richer states in practice (draft, shared-for-seating via `client_access`)?
2. Should the legacy RLS fix on `floor_plans`/`floor_plan_objects` ship as part of Phase 4's migration (recommended above) or as its own, separately-tracked fix landed first? Either is safe; bundling is smaller-surface-area but makes Phase 4's migration slightly less purely additive than every prior phase in this series has been.
3. Confirm the notice should be symmetric (over-count and under-count both surfaced) rather than only warning about under-provisioning — over-placing seems just as worth flagging (wasted rental cost, room clutter) as under-placing (not enough seats), but worth confirming that's the intended coordinator-facing framing.
