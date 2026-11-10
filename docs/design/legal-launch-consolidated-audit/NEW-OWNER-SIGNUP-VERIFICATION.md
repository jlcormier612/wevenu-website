# HTC — New Venue Owner Signup: Final Sandbox End-to-End Verification

**Date:** 2026-11-10  
**Baseline legal cutover SHA:** `50b06551e33582381dc65a138000aa49fcbe57ff`  
**Deploy:** `42908589648` SUCCESS · **Migrations:** `42910425670` SUCCESS  
**Mode:** Disposable Sandbox + Stripe **Test** only  
**Companion UX audit:** [`../WHITE-GLOVE-ONBOARDING-LAUNCH-AUDIT.md`](../WHITE-GLOVE-ONBOARDING-LAUNCH-AUDIT.md)  
**Not done:** Production, Stripe config changes, code changes, commits/pushes/deploys, migrations, intake submit, deletions  
**Cleanup:** Test venue **retained** (intake not submitted)

---

## Final verdict

### **CONDITIONAL PASS — White Glove human Test checkout verified; Gather / Launch Yourself still open**

Human-completed Sandbox Checkout for **The Willow Grove** (intentional name) succeeded. Persisted Stripe + Postgres evidence shows:

**Celebrate (`growing`) + Weven 20% ($199.20) + White Glove ($399) = $598.20**, subscription **active**, Test mode only.

| Area | Verdict |
|---|---|
| Stripe Test payment + subscription | **PASS** |
| Webhook → single enrollment + venue provision | **PASS** (WG early provision by design) |
| No live/Production charge | **PASS** (`livemode: false`) |
| Welcome Back email | **PASS as designed** — from this signup’s `welcome_back=true` |
| Legal checkbox + finalized doc versions | **PASS** (`2026-09-23.2`) |
| Persisted `legal_acceptances` rows | **Deferred** until Welcome Home / activate |
| Owner `venue_staff` / dashboard | **Deferred by design** until HQ Finish |
| Gather founding $179.10 | **Not this session** — see plan discrepancy |
| Launch Yourself end-to-end | **Still open** |
| White Glove UX | **Local corrections done** — see companion audit; not deployed |

UX corrections are local-only (welcome/access copy, bring-business language, upload limits). Venue `fb4f41cc-5b1f-4131-9136-2e0d909a100c` retained. Demo Willow Grove `31f38b79-…` **unmodified**. No commit/deploy.

Evidence: `human-checkout-stripe-evidence.json`

---

## Plan discrepancy (human recollection vs records)

| Source | Plan / price |
|---|---|
| Human recollection | Gather + founding **$179.10**/mo + White Glove |
| Stripe session / line items | **Celebrate** $199.20 + White Glove $399 = **$598.20** |
| `saas_checkout_offers` | `plan_key=growing`, `applied_offer_type=weven_pct`, `weven_percent_off=20`, WG price id set, `offer_status=paid` |
| Enrollment | `plan=growing`, `onboarding_type=white_glove` |
| CRM `htc_crm_relationships` | `document.planName=Celebrate`, `planId=celebrate` |

**Source of truth for this verification: Stripe + Postgres.** Venue name “The Willow Grove” was intentional. Intake form showing that name is expected.

---

## A. Human checkout verification results

### Located purchase

| Field | Value |
|---|---|
| Checkout session | `cs_test_b0SSWiBFkpovWeWoOvzjYneT4YwmpUAOpG9pkfeFJ3jEEBiYYiY9CbAd0t` |
| Subscription | `sub_1UaNa8ErUqJH7nktgny2cTb1` |
| Customer | `cus_Vbal3RdUTzZhVk` |
| Email | `elliestjameshtc@yahoo.com` |
| Purchaser | Ellie St. James |
| Venue name | **The Willow Grove** (disposable; not the demo venue) |
| Enrollment id | `5ce9bcb1-3b8b-4634-ba73-704af423307e` |
| Venue id | `fb4f41cc-5b1f-4131-9136-2e0d909a100c` |
| Auth user id | `9f230fdc-8a8b-4877-8e44-fd031a590338` |
| CRM relationship | `rel_b6485860126a` (`white_glove_implementation`) |
| Paid at (approx) | 2026-11-10 ~22:32 UTC |

### Stripe facts (API — not inferred from redirect)

| Check | Result |
|---|---|
| `livemode` | **`false`** |
| Session `status` / `payment_status` | **`complete` / `paid`** |
| Subscription `status` | **`active`** |
| Plan | **Celebrate** (`growing`) list **$249.00** |
| Discount | **Weven 20%** → recurring **$199.20** |
| White Glove | **$399.00** |
| `amount_total` | **$598.20** |
| Onboarding | **`white_glove`** |
| Welcome Back | **`welcome_back=true`**, `weven_declared=true` |
| Legal | `legal_accepted=true`; VSA + Privacy IDs = active **`2026-09-23.2`** |

### Enrollment / venue / webhook

Re-queried Sandbox after payment (service role).

