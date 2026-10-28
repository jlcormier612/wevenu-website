# Floor Plans v1.5 — Phase 5 Decision Lock

**Status:** Product decisions **LOCKED** · Implementation **not authorized**  
**Workstream:** Floor Plans v1.5 Phase 5 only (booking-change review flags)  
**Recorded:** 2026-10-27  
**Branch at record:** `feat/spaces-booking-e1-smart-fields` @ `f44f6299fa3afefec96c679a7c3f42e678abd763`  
**Phase 4 baseline (closed GREEN):** `be71bf3baf0416c0be060bc81d5fdd58b1737d4a`  
**Prior readiness audit:** BLOCKED pending D-TRIG-SET / D-T1-SOURCE / D-T2-REL / D-T3-RECORD / D-CLEAR-UX / D-SCOPE-CAP — those decisions are supplied and locked here.

This file is the repository decision artifact for Phase 5. The October 26 Floor Plans v1.5 freeze (F1–F7 / C1–C9) was recorded in chat; Phases 1–4 acceptance lives under `docs/qa/floor-plans-phase{1–4}*/`. No prior Phase 5 decision file existed in-repo.

---

## 1. Frozen principles (unchanged)

| ID | Principle |
|---|---|
| **F5** | Review flags only on **explicit, verified** relationships. Never infer from names, labels, proximity, or heuristics. |
| **C7** | Venue must **explicitly review and clear**. Unrelated booking changes must not silently clear a flag. |
| **No silent mutation** | Creating or clearing a flag must not reassign or mutate layouts, seating, guests, sharing, preferences, setup membership, approvals, or operational state. |
| **C8** | Failed ops preserve prior state; retry safe; no partial seat rewrite or invalid partial flag state. |
| **C9** | Phase 5 needs its **own** implementation authorization. Phases 1–4 stay closed absent concrete regression evidence. |
| **Scope** | Phase 5 = **booking-change review flags only**. Seating/capacity hardening excluded. |

---

## 2. Locked product decisions

### D-TRIG-SET — Trigger set

**Include T1 and T3. Defer T2.**

| Trigger | In Phase 5? | Definition |
|---|---|---|
| **T1** | **Yes** | An explicit layout-to-room relationship becomes inconsistent because a relevant booking room assignment changes, **or** because the layout’s explicit room assignment changes. |
| **T3** | **Yes** | A linked before/after floor-plan flip no longer matches the **room relationship recorded when the flip was created**. |
| **T2** | **Deferred** | Setup-to-space assignment changes — **out of scope**. Do not add a setup-to-space relationship to enable T2. |

Do not add other trigger classes without a separate product decision.

### D-T1-SOURCE — Room relationship changes

A T1 flag may be created **only** where:

1. The system has an actual explicit, persisted **layout-to-room** relationship, **and**
2. A supported change makes that relationship **inconsistent**.

Two cases the implementation design must distinguish:

1. **Booking room assignment changes** → an explicitly linked layout’s room assignment becomes inconsistent with the booking.
2. **Layout room assignment changes** → the layout’s explicit relationship to the booking becomes inconsistent.

Do **not** flag layouts that lack the required explicit relationship. Do **not** infer from event names, room names, labels, proximity, or other indirect evidence.

Engineering must map these rules to actual persisted fields and supported mutation paths before implementation. If inconsistency cannot be determined unambiguously, report the exact gap — do not invent semantics.

### D-T2-REL — Setup-to-space (deferred)

- Do **not** add a setup-to-space schema relationship in Phase 5.
- Do **not** infer setup-to-space relationships.
- Do **not** create flags based solely on setup membership, setup labels, or assumed setup rooms.
- Existing Phase 3 setup behavior remains unchanged.

### D-T3-RECORD — Flip room-relationship snapshot

Use a **recorded room-relationship snapshot** on a linked before/after flip.

Purpose: preserve the room context against which the flip was created, so later changes are assessed against that context — **not** by silently reinterpreting history from only the linked layouts’ **current** `space_id` values.

