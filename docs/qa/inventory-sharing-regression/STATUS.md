# Inventory sharing / Select → Share — STATUS

**Verdict: ACCEPTED / GREEN**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty work:** preserved

---

## Serving commit (verified)

| Item | Value |
|---|---|
| Inventory fix (revalidate clients + optimistic Select) | `efb7d9c70172404942ed61f96bfd9f622860c8cc` |
| Share-enable follow-up (Select must not use `lifecyclePending`) | `89fd85e9587138825cf4212fea9f4119fc794385` |
| Deploy (efb7d9c7) | [40792339485](https://github.com/jlcormier612/wevenu-website/actions/runs/40792339485) — success |
| Deploy (89fd85e9 tip) | [40795606499](https://github.com/jlcormier612/wevenu-website/actions/runs/40795606499) — success |
| ECS image | `htc-sandbox-venue-app:89fd85e9587138825cf4212fea9f4119fc794385` |
| Ceremony `SuggestedCategoryKey` | Present on tip (`guided-setup.ts`); venue-app build green on this deploy |

---

## Root cause (two layers)

1. **Stale RSC props:** inventory actions revalidated only `/events/{id}` (redirect stub). UI lives on `/clients/{clientId}`. Fixed in `efb7d9c7`.
2. **Optimistic Select still left Share disabled:** Select used `runLifecycle` → `startTransition` → `lifecyclePending`, and Share is `disabled={lifecyclePending \|\| selectableCount === 0}`. Toggle showed “Selectable” while Share stayed disabled for the whole mutation. Fixed in `89fd85e9` (Select persists without `startLifecycle`).

Prior harness GREEN with DB fallback for Select was invalid.

Full write-up: [`SELECT-WORKFLOW-AUDIT.md`](./SELECT-WORKFLOW-AUDIT.md).

---

## Browser acceptance (real UI — no DB fallback for Select)

```bash
EXPECTED_SHA=89fd85e9587138825cf4212fea9f4119fc794385 \
  npx tsx docs/qa/inventory-sharing-regression/verify-select-workflow.mts
```

**Result: GREEN — 16 pass / 0 fail**

| Check | Result |
|---|---|
| Share disabled when nothing selectable | PASS |
| Select Dance Floor via UI | PASS |
| Share enables from UI alone (no DB write) | PASS |
| `client_selectable` persists | PASS |
| Reload keeps Select + Share enabled | PASS |
| Share for selection → `collaboration_mode=select` | PASS |
| Couple portal inventory (not invoice); draft+submit | PASS (`submitted`, qty=1) |
| Mobile 390 Share/Select controls | PASS |
| Disabled reason when cleared | PASS |

Evidence: `select-workflow-results.json`, `select-workflow-run.log`, `shots/select-workflow-*.png`.

---

## Ceremony / EO builder build

Deploy `40795606499` built venue-app successfully with Ceremony remaining a valid `SuggestedCategoryKey`. No Ceremony removal or typing weaken.

Production untouched.
