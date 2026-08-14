# Stripe — Hello to Cheers Phase 1 Inspection Report

**Status:** SUPERSEDED for SaaS scope — see **`docs/stripe-saas-subscription-provisioning.md`**.  
**Date:** 2026-08-13 (inspection); implementation follow-up same day.  
**Mode:** Stripe Sandbox / Test only.  
**Commit/push:** none (as directed).

---

## Verdict (updated)

**Phase 1 target = System A only** (Hello to Cheers SaaS subscription + post-payment provisioning) was confirmed by product boundary:

- Stripe ONLY for venue → HTC SaaS subscription  
- DO NOT build Connect / couple money / venue financial architecture  

Prior blockers:

| Blocker | Resolution |
|---|---|
| A vs B system ambiguity | **A only** (HARD) |
| Founding eligibility | Reuse `isAutomaticFoundingMember` (exists) |
| Self vs white-glove | Durable `onboardingType` (exists) |
| Gather $149 + $30 coupon | Implemented in marketing Checkout |
| Communications fork | Product emails via `@shared/email`; CRM notify is ops-only — not a fork |

**System B (Connect / `payment_line_items`) was not modified.**

---

## Implementation pointer

Full architecture reuse, gap closure, Dashboard steps, env **names**, files changed, tests, and acceptance matrix:

→ [`docs/stripe-saas-subscription-provisioning.md`](./stripe-saas-subscription-provisioning.md)

---

## Historical inspection summary (kept for context)

Hello to Cheers has **two** Stripe systems:

- **System A** — SaaS (venues pay HTC): `marketing/app/api/stripe/*`  
- **System B** — Connect (couples pay venues): `app/api/webhooks/stripe-connect`, `lib/stripe/*`, `payment_line_items`

This Phase 1 work touches **System A only**.

### Founding (inspected — not invented)

```text
FOUNDER_PROGRAM_ACTIVE && founderSpotsRemaining > 0
  → automatic Founding Member + Gather coupon (now) / legacy Founder Price fallback
```

### Post-payment (already durable)

- `self_guided` → activation + welcome + product sync  
- `white_glove` → setup pending / access deferred until Launch Workspace  

### PATH A / PATH B

Both already call the same marketing Checkout API and the same webhook enrollment path.
