# Floor Plans v1.5 Phase 3 — Required setups + portal package view

## Verdict: **NOT GREEN** (implementation in progress)

## Authorization

PO clarified: venue-side setup organization + couple portal package view are one Phase 3 deliverable. Oct 26 gate remains authoritative (F1–F7 / C1–C9 locked).

## Preflight baseline

| Item | Value |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD at start | `aba92110b6d19b3bed62393e77632aa28899bf14` |
| Phase 1 tip | `e03e9aad…` (ancestor) |
| Phase 2 tip | `abc4bdab…` (ancestor) |
| Dirty/untracked | Preserved (~1179); no reset/stash/clean |
| Production | Untouched |

## Proposed domain model (before code)

### Tables

1. **`event_floor_plan_setups`** — explicit required-setup identity (venue-named; never inferred from layout/room/template names).
   - `id`, `venue_id`, `event_id`, `name`, `sort_order`
   - Per-setup Phase 2 fields: `couple_selected_floor_plan_id`, `couple_preference_status`, `couple_approved_floor_plan_id`, `operational_floor_plan_id`, `seating_in_use_floor_plan_id`
2. **`event_floor_plan_setup_members`** — setup ↔ event `floor_plans` association.
   - `setup_id`, `floor_plan_id` (unique), `sort_order`
   - A floor plan may belong to at most one setup (enforced).
   - Detach deletes membership only — never the layout or seats.

### Compatibility

- **Zero setups** → Phase 1/2 event-level pointers + whole-event offer chooser remain SoT (honest non-package path).
- **One or more setups** → setup rows are SoT for package view / per-setup preference & operational & seating-in-use. Event-level preference pointer is not used as multi-setup SoT.

### Portal

- Package mode: “Your wedding setups”; alternatives only under owning setup; preference ≠ approval.
- Select preference: RPC updates **only that setup’s** pending preference columns.

### Out of scope

Phase 4 flips, Phase 5 booking flags, name inference, Timeline, EO/catering.

## Gate (verbatim)

- Required setups coexist.
- Alternatives scoped to one setup.
- Portal: setups as one wedding plan; alternatives only within setup.
- Exit: no whole-event false chooser.
