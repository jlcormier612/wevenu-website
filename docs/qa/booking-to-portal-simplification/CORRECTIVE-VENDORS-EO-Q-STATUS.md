# Corrective — Vendors + Event Order editors + Questionnaire UX

**Verdict: NOT GREEN** — product committed; Sandbox deploy queued; browser+DB proof pending on serving SHA `7df38cd8`.

Production untouched. Unrelated dirty tree (~930 paths) preserved.

## Preflight

| Item | Value |
| --- | --- |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Product commit | `7df38cd86352efde1c2c9a1acec2e4208f9f4f31` |
| Prior HEAD | `88e083a8` (EO completeness + portal preview) |
| Serving at start | `cb25fb81…` (prior Floor GREEN) |
| Deploy (this fix) | [39724111632](https://github.com/jlcormier612/wevenu-website/actions/runs/39724111632) pending behind [39723617172](https://github.com/jlcormier612/wevenu-website/actions/runs/39723617172) |

## Why prior GREEN missed the defects

| Area | Prior GREEN assumed | Actual failure |
| --- | --- | --- |
| Vendors | Assignment-only Change editor was intentional; highlights on Vendors tab | Product now requires assignments **and** recommendations + replace in Change |
| Event Order | Unit seams + empty-template story | Incomplete shells with 1 included line were not healed; only empty (0-line) shells were |
| Questionnaire | `Template unavailable` tested as legitimate missing-id case | KindPanel did not remount per kind → stale UUID → false unavailable; preview opened `_blank` with no return |

## Root causes and fixes

### Vendors
- Change editor now: list all assignments, remove, replace via selector, add assignment; list recommendations, add/remove without deleting Network records.
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

## Browser / DB (pending serving SHA)

```text
EXPECTED_SHA=7df38cd86352efde1c2c9a1acec2e4208f9f4f31 \
  npx tsx scripts/qa/corrective-vendors-eo-questionnaire-acceptance.mts
```

Do not claim GREEN until SHA-matched browser + persistence proof lands.
