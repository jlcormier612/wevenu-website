# Corrective — Inventory Included, Vendor Network inheritance, Questionnaires nav

**Verdict: GREEN** — SHA-matched Sandbox browser + DB proof on serving `a9bd5903`.

Production untouched. Unrelated dirty tree preserved.

## Product / deploy

| Item | Value |
| --- | --- |
| Product commit | `a9bd5903cf1baae14a72b0e2e0898d7b837c552d` |
| Deploy | [39727906815](https://github.com/jlcormier612/wevenu-website/actions/runs/39727906815) success |
| Serving proof | `dpl=` / harness `serving_sha` = `a9bd5903…` |
| Acceptance at | `2026-10-22T05:33+` (rerun after badge-assert fix) |

## Changes

1. **Inventory Overview badge** — `setupStatusBadgeLabel` maps Inventory `set_up` + `draft|included` → **Included**.
2. **Vendor recommendations** — seed-once from Vendor Network (preferred/recommended/standard + active/invited) into `event_vendor_recommendations` at booking inherit, page load, and Change editor. Exclude deletes event row only (no re-seed when rows exist). Event-only note edit. Assignments unchanged.
3. **Questionnaires** — removed from Overview Event Setup cards via `overviewSetupSteps`; top-level tab remains; nav order Inventory → Event Order → **Questionnaires** → Documents.

## Local tests

Focused suite (pre-deploy): **103 pass / 0 fail**.

## Browser / DB (GREEN)

```text
EXPECTED_SHA=a9bd5903cf1baae14a72b0e2e0898d7b837c552d \
  npx tsx scripts/qa/inventory-vendors-q-nav-acceptance.mts
→ inv-vend-q-results.json GREEN passed=15 failed=0
```

| Check | Result |
| --- | --- |
| serving_sha | `a9bd5903…` match |
| inventory_badge_included | badge=Included |
| questionnaires_absent_from_setup | setupCards=0 |
| questionnaires_nav_order | … Event Order → Questionnaires → Documents … |
| questionnaires_tab_opens | `#questionnaires` |
| vendors_inherited_full_list | eventRecs aligned with Network (5→4 after prior exclude; list present) |
| vendors_source_vs_event | covered matches event rows |
| vendors_exclude_event_only | exclude reduces event rows only |
| vendors_network_untouched | excluded vendor still active in Network |
| vendors_other_event_unchanged | other event recommendations unchanged |
| vendors_assignments_independent | assignments=2 |
| no_invoice_side_effect | 38→38 |

### Source vs event (fixture `5cd0be77…`)

Eligible Network vendors: **5**. After seed-once + one exclude from prior run: event recommendations **4**, covered **4/5**. Exclude removes one event row; Network preference unchanged (`preferred` / `recommended`).

### Evidence

- `docs/qa/booking-to-portal-simplification/inv-vend-q-results.json`
- `docs/qa/booking-to-portal-simplification/inv-vend-q-accept-rerun.log`
- `docs/qa/booking-to-portal-simplification/inv-vend-q-inventory-card-1280.png`
- `docs/qa/booking-to-portal-simplification/inv-vend-q-vendors-editor-1280.png`
- `docs/qa/booking-to-portal-simplification/inv-vend-q-overview-390.png`

## Isolation

- Invoice count unchanged (38→38).
- Production not deployed.
- Unrelated dirty/untracked work left in place.
