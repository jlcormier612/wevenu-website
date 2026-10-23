# P2-B — Event Order + Client Choices commercial composition

**STATUS: IN PROGRESS** (awaiting Sandbox serving + browser)  
**Date:** 2026-10-23  
**Production:** untouched  

## Scope (P2-B only)

- Compose venue Event Order + Client Choices into one continuous commercial workflow UI
- Staff preview of couple Choices view (same definition)
- Review submitted vs fixed lines; Create / Update Event Order CTA on existing finalize action
- **No** proposed-order email / ShareDialog delivery (**P2-C**)
- **No** P2-D / P2-E / questionnaire scheduling
- No new commercial engines, tables, or invoice systems

## What shipped (code)

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

## Deploy / browser

_Filled after Sandbox serving verification._
