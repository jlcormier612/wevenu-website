# Template-card action label audit — Phase 1

**Date:** 2026-10-28  
**Scope:** Library / reusable-template card primary actions  
**Prior fix:** Inventory starters (`lib/event-inventory/starter-edit-label.test.ts`) already use `LIBRARY_LABELS.edit`. Shared constant `LIBRARY_LABELS.editActivities` ("Edit activities") was left in place and still used by other families.

## Shared constant

| Key | Value | Role |
|---|---|---|
| `LIBRARY_LABELS.edit` | Edit | Canonical open-editor label |
| `LIBRARY_LABELS.customize` | Customize | Create venue-owned copy |
| `LIBRARY_LABELS.preview` | Preview | View without editing |
| `LIBRARY_LABELS.use*` | Use / Use Questionnaire / … | Apply to workflow |
| `LIBRARY_LABELS.sendToClient` | Send to client | Client share |
| `LIBRARY_LABELS.editDetails` | Edit details | Template metadata (name/space/type) — **not** card primary Edit |
| `LIBRARY_LABELS.editActivities` | Edit activities | **Inconsistent** starter card label; same destination as Edit |

## Inventory by family

| Family | Ownership | Displayed label | Action / destination | Behavior | Canonical | Status |
|---|---|---|---|---|---|---|
| Inventory templates | Starter | Customize + **Edit** | duplicate / `/library/inventory-templates/:id` | copy vs open editor | Customize + Edit | OK (prior fix) |
| Inventory templates | Venue-owned | Edit | `/library/inventory-templates/:id` | open editor | Edit | OK |
| Floor plan templates | Starter | Customize + **Edit activities** | duplicate / `/library/floor-plan-templates/:id` | copy vs open editor | Customize + Edit | **FIX** |
| Floor plan templates | Venue-owned | Edit | `/library/floor-plan-templates/:id` | open editor | Edit | OK |
| Event Order templates | Starter | Customize + **Edit activities** | duplicate / `/library/event-order-templates/:id` | copy vs open editor | Customize + Edit | **FIX** |
| Event Order templates | Venue-owned | Edit | `/library/event-order-templates/:id` | open editor | Edit | OK |
| Timeline templates | Starter | Customize + **Edit activities** | duplicate / `/library/timeline-templates/:id` | copy vs open editor | Customize + Edit | **FIX** |
| Timeline templates | Venue-owned | Edit | `/library/timeline-templates/:id` | open editor | Edit | OK |
| Planning (playbooks) | Starter | Customize + **Edit activities** | duplicate / `/library/playbooks/:id` | copy vs open editor | Customize + Edit | **FIX** |
| Planning (playbooks) | Venue-owned | Edit | `/library/playbooks/:id` | open editor | Edit | OK |
| Questionnaires | Starter | Customize + **Edit activities** | duplicate / `/library/questionnaire-templates/:id` | copy vs open editor | Customize + Edit | **FIX** |
| Questionnaires | Venue-owned | Edit | `/library/questionnaire-templates/:id` | open editor | Edit | OK |
| Contract templates | Starter | Customize (+ Preview + Use) | creates venue copy | no in-place Edit on card | Customize | OK (no Edit on starter by design) |
| Contract templates | Venue-owned | Edit | `/contracts/templates/:id/edit` | open editor | Edit | OK |
| Message templates | Starter | Customize (+ Preview) | creates venue copy | no in-place Edit on card | Customize | OK |
| Message templates | Venue-owned | Edit | `/communication/templates/:id/edit` | open editor | Edit | OK |
| Packages | All | Edit | `/packages/:id` | open editor | Edit | OK |
| Brochures | All | Edit | `/library/brochures/:id` | open editor | Edit | OK |
| Choices templates | All | Edit | `/library/choices-templates/:id` | open editor | Edit | OK |
| Pipeline templates | All | Edit | `/library/pipeline-templates/:id/edit` | open editor | Edit | OK |
| Available Inventory items | All | Edit | `/library/inventory/:id/edit` | catalog item edit | Edit | OK (not a template, consistent) |

## Why Inventory fix didn’t propagate

Inventory list was changed from `editActivities` → `edit` with a **family-local** regression test. The shared `LIBRARY_LABELS.editActivities` key and its usages in Floor / EO / Timeline / Playbooks / Questionnaires were not updated.

## Intentional exceptions

- **Edit details** (overflow / editor chrome): metadata-only; keep.
- **Customize** vs **Edit**: distinct — copy vs open editor; keep both on starter cards that already expose both.
- **Contracts / Messages starters**: Customize only (no card Edit) — different product rule; do not invent Edit.
- Timeline help prose mentioning “Edit activities” is instructional copy, not a card action label.

## Fix plan (Phase 2)

Replace `LIBRARY_LABELS.editActivities` with `LIBRARY_LABELS.edit` (and `emphasis: "edit"`) on starter primary actions in the five FIX rows. Remove unused `editActivities` from `labels.ts`. Expand regression guard across all template-card list/section files.
