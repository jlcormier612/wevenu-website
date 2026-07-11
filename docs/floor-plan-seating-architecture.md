# Floor Plans ↔ Seating — Architecture

**Status:** Built. Seating Experience — Phase 1 (Foundation & Floor Plan Integration) implemented exactly the relationship this document recommended: tables are `floor_plan_objects` rows, read live, never duplicated; the couple's only new data is `guest_seat_assignments` (guest ↔ table_object_id). The rest of this document is kept as-written — it was the correct call before implementation and every recommendation in it held — with inline notes marking what Phase 1 resolved. See §1 and §5.3 for what changed.
**Companion document:** `docs/wedding-workspace-architecture.md` §3 (Ownership Model) and §7 (Seating Architecture) — this document goes deeper on the one relationship that doc flagged as a conflict and left unresolved by design.

---

## 1. Current state — two unconnected systems describing the same room

*(As found before Seating Experience — Phase 1. A Seating feature already existed at this point — Sprint 74 — independently of this document, and had built exactly the second, disconnected system this document warns against. Confirmed directly against both schemas, not inferred.)*

| | Floor Plans (this domain) | Seating (Sprint 74 — since retired) |
|---|---|---|
| Tables | `floor_plans` / `floor_plan_objects` | `couple_seating_arrangements` / `seating_tables` |
| Canvas | `room_width_ft` × `room_depth_ft` (configurable per plan; canvas units = inches, 12 per foot) | Fixed `canvas_width`/`canvas_height` = 1200×800, uniform across every arrangement |
| Table shape vocabulary | `display_shape` — round/square/rectangular/oval/cocktail plus Reception/Ceremony/Furniture shapes (this task) | `table_type` — round/rectangular/head/sweetheart/cocktail |
| Position fields | `x`, `y` (center, canvas units) | `position_x`, `position_y` |
| Owner | Venue (coordinator-authored, Booking Workspace) | Couple, in principle — but carried `venue_rw_*` RLS policies granting venue staff full read/write, the same "Client-Owned in name only" bug found and fixed on Guests |
| Guests | Not modeled here at all | `guest_seat_assignments` → `couple_guests` |

No foreign key, shared table, or code path connected them — exactly the "two unrelated facts about the same reception" problem this document was written to prevent, already realized once by the time Phase 1 traced it. Confirmed zero real rows existed in any of the three Sprint 74 tables before they were dropped — a correction, not data loss.

**What Phase 1 built instead** (matching §2's recommendation below exactly): tables are `floor_plan_objects` rows, read live off the one Floor Plan the venue shares via `floor_plans.client_access` (reserved since Client Identity Foundation, unbuilt until now); the couple's only new data is `guest_seat_assignments` (`guest_id`, `table_object_id`, both nullable-safe per §5.3 below) — Client-Owned, RLS enabled with zero policies, access only through SECURITY DEFINER portal RPCs. No second canvas, no second table vocabulary, no venue read/write over who-sits-where.

---

## 2. Relationship between Floor Plans and Seating

The two domains answer different questions about the same physical event:

- **Floor Plans answers "where does the furniture go."** It is the venue's operational layout tool: room dimensions, object placement, inventory sourcing, printing for setup crews. Its audience is staff.
- **Seating answers "who sits where."** It is the couple's own planning task: assigning named guests to specific tables. Its audience is the couple (and, per the companion doc's Ownership Model, explicitly not the venue by default).

These are not the same concern, and Seating should not be rebuilt as "Floor Plans with guest names on it." But they describe **the same room**, and today nothing guarantees they even agree on how many tables exist, where they are, or how many seats each one has.

**The relationship this document recommends:** Seating's *table inventory* (how many tables, of what shape, seating how many) should be **derived from a Floor Plan**, not independently authored. Where each *guest* sits within that table structure remains entirely Seating's own concern.

---

## 3. Ownership

Restating the companion doc's Ownership Matrix precisely for this pair:

- **Floor Plans: Venue-Owned.** The coordinator places tables, sets room dimensions, sources them from Inventory, prints the layout for staff. No client-facing surface exists (`floor_plans.client_access` is reserved and unbuilt, per the Wedding Workspace architecture doc).
- **Seating: Client-Owned.** The couple decides who sits where. No venue visibility exists today (per that doc's audit — though also unenforced at the RLS layer, the same finding as Guests and Budget).

**These ownership categories should not change.** The venue should not gain editing rights over who-sits-where, and the couple should not gain editing rights over the venue's operational table placement. What should change is that Seating's *starting point* — the set of tables available to assign guests to — comes from the venue's own Floor Plan rather than being invented a second time by the couple.

---

## 4. Shared data

Not "shared" in the sense of one table both systems write to — shared in the sense of **one fact that should have one source**:

| Fact | Source of truth | Consumed by |
|---|---|---|
| Room dimensions (width/depth) | Floor Plans (`room_width_ft`/`room_depth_ft`, this task) | Seating's canvas should render at the *same* proportions, not its own fixed 1200×800 |
| Which tables exist, their shape, their position | Floor Plans (`floor_plan_objects` where the object represents a table) | Seating's table list — read-only from Seating's side |
| Each table's seating capacity | Floor Plans (`floor_plan_objects.capacity`, or the sourcing Inventory item's own implied capacity) | Seating's per-table seat count |
| Who sits at a table | Seating only (`guest_seat_assignments`) | Nothing on the Floor Plans side needs this |
| Table label (e.g. "T1", "Sweetheart Table") | Floor Plans (`floor_plan_objects.label`) | Seating should display the same label the coordinator sees, not a re-typed copy |

