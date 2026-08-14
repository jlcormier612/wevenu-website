# Stripe SaaS Subscription + Post-Payment Provisioning

**Status:** Implemented (System A only — Hello to Cheers SaaS).  
**Date:** 2026-08-13  
**Mode:** Stripe Sandbox / Test only.  
**Commit/push:** none (unless separately requested).

Related: prior inspection `docs/stripe-hello-to-cheers-phase1.md` (superseded for System A scope).

---

## Product boundary (HARD)

| In scope | Out of scope |
|---|---|
| Venue → Hello to Cheers SaaS subscription (HTC Stripe account) | Stripe Connect |
| Gather $149 + Founding $30/mo coupon → $119 | Couple / venue-customer money |
| Hosted Checkout + webhook + provision | `payment_line_items`, invoices, payment plans, Event Order, Final Payment |
| PATH A (marketing) + PATH B (CRM) → same durable state | CRM/auth redesign; plaintext passwords |

---

## A. Current architecture (reuse)

### System A — SaaS billing (this work)

| Piece | Location |
|---|---|
| Hosted Checkout | `marketing/app/api/stripe/checkout/route.ts` |
| Webhook (signature verified) | `marketing/app/api/stripe/webhook/route.ts` |
| Price + Founding coupon resolution | `marketing/lib/stripe/checkout-pricing.ts` |
| Stripe client | `marketing/lib/stripe/config.ts` |
| Enrollment + emails + product sync enqueue | `marketing/lib/crm/service.ts` |
| Relationship bridge | `marketing/lib/relationships/bridge.ts` |
| Founder eligibility | `marketing/lib/marketing/enrollment.ts` (`isAutomaticFoundingMember`) |
| Durable onboarding branch | `onboardingType`: `self_guided` \| `white_glove` |
| Post-purchase emails | `shared/email/enrollment.ts` |
| Product provision (idempotent) | `shared/product-sync/*` |
| CRM Path B | Workspace `send_subscription_link` → same `/api/stripe/checkout` |

### Journeys (converge)

**PATH A — Marketing**  
Pricing → onboarding selection (`onboarding_type`) → Checkout Session → webhook `checkout.session.completed` → `createVenueEnrollment` → Relationship + emails + product sync (self) or WG deferral.

**PATH B — CRM sales**  
Relationship Workspace → Send Subscription Link → same Checkout API (`relationship_id` + customer email) → same webhook → same enrollment / Relationship / emails / sync rules.

### Post-payment (durable field — not free text)

| `onboardingType` | Behavior |
|---|---|
| `self_guided` (Launch Yourself) | `enterOnboardingAfterPurchase` mints activation token → welcome/founder welcome with Activate Account → `enqueueProductSync` |
| `white_glove` | Account/relationship activated into `white_glove_implementation`, `accessDisabled=true`, **no** activation token / product sync until HQ **Launch Workspace** → then sync + `welcome_home` |

### Founding eligibility (existing — not invented)

```text
FOUNDER_PROGRAM_ACTIVE && founderSpotsRemaining > 0
  → isFounderPricingActive / isAutomaticFoundingMember
```

Welcome Back is self-identified at checkout; CRM verifies later — does **not** gate the discount at purchase.

### Communications

- Product emails: `@shared/email` from webhook enrollment path (not duplicated CRM customer sends).
- Ops notify: `INQUIRY_NOTIFY_EMAIL` via `notifySubscriptionEnrollment` (internal only).

---

## B. Gap analysis (closed in this pass)

| Gap | Fix |
|---|---|
| Gather used separate Founder Price IDs ($119) | Canonical Gather Price + `discounts: [{ coupon }]` when founding |
| No `STRIPE_GATHER_PRICE_ID` / founding coupon env | Wired with aliases (see §E) |
| Unpaid checkout could still enroll | `shouldProvisionFromCheckoutSession` gate before provision |
| Webhook retry could duplicate enrollment emails | Idempotent `createVenueEnrollment` by Checkout Session / Subscription id |

**Not changed:** Connect, venue financials, user guides, Celebrate/Flourish founder Price ID model (Gather coupon only).

---

## C. Smallest implementation (done)

1. `resolveCheckoutPricing("starter", { founder })` → Gather $149 + founding coupon when eligible.
2. Checkout Session: apply coupon **or** `allow_promotion_codes` (never both — Stripe rule).
3. Webhook: verify signature → gate on paid/active → idempotent enrollment → existing self vs WG branch.
4. Focused unit tests for pricing + payment gate.
5. Document Dashboard + env **names** only.

---

## D. Required Stripe Dashboard config (manual — Test mode)

