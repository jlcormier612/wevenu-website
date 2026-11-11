# Stage 0 — Event Order UX composition

**STATUS: GREEN / COMPLETE** (Sandbox serving + browser verified)  
**Date:** 2026-10-23  
**Product commit:** `426cc8697cd89d81d5a05851e66e80da24411fbe`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40007830059 (success)  
**Serving image:** `htc-sandbox-venue-app:426cc8697cd89d81d5a05851e66e80da24411fbe`  
**Digest:** `sha256:099d92abd4bc7981600a61b950395c4ffe538db80c0ee5f47171c2d4cac7f451`  
**Production:** untouched  

## Scope (Stage 0 only)

- One Booking Details–style Event Order journey (replaced competing spine + strip)
- Stage panel emphasis; Inventory off commercial chrome (card/tab retained)
- One finance handoff (Choices FinancialImpact hidden when EO-linked invoice exists)
- Honest portal-only availability (“Make available in portal” / no email claim)
- **Not** P2-C / P2-D / P2-E

## Units

```text
npx tsx --test lib/events/event-order-journey-stage0.test.ts \
  lib/events/event-commercial-workflow-p2b.test.ts \
  lib/events/workspace-tab-nav-p2a.test.ts
→ 25/25 pass
```

## Live browser (`EXPECTED_SHA=426cc869…`)

```text
EXPECTED_SHA=426cc8697cd89d81d5a05851e66e80da24411fbe \
  npx tsx docs/qa/event-workspace-stage0/verify-browser.mts
→ 15 pass / 0 fail
```

| Check | Result |
| --- | --- |
| one-journey / no-spine / no-status-strip | PASS |
| no Inventory in journey chrome | PASS |
| 3 journey rows / one current / one primary | PASS |
| deep-link choices + order anchors | PASS |
| inventory workspace card preserved | PASS |
| booking-status-unchanged | PASS (`confirmed`) |

Shots: `shots/event-order-journey-1280.png`, `shots/event-order-stage-1280.png`, `shots/workspace-cards-1280.png`

## Remaining (not Stage 0)

- **P2-C** — ShareDialog + real proposed-selection email  
- **P2-D** — Documents-first couple nav  
- **P2-E** — Full release regression  
