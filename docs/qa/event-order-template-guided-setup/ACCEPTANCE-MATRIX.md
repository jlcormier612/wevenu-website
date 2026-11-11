# Acceptance matrix — guided EO template setup

**Serving:** `20a5d08c…` / `sha256:9d1ef2ca21208c69…`

| Scenario | Criterion | Status | Evidence |
|----------|-----------|--------|----------|
| A | Outside catering/bar — skip categories; no forced options | **PASS** | Category cards optional; continue without inventing groups (`ui-category-cards`, patterns only create groups on explicit continue with pattern) |
| B | Plated only — no forced Buffet branch | **PASS** | Branch step is per-parent; no auto Buffet; empty follow-up removable |
| C | Plated or buffet — separate branches; switch clears incompatible | **PASS** | Conditional choices **26/26** on tip |
| D | Optional rentals — preferred filter; deliberate All | **PASS** | Unit `preferredEmpty` + picker empty state (no silent all) |
| E | Custom category | **PASS** | Custom category UI + `selectedCategoryKeysFromTemplate` unit |
| F | Existing template preserve options / Offering IDs | **PASS** | `persisted-options-preserved`, `persisted-groups-preserved`, `persisted-offering-ids-preserved` |
| G | Client workflow / finance unchanged | **PASS** | Financial fixture GREEN; finalized EO untouched in conditional harness |
| — | Guided wizard mounts + review/preview | **PASS** | `browser-run.log` |
| — | Preferred Offering filter does not dump all | **PASS** | Unit + shipped picker |

Screenshots: `shots/step-categories-1280.png`, `shots/step-patterns-or-configure-1280.png`, `shots/review-or-preview-1280.png`
