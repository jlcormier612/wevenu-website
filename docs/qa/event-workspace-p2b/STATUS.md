# P2-B — Event Order + Client Choices commercial composition

**STATUS: GREEN / COMPLETE** (Sandbox serving + browser verified)  
**Date:** 2026-10-23  
**Product commit:** `3472492e436ac4e1f6f1dda4ad84f819323b770e`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40002971099 (success)  
**Serving image:** `htc-sandbox-venue-app:3472492e436ac4e1f6f1dda4ad84f819323b770e`  
**Digest:** `sha256:ea33e301d88a28d8b5b88fa241186704043998a703553427603f6b4719a89d73`  
**Production:** untouched  

## Scope (P2-B only)

- Compose venue Event Order + Client Choices into one continuous commercial workflow UI
- Staff preview of couple Choices view (same definition)
- Review submitted vs fixed lines; Create / Update Event Order CTA on existing finalize action
- **No** proposed-order email / ShareDialog delivery (**P2-C**)
- **No** P2-D / P2-E / questionnaire scheduling
- No new commercial engines, tables, or invoice systems

## What shipped

| Surface | Result |
| --- | --- |
| `EventCommercialWorkflow` | Spine steps + strip + Choices + EO panels |
| Choices panel | Preview couple view; submission review; Create/Update CTA + confirm |
| Strip copy | Continuous path (not “separate workflows”) |
| Domain | Unchanged finalize / send / invoice actions |

## Deferred

- Active proposed-order email / ShareDialog → **P2-C**
- Couple Docs-first Inventory/Order nav → **P2-D**

## Units

```text
npx tsx --test lib/events/event-commercial-workflow-p2b.test.ts lib/events/workspace-tab-nav-p2a.test.ts
→ 16/16 pass
```

## Live browser (`EXPECTED_SHA=3472492e…`)

```text
EXPECTED_SHA=3472492e436ac4e1f6f1dda4ad84f819323b770e \
  npx tsx docs/qa/event-workspace-p2b/verify-browser.mts
→ 18 pass / 0 fail
```

| Check | Result |
| --- | --- |
| serving-sha | PASS (`3472492e…`) |
| workflow-mounted | PASS |
| spine-one-path-copy | PASS |
| steps build/awaiting/review/order/invoice | PASS |
| choices + order anchors | PASS |
| strip continuous / no “separate workflows” | PASS |
| preview dialog + definition view | PASS |
| booking-status-unchanged | PASS (`confirmed` → `confirmed`) |

Shots: `shots/event-order-workflow-1280.png`, `shots/choices-preview-1280.png`, `shots/event-order-panel-1280.png`  
Persisted: `persisted-state.json` (UI exercise did not mutate booking or apply finalize)
