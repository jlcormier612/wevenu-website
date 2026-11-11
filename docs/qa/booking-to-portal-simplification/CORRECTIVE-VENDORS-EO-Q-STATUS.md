# Corrective — Vendors + Event Order editors + Questionnaire UX

**Verdict: GREEN** — SHA-matched Sandbox browser + DB proof on serving `7df38cd8`.

Production untouched. Unrelated dirty tree preserved.

## Preflight / deploy

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `7df38cd86352efde1c2c9a1acec2e4208f9f4f31` |
| Deploy | [39724111632](https://github.com/jlcormier612/wevenu-website/actions/runs/39724111632) success |
| Serving proof | `dpl=` / harness `serving_sha` = `7df38cd86352efde1c2c9a1acec2e4208f9f4f31` |
| Acceptance at | `2026-10-22T05:02:14.442Z` |

## Why prior GREEN missed the defects

| Area | Prior GREEN assumed | Actual failure |
| --- | --- | --- |
| Vendors | Assignment-only Change editor was intentional; highlights on Vendors tab | Product now requires assignments **and** recommendations + replace in Change |
| Event Order | Unit seams + empty-template story | Incomplete shells with 1 included line were not healed; only empty (0-line) shells were |
| Questionnaire | `Template unavailable` tested as legitimate missing-id case | KindPanel did not remount per kind → stale UUID → false unavailable; preview opened `_blank` with no return |

## Root causes and fixes

### Vendors
- Change editor: list all assignments, remove, replace via selector, add assignment; list recommendations, add/remove without deleting Network records.
- No Open Vendors inside Change; no release/invite/invoice.

### Event Order
- `ensureEventOrder` heals when package has **more** offerings than the event (not only zero lines), using `packageStartingSelections` + dedupe.
- Setup editor always calls ensure on open so incomplete Day-of-only shells fill.

### Questionnaire
- `KindPanel` keyed by kind; initialize selection from draft template or sole eligible template.
- Select label never shows `Template unavailable` for stale/cross-kind values.
- Preview opens same-tab with **Back to Questionnaires** (`#questionnaires`).

## Local tests

```text
npx tsx --test \
  lib/event-setup/vendors-setup-editor.test.ts \
  lib/vendors/directory-vs-assignment.test.ts \
  lib/questionnaire-family/selector-availability.test.ts \
  lib/event-orders/event-order-completeness.test.ts \
  lib/event-setup/inventory-eo-setup-editor.test.ts \
  lib/floor-plans/ensure-working-layout.test.ts
→ 51 pass / 0 fail
```

## Browser / DB (GREEN)

```text
EXPECTED_SHA=7df38cd86352efde1c2c9a1acec2e4208f9f4f31 \
  npx tsx scripts/qa/corrective-vendors-eo-questionnaire-acceptance.mts
→ corrective-vendors-eo-q-results.json GREEN passed=16 failed=0
```

| Check | Result |
| --- | --- |
| serving_sha | `7df38cd8…` match |
| network_vendors | n=5 |
| fixture | event `9c200402…` / client `21d9fa35…` |
| eo_editor_line_count | uiLines=7 |
| eo_db_lines | dbLines=7 template `d73d9734…` |
| eo_d02_library_repaired_or_populated | before=7 after=7 |
| vendors_editor_open | open |
| vendors_recommendations_path | recommendations section |
| vendors_no_open_in_editor | no Open Vendors |
| vendors_db_assignments | assignments=3 |
| vendors_db_recommendations | recommendations=1 |
| questionnaire_no_false_unavailable | unavailableCount=0 |
| questionnaire_selector_shows_name | Client Planning Questionnaire |
| questionnaire_preview_back | same-tab preview URL with `from=event` |
| questionnaire_preview_return | `#questionnaires` on client |
| no_invoice_side_effect | before=38 after=38 |

### Evidence artifacts

- `docs/qa/booking-to-portal-simplification/corrective-vendors-eo-q-results.json`
- `docs/qa/booking-to-portal-simplification/corrective-accept-rerun3.log`
- `docs/qa/booking-to-portal-simplification/corrective-eo-editor-1280.png`
- `docs/qa/booking-to-portal-simplification/corrective-vendors-editor-1280.png`
- `docs/qa/booking-to-portal-simplification/corrective-questionnaire-selector-1280.png`
- `docs/qa/booking-to-portal-simplification/corrective-questionnaire-preview-1280.png`
- `docs/qa/booking-to-portal-simplification/corrective-editors-390.png`

## Isolation

- Invoice count unchanged (38→38).
- Production not deployed.
- Unrelated dirty/untracked work left in place.
