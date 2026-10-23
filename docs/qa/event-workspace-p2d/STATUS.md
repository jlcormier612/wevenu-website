# P2-D — Couple portal Documents-first Event Order

**STATUS: GREEN / COMPLETE** (Sandbox serving + browser verified)  
**Date:** 2026-10-23  
**Product commit:** `1939228ef0bea24873ba8e01851549d3298f1018`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40025380685 (success)  
**Serving image:** `htc-sandbox-venue-app:1939228ef0bea24873ba8e01851549d3298f1018`  
**Digest:** `sha256:d5138c99f999abbe1990ac611eb9d26845ef1882a4848340530d64b28ebe1cc3`  
**Production:** untouched  

## Scope (P2-D only)

- Choices nav only while couple must act (`sent` / `in_progress` / `changes_requested`)
- Inventory nav only for active client-facing statuses (not `finalized`)
- Event Order nav only while shared and acceptance still open
- Shared final Event Order in Documents (API merge + Documents card)
- Deep links `#choices` / `#event-order` / `#inventory` remain mountable
- No P2-C email / booking / commercial_proposals changes

## Units (local)

```text
npx tsx --test lib/portal/couple-nav-visibility.test.ts \
  lib/portal/couple-documents-event-order.test.ts \
  lib/portal/inventory-event-order-discoverability.test.ts \
  lib/events/workspace-tab-nav-p2a.test.ts \
  lib/events/event-order-journey-stage0.test.ts \
  lib/events/event-commercial-workflow-p2b.test.ts \
  lib/client-choices/couple-email.test.ts \
  lib/portal/couple-document-status.test.ts \
  lib/portal/workspace-routing.test.ts
→ 69/69 pass
```

## Live browser (`EXPECTED_SHA=1939228e…`)

```text
EXPECTED_SHA=1939228ef0bea24873ba8e01851549d3298f1018 \
  npx tsx docs/qa/event-workspace-p2d/verify-browser.mts
→ 20 pass / 0 fail
```

| Check | Result |
| --- | --- |
| Serving SHA + digest | PASS |
| Choices secure deep link `#choices` | PASS |
| Choices submit (persisted `submitted`) | PASS |
| Choices nav hidden after submit | PASS |
| Documents lists shared Event Order | PASS |
| Documents card opens `#event-order` | PASS |
| Draft EO not exposed | PASS |
| Legacy `#event-order` deep link | PASS |
| Order nav hidden when already agreed | PASS |
| Inventory nav while `shared` | PASS |
| Home Documents entry for shared+agreed EO | PASS |
| Booking status unchanged (`confirmed`) | PASS |
| Stage 0 venue journey intact | PASS |

Shots: `shots/choices-deep-link-1280.png`, `shots/choices-after-submit-1280.png`, `shots/documents-1280.png`, `shots/event-order-from-docs-1280.png`, `shots/couple-home-nav-1280.png`  
Persisted: `persisted-state.json`, `browser-results.json`

## Nav hide conditions

| Entry | Visible when |
| --- | --- |
| Choices | Client-editable request exists |
| Inventory | Present and status ∈ shared/submitted/changes_requested/confirmed |
| Event Order | Shared and `clientAgreedAt` is null |
| Documents EO card / home Docs entry | Shared final order (`get_event_order_for_portal`) |

## Deferred

- **P2-E** full release regression matrix