| Check | Result |
|---|---|
| Enrollment for session | **PASS** — one row |
| Duplicates (email / name / session) | **PASS** — single enrollment |
| Webhook idempotency design | `createVenueEnrollment` reuses by session/subscription | **PASS** |
| Status | **`provisioned`**, WG **`awaiting_intake`** |
| Tokens | `intake_token` present; `activation_token` **null** |
| `welcome_email_sent_at` | **2026-11-10T22:32:30.672Z** |
| Venue | Linked Stripe ids; `entitlement_status=active` |
| Setup hub / engagement | Created; engagement `not_started` |
| Owner staff | **[]** (deferred) |
| Intake / materials | **None** (user has not submitted) |
| Weven claim | `eb6e4513-…` **pending**, 20% applied |
| Demo venue `31f38b79-…` | **Unchanged** (`updated_at` 2026-11-07; no SaaS Stripe ids) |
| Ops `notification_log` | **[]** for this venue/email — confirm `INQUIRY_NOTIFY_EMAIL` |

### Legal acceptance

| Layer | Verdict |
|---|---|
| Checkout affirmative acceptance + finalized versions | **PASS** |
| `legal_acceptances` for purchaser | **Empty** — deferred for WG |

### Checklist (this White Glove run)

| # | Item | Result |
|---|---|---|
| 1 | Registration / checkout | **PASS** |
| 2 | Legal docs presented | **PASS** (`.2`) |
| 3 | Explicit acceptance | **PASS** |
| 4 | DB acceptance rows | **Deferred** |
| 5 | Stripe Test checkout | **PASS** |
| 6 | Subscription active | **PASS** |
| 7 | Webhook idempotent | **PASS** (single enrollment; reuse path) |
| 8 | Venue provisioned | **PASS** (WG early) |
| 9 | Owner membership | **Deferred** |
| 10 | Gather tier | **N/A** — Celebrate charged |
| 11–13 | Self-serve onboarding | **N/A** — WG intake |
| 14 | Repeat acceptance | **N/A** until activate |
| 15 | Isolation | Disposable ≠ demo; demo unmodified |

---

## B. Welcome Back email — root cause

**Caused by this signup** (Welcome Back checkbox), not an unrelated Willow Grove leftover.

1. Metadata `welcome_back=true`  
2. `sendEnrollmentProductEmails` → `white_glove_welcome` + `welcome_back`  
3. Subject pattern: *A quick note about your former Weven welcome — The Willow Grove*  
4. CRM `welcomeBackRequested=true` / pending verification + Weven claim row  

**New-subscription confirmation** also sent: `white_glove_welcome` (“subscription is confirmed”) plus Stripe’s receipt. Welcome Back is an additional clarification email, not a wrong template substitution.

---

## C. White Glove onboarding (summary)

Full audit: **`docs/design/WHITE-GLOVE-ONBOARDING-LAUNCH-AUDIT.md`**.

| Step | Behavior |
|---|---|
| After pay | Marketing success “You're in / Let's get your venue ready” |
| Continue | Token intake form (prefilled venue name) |
| Submit (not done yet) | Saves intake, status → `waiting`, CRM milestone, waiting page |
| Materials | Optional; add now or later; 25 MB / 40 files |
| Login | **Not** until HQ Finish / Welcome Home |

**Notable defect (copy):** intake welcome card says “Your account login is already set” — **false** for White Glove.

---

## D. Corrections status

| Item | Status |
|---|---|
| False “login already set” + consolidated welcome + warmer bring-business + upload limits | **Implemented locally** (not committed/deployed) |
| Confirm Sandbox/Prod **`INQUIRY_NOTIFY_EMAIL`** | **Still open** — read-only: unset locally; historically missing from marketing CFN; CRM queue exists |
| Legal acceptances at WG purchase | **Investigated** — intentional deferral to Activate; needs separate approval to change |
| Ops email on intake submit | **Not implemented** (needs approval) |
| Gather + Launch Yourself human proof | **Still open** |

Details: `docs/design/WHITE-GLOVE-ONBOARDING-LAUNCH-AUDIT.md`

---

## E. Remaining blockers

| ID | Item |
|---|---|
| R1 | Gather + Launch Yourself human path unverified |
| R2 | This disposable intake not yet submitted → waiting/HQ Finish/Welcome Home unverified live |
| R3 | Legal acceptances empty until activate |
| R4 | Ops notify delivery unproven for this purchase |
| R5 | Do not delete disposable venue until intake/handoff verification complete |

---

## F. Earlier automation note

Hosted Checkout card fields / hCaptcha blocked Playwright. Human Test payment superseded that blocker for this White Glove Celebrate purchase. Pre-payment legal/abandon gates remain historically PASS.

---

## G. Constraints confirmation

| Constraint | Honored |
|---|---|
| No code / commit / push / deploy / migrate | Yes |
| No Stripe configuration changes | Yes |
| No Production actions | Yes |
| No intake submit / no emails sent by audit | Yes |
| Test venue retained; demo Willow Grove untouched | Yes |
| Marketing dirty work preserved | Yes |
