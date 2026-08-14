# HTC Stripe Sandbox E2E — Subscription Acceptance

**Date:** 2026-08-13  
**Mode:** Stripe Test / Sandbox only  
**Scope:** System A SaaS (venue → Hello to Cheers). No Connect. No commits.  
**Evidence dir:** `docs/qa/stripe-saas-sandbox-e2e/`

---

## Verdict

**Self-setup Gather + FOUNDING100 path: PASS end-to-end** (checkout → paid → webhook 200 → enrollment → welcome dry-run → simulated product sync).

**White Glove live checkout: FAIL** — `STRIPE_PRICE_WHITE_GLOVE` missing (expected optional gap).

**Ready for a real self-setup journey?** **Yes, with remaining manual steps below** (Resend, WG price if needed, live webhook endpoint, human Checkout smoke once).

---

## PASS / FAIL by step

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Test keys present (`sk_test_` / `pk_test_`) | **PASS** | `secret=sk_test_…OiTI` `pub=pk_test_…3ucd` |
| 2 | HTC sandbox account | **PASS** | `acct_1U4226ErUqJH7nkt` — Hello to Cheers sandbox |
| 3 | Gather Price $149 matches API | **PASS** | `price_1U42LNErUqJH7nktdpRin9ev` `unit_amount=14900` |
| 4 | FOUNDING100 coupon $30 matches API | **PASS** | coupon id `FOUNDING100` `amount_off=3000` |
| 5 | Founder program env active | **PASS** | `FOUNDER_PROGRAM_ACTIVE=true` spots=100 |
| 6 | Marketing `:3001` up | **PASS** | `GET /pricing` 200 |
| 7 | `stripe listen` → `/api/stripe/webhook` | **PASS** | CLI Ready; forwards with `[200]`; `whsec_…b0d1` matches `.env.local` |
| 8 | Self-guided Checkout Session create | **PASS** | `founding_member=true` `pricing_mode=gather_founding_coupon` |
| 9 | Session uses Gather price + founding coupon | **PASS** | line price Gather; Checkout UI $149 − $30 = **$119** (`01-checkout-open.png`, `pay-02-filled.png`) |
| 10 | Sandbox card payment completes | **PASS** | session `cs_test_a1F8wQT69DUIWHS68gqKSdCU6LNi3GVUEvD920iUsk6FbKMvcx6tVIbZ2K` → `complete` / `paid` / `amount_total=11900` |
| 11 | Success page | **PASS** | `GET /pricing/success?session_id=…` 200 — `04-success.png` |
| 12 | `checkout.session.completed` webhook **200** | **PASS** | Stripe CLI `[200] POST …/webhook`; marketing log `checkout.session.completed → venue enrollment` |
| 13 | Provision / enrollment (self_guided) | **PASS** | enrollment `180bbf2e-…` onboarding=`self_guided` founding=`true` payment=`successful` sub=`sub_1U47o5ErUqJH7nktQWT1iXdb` |
| 14 | Welcome / founder email path | **PASS** (dry-run) | timeline `email_sent` — Founder Welcome Email Sent; log `[email] dry-run (RESEND_API_KEY not set)` |
| 15 | Product sync (self) | **PASS** (simulated) | timeline Venue/Workspace/Website/Subscription/Owner/Onboarding/Launch provisioned → Product Sync Completed |
| 16 | No Connect / no `payment_line_items` | **PASS** | SaaS path only (marketing checkout + webhook + CRM enrollment) |
| 17 | White Glove checkout live | **FAIL** | `STRIPE_PRICE_WHITE_GLOVE` **MISSING** → HTTP 503 |

---

## Failure points (this run)

