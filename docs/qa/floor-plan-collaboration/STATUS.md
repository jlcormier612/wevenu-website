# Floor Plan Collaboration — STATUS

**Verdict:** In progress (implementation landed; Sandbox deploy + migration + browser proof pending).

## Product model (locked)

Floor Plans are **Venue-Owned**. Couple collaboration on the room is:

1. Choose an offered layout → event working-copy clone
2. View the shared working layout (furniture placement is venue-authored)
3. Assign guests when venue **Share for Seating**
4. Venue **Mark as Ready** (checkpoint, not an immutability lock)

Couple furniture rearrange/add is **not** in architecture (`client_access='edit'` retired). See `docs/floor-plan-seating-architecture.md` and `docs/hello-to-cheers-starter-floor-plan-implementation.md`.

## Gap closed in this pass

After selection, the portal was a dead end (`shared_with_couple=false`). Selection now sets `shared_with_couple=true` while leaving seating (`client_access`) venue-explicit. Portal + venue workspace next-action copy updated.

## Evidence

- Unit: `lib/floor-plans/select-shares-layout.test.ts`, workspace nav tests
- Migration: `20261422100000_floor_plan_select_shares_layout_view.sql`
- Browser: `scripts/qa/floor-plan-collaboration-lifecycle.mts` + multi-offer harness updates
