# P2-C — Active proposed Event Order / Client Choices delivery

**STATUS: GREEN / COMPLETE** (Sandbox serving + browser verified)  
**Date:** 2026-10-23  
**Product commit:** `80d9984d5b0ccf407c2f512f6246bfdbd08d928f`  
*(includes `98eaf8ba` feature + PortalSession type fix)*  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40022350086 (success)  
**Prior failed deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40021300241 (typecheck; fixed)  
**Serving image:** `htc-sandbox-venue-app:80d9984d5b0ccf407c2f512f6246bfdbd08d928f`  
**Digest:** `sha256:8a20d09dce298e9a03b5e0ba08bc9dd1e7cc9dc11c3203ee9f03a2aaf5fed2ee`  
**Production:** untouched  

## Scope (P2-C only)

- ShareDialog primary CTA: Send / Resend selection request
- `sendClientChoices` portal availability + task, then `submitClientChoicesCoupleEmail`
- Truthful email submitted / not submitted; portal not rolled back on email failure
- Portal-only secondary CTA retained
- Preview does not send or mutate
- Stage 0 journey retained; not P2-D / P2-E

## Units

```text
npx tsx --test lib/client-choices/couple-email.test.ts \
  lib/events/event-order-journey-stage0.test.ts \
  lib/events/event-commercial-workflow-p2b.test.ts \
  lib/events/workspace-tab-nav-p2a.test.ts
→ 31/31 pass
```

## Live browser (`EXPECTED_SHA=80d9984d…`)

```text
EXPECTED_SHA=80d9984d5b0ccf407c2f512f6246bfdbd08d928f \
  npx tsx docs/qa/event-workspace-p2c/verify-browser.mts
→ 12 pass / 0 fail
```

| Check | Result |
| --- | --- |
| ShareDialog open from Send selection request | PASS |
| Portal status draft → sent | PASS |
| Activity `email_submitted` (+ `sent`) | PASS |
| Provider accept = submitted (not inbox delivery claim) | PASS |
| Preview no activity bump | PASS |
| Booking status unchanged | PASS (`confirmed`) |

Shots: `shots/share-dialog-1280.png`, `shots/after-send-1280.png`

## Email semantics

Sandbox provider path accepted the send (`email_submitted` activity). UI/toasts use **submitted** language; delivery is confirmed separately. Portal remains available if email fails.

## Deferred

- **P2-D** Documents-first couple nav  
- **P2-E** Full release regression  
- Conversation outbound row may be sparse in some fixtures; activity + provider path were verified  