1. **Prior blocker (fixed for this run):** Checkout Session create rejected `customer_creation` in `subscription` mode → removed invalid param in `marketing/app/api/stripe/checkout/route.ts` (bugfix only; not architecture).
2. **Stripe Tax Dashboard (configured in Test):** Head office address was missing; set via Tax Settings API (Austin TX test address). Gather Price needed `tax_behavior=exclusive` + product `tax_code=txcd_10103001`.
3. **White Glove:** `STRIPE_PRICE_WHITE_GLOVE` unset — WG add-on Checkout blocked (self-setup unaffected).
4. **Resend:** `RESEND_API_KEY` unset — emails dry-run by design (timeline still records `email_sent`).
5. **Enrollment `mrrCents=14900`:** stores list Gather $149; Stripe charged **$119** after FOUNDING100 (coupon applied at Checkout). Worth noting for ops reporting; not a payment failure.
6. **Playwright automation fragility:** Hosted Checkout address autocomplete / submit timing needed careful `.SubmitButton` click; human Checkout is reliable.

---

## Verified (masked)

| Item | Value (masked) |
|---|---|
| Account | `acct_1U4226…` Hello to Cheers sandbox |
| Gather Price | `price_…Rin9ev` $149 |
| Coupon | `FOUNDING100` −$30 |
| Paid session | `cs_test_a1F8…IbZ2K` |
| Subscription | `sub_1U47o5…iXdb` |
| Customer | `cus_V4GKep…` |
| Amount | **11900** USD ($119) |
| Enrollment | `180bbf2e-…` self_guided / founding |
| Relationship timeline | `rel_544d6ac47781` — founder welcome + product sync completed |
| Webhook secret | `whsec_…b0d1` (CLI ↔ `.env.local`) |

### Env present (names only)

**SET:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_GATHER_PRICE_ID`, `STRIPE_PRICE_STARTER`, `STRIPE_FOUNDING_COUPON_ID`, `FOUNDER_PROGRAM_ACTIVE`, `FOUNDER_SPOTS_REMAINING`

**MISSING / empty (non-blocking for self-setup sandbox):** `STRIPE_PRICE_WHITE_GLOVE`, `RESEND_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_EMAIL`, `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY`, `FOUNDER_PROGRAM_CAPACITY`, `NEXT_PUBLIC_MARKETING_URL`

---

## Evidence labels

| Label | File / location |
|---|---|
| Checkout open ($119 + founding discount) | `docs/qa/stripe-saas-sandbox-e2e/01-checkout-open.png` |
| Card + billing filled | `docs/qa/stripe-saas-sandbox-e2e/pay-02-filled.png` / `diag-dom.json` |
| After pay / processing | `docs/qa/stripe-saas-sandbox-e2e/03-after-pay.png` |
| Success / welcome UI | `docs/qa/stripe-saas-sandbox-e2e/04-success.png` |
| Machine results (earlier smoke) | `docs/qa/stripe-saas-sandbox-e2e/results.json` |
| Enrollment store | `marketing/.data/venue-enrollments.jsonl` |
| Timeline | `shared/relationships/.data/timeline-events.jsonl` |
| Stripe CLI forwards | terminal stripe listen log — `[200] POST http://localhost:3001/api/stripe/webhook` |
| Marketing provision log | `checkout.session.completed → venue enrollment` + `[email] dry-run` |

---

## Remaining manual steps

1. Create Stripe Test **White Glove** one-time Price → set `STRIPE_PRICE_WHITE_GLOVE` if WG path must be acceptance-tested.
2. Set `RESEND_API_KEY` (+ `EMAIL_FROM` / `INQUIRY_NOTIFY_EMAIL`) for real welcome + ops notify (not dry-run).
3. Optional: wire `PRODUCT_API_*` to real product app instead of local simulated sync.
4. Dashboard: confirm Tax head office / price tax behavior remain correct for this Test account (already set this session).
5. Before production: Dashboard webhook endpoint (not only CLI), live keys rotation, Customer Portal branding, one human self-setup purchase in Test then Live.
6. Optional cleanup: cancel sandbox subscription `sub_1U47o5…` if not needed.

---

## Ready for real self-setup journey?

**YES — sandbox self-setup is proven.**

A real buyer can: Pricing → Launch Yourself → Checkout (Gather $149 + FOUNDING100 → $119) → pay → webhook provisions enrollment + founder welcome + product sync branch.

Blockers for *production* readiness (not sandbox E2E): live keys, hosted webhook, Resend, and ops notification emails. WG is separate and still needs a Price ID.