- Snapshot fields must come from **actual, verified** room relationships available at flip creation.
- Do **not** invent missing room IDs or derive a relationship where none exists.
- A T3 flag must explain that the **recorded** room relationship no longer matches.
- A T3 flag must **not** automatically unlink the flip, change either layout, or modify transition notes.

If the existing flip model cannot represent the snapshot, the **minimum schema requirement** is an engineering detail for the implementation prompt (see §5) — not a change to this product decision.

### D-CLEAR-UX — Review and clearing

Support both review outcomes:

1. **Confirm** — venue inspects and determines the current layout/relationship remains correct.
2. **Update** — venue corrects the relevant relationship through the appropriate **existing** workflow.

After **either** outcome, the venue must take a separate, explicit **Clear review** action.

| Rule | Locked |
|---|---|
| Inspection alone clears? | **No** |
| Updating a relationship silently clears? | **No** |
| Clear mutates | **Only** review-flag state (+ record of explicit clear) |
| Clear must not mutate | layout, room assignment, flip, seating, guests, sharing, preferences, approval, setup membership, operational state |
| Later qualifying change | May require a **new** review; must not silently reopen/duplicate a cleared flag merely because a save is retried |

**Action label:** **“Clear review”**  
Accessibility / product-language check (read-only, 2026-10-27): no existing Floor Plans UI string conflict for “Clear review” found under `lib/floor-plans` / floor-plan workspace. Label stands unless a later conflict is documented.

### D-SCOPE-CAP — Scope

Phase 5 is **review flags only**.

**Explicitly exclude:** seating/capacity hardening; automatic layout or room reassignment; automatic guest/seat movement; new setup-to-space relationships; Timeline; Event Order / Offerings / Inventory / Packages / invoice-payment; Phase 6; Production deployment or data changes.

---

## 3. User-facing copy (default)

Recovered proposed default:

> The booked rooms for this wedding changed. Some layouts may no longer match. Review the flagged layouts and update the room or layout if needed.

UI requirements:

- Identify the **affected layout**.
- Explain the **actual reason** (explicit relationship + specific trigger T1 or T3).
- Do **not** present this copy as if every booking-room change affects every layout.

---

## 4. Trigger traceability (read-only architecture)

| Trigger | Explicit relationship (product) | Verified persisted fields today | Likely mutation paths | Status |
|---|---|---|---|---|
| **T1 case 1** — booking room change vs linked layout | Layout has explicit room; booking room assignment changes → inconsistency | Layout: `floor_plans.space_id` (nullable FK). Booking: `events.space_id` (legacy/primary); `event_space_assignments.space_id` via `replaceEventSpaceAssignments` | `lib/events/space-assignments.ts` → `replaceEventSpaceAssignments` (syncs primary `events.space_id`) | **Partial:** fields exist. **UNKNOWN:** exact “inconsistency” predicate when multi-assignment rows exist vs single `events.space_id`; which assignment(s) are “relevant” to a given layout. Must be designed without inference. |
| **T1 case 2** — layout room change vs booking | Layout’s explicit room changes → inconsistency with booking | `floor_plans.space_id` set on **create / apply template / duplicate** (`lib/floor-plans/repository.ts`) | **UNKNOWN / gap:** no verified post-create `space_id` update API in `lib/floor-plans` repository/service. Case 2 cannot fire until a supported layout-room mutation path exists (or engineering confirms another verified path). | **Product decision locked**; **engineering path incomplete** today. |
| **T1 — no relationship** | Layout `space_id` null | `floor_plans.space_id IS NULL` | N/A | **PASS (contract):** no flag |
| **T3** — flip vs recorded snapshot | Flip’s **recorded** room relationship vs current verified rooms | Phase 4 `event_floor_plan_flips`: `before_floor_plan_id`, `after_floor_plan_id`, `transition_notes` only. Room context today is **advisory** from live layout `space_id`s (`spaceIdsMismatch` warn; no block). **No snapshot columns on flip row.** | Flip create/update/unlink: `lib/floor-plans/flip-service.ts` | **Product decision locked.** **Schema gap:** snapshot fields must be added in Phase 5 implementation (minimal explicit columns — engineering). Existing flips without snapshot: engineering must define safe behavior (e.g. no T3 until relink/snapshot) without inventing room IDs. |
| **T2** | Setup↔space | Phase 3 `event_floor_plan_setups` has **no** `space_id` | — | **Deferred** — do not implement |