1. **Hello to Cheers** Stripe account (not QuickCloud / not Connect platform for couples).
2. Product **Gather** → recurring Price **$149/month** → copy Price ID.
3. Coupon **$30/month off** (duration: forever or as product policy) → copy Coupon ID.  
   Target: $149 − $30 = **$119/mo** while Founding.
4. (Optional) White Glove one-time Price for add-on line item.
5. Webhook endpoint → marketing host `/api/stripe/webhook`  
   Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.
6. Customer portal enabled for dunning / reactivation links.

---

## E. Required env var NAMES only

| Name | Role |
|---|---|
| `STRIPE_SECRET_KEY` | HTC SaaS secret (Test) |
| `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable (Test) |
| `STRIPE_WEBHOOK_SECRET` | Marketing SaaS webhook signing secret |
| `STRIPE_GATHER_PRICE_ID` or `GATHER_PRICE_ID` or `STRIPE_PRICE_STARTER` | Gather $149 Price |
| `STRIPE_FOUNDING_COUPON_ID` or `FOUNDING_MEMBER_COUPON_ID` | $30/mo Founding coupon |
| `STRIPE_PRICE_GROWING` / `PROFESSIONAL` (+ `_FOUNDER`) | Celebrate / Flourish |
| `STRIPE_PRICE_STARTER_FOUNDER` | Legacy Gather fallback if coupon unset |
| `STRIPE_PRICE_WHITE_GLOVE` | Optional WG add-on |
| `FOUNDER_PROGRAM_ACTIVE` / `FOUNDER_PROGRAM_CAPACITY` / `FOUNDER_SPOTS_REMAINING` | Eligibility |
| `RESEND_API_KEY` / `EMAIL_FROM` / `INQUIRY_NOTIFY_EMAIL` | Emails |
| `PRODUCT_API_BASE_URL` / `PRODUCT_SYNC_API_KEY` | Real product sync (optional locally) |

Never commit `.env.local` or live secrets.

---

## F. Files changed

| File | Change |
|---|---|
| `marketing/lib/stripe/checkout-pricing.ts` | **New** — Gather price + coupon + payment gate |
| `marketing/lib/stripe/checkout-pricing.test.ts` | **New** — focused tests |
| `marketing/lib/stripe/config.ts` | Export resolution helpers |
| `marketing/app/api/stripe/checkout/route.ts` | Apply coupon / pricing metadata |
| `marketing/app/api/stripe/webhook/route.ts` | Skip provision when unpaid / incomplete |
| `marketing/lib/crm/store.ts` | Find enrollment by session / subscription |
| `marketing/lib/crm/service.ts` | Idempotent create |
| `marketing/.env.example` | Document Gather + coupon names |
| `docs/stripe-saas-subscription-provisioning.md` | This report |
| `docs/stripe-hello-to-cheers-phase1.md` | Point to implemented System A |

---

## Acceptance matrix

| # | Check | Status |
|---|---|---|
| 1 | Gather Checkout uses canonical $149 Price env | Code ✓ (needs Dashboard Price) |
| 2 | Founding applies coupon → $119, not separate Price | Code ✓ when coupon env set |
| 3 | Non-founding → no founding coupon | Code ✓ |
| 4 | PATH A and PATH B share Checkout + webhook state | Already true; unchanged |
| 5 | Self-guided → activation + welcome + sync | Already true |
| 6 | White Glove → no premature access; Launch Workspace unlocks | Already true |
| 7 | Failed/unpaid payment does not activate | Code ✓ |
| 8 | Webhook signature required | Already true |
| 9 | Idempotent enrollment (no duplicate emails on retry) | Code ✓ |
| 10 | No Connect / payment_line_items touched | Confirmed |
| 11 | Sandbox end-to-end with real keys | **Manual** — local secrets unset |

---

## Test results

```text
npx tsx --tsconfig tsconfig.json --test lib/stripe/checkout-pricing.test.ts
(from marketing/) → 11 passed, 0 failed
```

---

## Remaining manual / limitations

- Populate marketing `.env.local` with HTC **test** keys, Gather Price ID, Founding Coupon ID, webhook secret (Stripe CLI or Dashboard).
- Live Checkout + webhook smoke in Sandbox once secrets exist.
- Celebrate/Flourish still use Founder **Price IDs** (not the Gather $30 coupon).
- Enrollment store remains JSONL (idempotent by Stripe ids); Relationship store already dedupes by email / Stripe ids.
- Product sync to real Supabase venue requires `PRODUCT_API_*` when not simulated.

---

## Explicit non-goals preserved

- No Stripe Connect changes  
- No venue financial architecture changes  
- No plaintext passwords  
- No commits unless requested  
