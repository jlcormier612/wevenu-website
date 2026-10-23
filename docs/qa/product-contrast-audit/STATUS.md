# Product contrast audit + event-assignment fixes

**STATUS: GREEN**

Production untouched. Unrelated dirty tree preserved.

## Serving proof

| Item | Value |
| --- | --- |
| Contrast fix commit | `79db74af822b5880838bf8d331ab075eb1012093` |
| Currently serving (ECS) | `76aa3be7a060fbc71367459a6f737896c7dc5bf5` (ancestor includes `79db74af`) |
| Task definition | `htc-sandbox-venue-app:881` |
| ECR image | `…/htc-sandbox-venue-app:76aa3be7a060fbc71367459a6f737896c7dc5bf5` |
| Deploy (contrast) | [39879000136](https://github.com/jlcormier612/wevenu-website/actions/runs/39879000136) — success @ `79db74af` |
| Deploy (serving now) | [39880136569](https://github.com/jlcormier612/wevenu-website/actions/runs/39880136569) — vendor-selection lifecycle on top of contrast |
| Migration (required exclude) | `20261422500000_submit_vendor_list_exclude_required.sql` — applied |

## Browser verification (`verify-assignment-panel.mts`)

**16/16 passed** against live Sandbox Fancy event `ebf74f77…` Vendors panel (not `/vendors` network).

| Check | Result |
| --- | --- |
| Cuppity assignment fee $500 | PASS |
| Cuppity `is_required` active | PASS |
| No pending couple removal on required | PASS |
| Fee not on Event Order lines (named) | PASS |
| **Venue cost $500** visible @ 1280 | PASS (`venueCost=1`) |
| Venue cost chip contrast | PASS **6.36:1** |
| Seeded Baker couple-removal banner | PASS |
| Dismiss request contrast | PASS **6.36:1** |
| Remove from event contrast | PASS **10.03:1** (black on dusty-rose) |
| Screenshots 1280 + 390 | PASS → `shots/event-vendors-*.png` |
| ECS serving SHA includes contrast ancestor | PASS |

## Root causes (closed)

1. Soft destructive white-on-amber under `.dark` → solid destructive + black foreground; outline on `bg-background`.
2. Bare `$500` → labeled **Venue cost** (venue→vendor coordination; not couple/EO charge).
3. `submit_vendor_list` invented couple withdrawals for required vendors → CTE excludes required; repair dismissed stale pending.

## Tests

```text
npx tsx --test \
  lib/theme/shared-contrast-regression.test.ts \
  lib/vendors/vendor-assignment-fee-and-removal.test.ts \
  lib/vendors/required-vendors.test.ts
```

Harness results: `docs/qa/product-contrast-audit/browser-results.json`