Sources: Phase 4 migration `supabase/migrations/20261425100000_floor_plans_phase4_linked_flips.sql`; Phase 3 setups migration (no space on setups); readiness audit 2026-10-27.

---

## 5. Engineering details still open (not product decisions)

These remain for the **separate** implementation authorization / design. They must not silently alter §2.

1. **Flag persistence model** — table/columns; open vs cleared; venue-scoped RLS.
2. **Cardinality** — per layout, per flip, per (layout × trigger), or other; open-flag unique key.
3. **T1 inconsistency predicate** — precise comparison of layout `space_id` to booking primary and/or assignment set (multi-space venues).
4. **T1 case 2 mutation path** — whether to add a supported layout `space_id` update, or limit v1 to booking-side changes only until that path exists (**product already locked both cases**; engineering must enable or escalate).
5. **T3 snapshot schema** — minimal fields (e.g. recorded before/after `space_id` nullable snapshots at link time); backfill policy for pre-Phase-5 flips.
6. **Hook points** — where to emit flags (space-assignment replace; layout space update if added; flip create snapshot write; post-change compare).
7. **Idempotency / lifecycle** — see §6 design contract (implementation detail within locked product rules).
8. **Audit fields** — who cleared, when, trigger reason codes.
9. **UI surface** — where flags appear on event floor-plan workspace; reason strings per T1/T3.
10. **Tests / harness** — browser + persisted-state acceptance from readiness audit, parameterized to T1+T3 only.

---

## 6. Flag lifecycle & idempotency contract (for implementation review)

**Product-locked rules** (must hold):

- Open flag → venue Confirm and/or Update via existing workflows → separate **Clear review** → cleared.
- Clear does not mutate operational/layout/flip/seating/share/preference/approval/setup state.
- Retry of the same qualifying change must not create incorrect duplicate **open** flags or silently reopen a **cleared** flag “because save retried.”
- A **new** qualifying change after clear **may** create a **new** open flag (fresh review required).
- Failure: preserve prior flag and layout/flip state (C8); no half-created invalid flag.

**Engineering choices (not locked as product):** exact unique key for an open flag; whether clear is soft-status vs tombstone; reason-code enum; whether re-open uses a new row id.

---

## 7. Deferred / excluded (verification checklist)

| Item | In this lock? |
|---|---|
| T2 setup-to-space | **No — deferred** |
| Capacity / seating hardening | **No — excluded** |
| Auto reassign layouts/rooms/guests/seats | **No — excluded** |
| Timeline / EO / Offerings / Inventory / Packages / invoice | **No — excluded** |
| Phase 6 | **No** |
| Production / migrate / deploy in this task | **No** |
| Implementation commit | **No** |

Phases 1–4 remain **GREEN/closed**. Offerings hierarchy GREEN on `f44f6299…` is a **separate** workstream — not part of this lock.

---

## 8. Consistency verdict

| Check | Result |
|---|---|
| F5 / C7 / C8 / C9 preserved | **Yes** |
| D-TRIG-SET = T1+T3, T2 deferred | **Yes** |
| D-T1-SOURCE two cases + no inference | **Yes** |
| D-T2-REL no schema / no inference | **Yes** |
| D-T3-RECORD snapshot (not live-only reinterpret) | **Yes** |
| D-CLEAR-UX confirm+update then explicit Clear review | **Yes** |
| D-SCOPE-CAP flags only | **Yes** |
| Accidental T2 / capacity / auto-mutation / EO scope | **None** |
| Engineering gaps documented without inventing product rules | **Yes** (T1 predicate, layout space update path, T3 snapshot columns) |

**Decision-lock status:** **Recorded and verified** in this file.  
**Ready for a separate Phase 5 implementation authorization** that must respect this lock and close the engineering gaps in §4–§5 without changing §2.

---

## 9. Next step

Phase 5 **implementation requires a separate explicit authorization** after product-owner acceptance of this decision contract. Do not begin implementation from this document alone.
