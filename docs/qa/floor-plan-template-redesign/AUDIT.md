# Floor-plan template redesign — audit

## Canonical source

| Item | Location |
| --- | --- |
| Masters | `lib/floor-plan-templates/starters.ts` → `FLOOR_PLAN_STARTER_MASTERS` |
| Provision | `lib/floor-plan-templates/provision.ts` → `provisionFloorPlanStarters` / `seedFloorPlanStarters` |
| Library ensure | `ensureFloorPlanStartersForCurrentVenue` on Library page load |
| Apply to event | `lib/floor-plans/service.ts` → `applyTemplate` (copies objects into a **new** `floor_plans` row) |

Masters are TypeScript fixtures. Venue Library rows are independent copies keyed by `source_master_key`. Provision **never** overwrites an existing key or same-named template.

## Pre-fix defaults

- **FP-01** — “Standard Wedding — Ceremony + Reception”: one canvas with Ceremony + Cocktail + Reception zones (the incorrect universal default).
- **FP-02** — “Standard Wedding — Reception Only”: reception-focused layout (already distinct).

Blank creation already existed via `FloorPlanTemplateStarterPicker` (“Blank”), separate from starters.

## Saved-plan data model

- **Multiple floor plans per event are supported** (`createFloorPlan`, `applyTemplate`, `duplicateFloorPlan`).
- Applying a template creates a new event plan; it does not mutate the Library template or other event plans.
- There is **no** phase/timeline/scene engine. One plan = one static object set.
- Client submit → venue review → approve / changes-requested / Mark as Ready are separate from template selection (preserved).

## Safe implementation approach

1. Stop provisioning the combined FP-01 as a default master (leave existing FP-01 venue copies intact as legacy).
2. Provision five masters: Ceremony (FP-03), Cocktail (FP-04), Reception (FP-02 renamed for new copies), Same-Room Flip (FP-SR), Blank (FP-05).
3. Same-room flip is a **static dual-reference** canvas with honest copy — not a timed transition.
4. Idempotent skip-by-key / skip-by-name; no mutation of customized templates or existing event plans.

## Constraint affecting design

Hello to Cheers cannot honestly claim time-based room flipping. The specialized starter must say so explicitly and remain a single static layout (venues may duplicate plans for before/after working copies).