The direction of sharing is one-way: **Floor Plans → Seating** for table structure. Nothing flows the other way — a coordinator should never see who's sitting where by editing the Floor Plan.

---

## 5. Synchronization rules

Since sharing is one-way and read-only from Seating's side, the rules are about **what happens when the Floor Plan changes after Seating has already assigned guests**:

1. **A table's position or shape changing** should never affect Seating — visually irrelevant to who's assigned there. Cosmetic Floor Plan edits should be silent to Seating.
2. **A table's capacity decreasing below its current assigned-guest count** is the one case that matters and needs a real rule — not "prevent the coordinator from resizing a table" (Floor Plans is Venue-Owned; the coordinator's editing should never be gated by Seating's state), but Seating should surface an "over-capacity" signal the same way this task's Inventory Usage panel does: informational, never blocking, on the Seating side.
3. **A table being deleted from the Floor Plan while guests are assigned to it in Seating** — **resolved by Phase 1 as (b).** `guest_seat_assignments.table_object_id` is `on delete set null`, not `on delete cascade` and not a blocking constraint: deleting a table from the Floor Plan editor is never gated by Seating's state (the coordinator's editing is never blocked by the couple's planning, matching every other Venue-Owned/Client-Owned boundary in the product), and the guest's seating *decision* survives — the assignment row remains, pointing at no table, surfaced to the couple as a distinct "needs a new table" bucket (`get_seating_data`'s `needsReassignment`), never silently dropped and never conflated with a guest who was simply never assigned in the first place.
4. **A brand-new table added to the Floor Plan** should simply become available in Seating the next time Seating reads the table list — no special handling needed.
5. **None of this is real-time sync.** Given the ownership split (coordinator and couple are different people, editing at different times, on different sides of the product), Seating reading the Floor Plan's current table list at the moment the couple opens Seating is sufficient — there is no case established here that requires a live, bidirectional, concurrent-editing channel.

---

## 6. Client collaboration

This is where Seating's Client-Owned status meets Floor Plans' Venue-Owned status most directly, and the companion doc's Collaboration Model vocabulary applies cleanly:

- **This is "Author / Editor-within-bounds," the same shape Timeline already uses** — not "Propose/Decide" and not full symmetric access. The venue authors the structure (which tables exist, their shape and capacity); the couple works *within* that structure (assigning guests to seats), the same way a couple edits specific Timeline rows the venue has opened for editing rather than the Timeline's own structure.
- **The couple should never be able to add, remove, resize, or reposition a table from within Seating.** Doing so would blur Floor Plans' Venue-Owned boundary — if guests want a different table arrangement, that is a conversation with the venue (arguably a natural fit for the **Request Framework**: an Approval- or Selection-type Request — "we'd like a different table configuration" — rather than the couple directly editing the venue's operational layout).
- **The couple's view of the room should visually match what the venue is actually setting up.** A Seating canvas that doesn't reflect the Floor Plan's real dimensions or table positions would let a couple plan a seating arrangement that doesn't correspond to the actual room — worse than no visual at all.

---

## 7. Inventory usage

Requirement 2 of this task built live, informational Inventory Usage reporting into the Floor Plan editor (Available / Used / Remaining per Inventory item, highlighted — never blocking — when usage exceeds availability). Two things follow for Seating:

1. **Seating should not introduce a second inventory-tracking concept.** A table placed in a Floor Plan already draws from Inventory (`floor_plan_objects.inventory_item_id`) and is already counted in that plan's usage. Seating assigning guests to that same table doesn't consume additional Inventory — chairs are the one place this could seem to double-count (a table "uses" one inventory row; each seat at it is arguably a Chair), and this document flags that as a design question for Seating's own planning, not something to resolve here.
2. **The "informational, never blocking" principle established in this task should extend to Seating.** If Seating is ever built to show capacity warnings (e.g., more guests assigned to a table than its capacity), it should follow the exact same pattern this task used for Inventory Usage: a visible highlight, never a hard stop. This keeps one consistent product stance — Wevenu surfaces problems, it doesn't lock coordinators or couples out of finishing their work — rather than Seating inventing a stricter enforcement model than Floor Plans uses for the same class of "you've committed more than you have" situation.

---

## 8. What this document is not

It was not a schema proposal, a migration plan, or an implementation sequence — it existed to make sure that whenever Seating was built, the person building it started from these six answered questions (relationship, ownership, shared data, sync rules, collaboration model, inventory stance) instead of re-deriving them from scratch or — worse — building a second Floor Plans by accident, which is exactly what had already happened once (§1).

**Seating Experience — Phase 1 is that implementation.** Every recommendation above held without needing to be revisited: Floor Plans → Seating stays one-way and read-only (§2, §4); ownership stayed split exactly as drawn (§3); the one open question (§5.3) resolved to option (b) with no other rule needing to change; the couple still cannot add, remove, resize, or reposition a table from within Seating (§6); capacity warnings are informational-only, matching Inventory Usage's own pattern (§7). What Phase 1 added beyond this document's scope: `is_wedding_party` on `couple_guests` (a seating-specific guest grouping this document never anticipated, since it predates Guest Experience's own household/child/vendor-meal vocabulary) and the couple-facing "Add Guests" / drag-to-seat interaction design, neither of which required touching Floor Plans.

---

*Phase 1 implemented: `supabase/migrations/20260828000000_seating_phase1.sql`, `components/portal/seating-section.tsx`, `components/events/floor-plan-workspace.tsx` (the venue's "Share for Seating" control).*
