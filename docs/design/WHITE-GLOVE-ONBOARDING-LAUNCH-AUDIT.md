# HTC — White Glove Onboarding Launch Audit

**Date:** 2026-11-10  
**Human test venue (disposable):** The Willow Grove · enrollment `5ce9bcb1-…` · product venue `fb4f41cc-…`  
**Demo venue (untouched):** The Willow Grove · `31f38b79-…`  
**Transaction (source of truth):** Celebrate + Weven 20% + White Glove = **$598.20** Stripe Test  
**This pass:** Approved local UX corrections + focused tests + read-only legal/ops investigations  
**Not done:** Commit, push, deploy, Production, Stripe config, legal persistence changes, env/notification config changes, emails, intake submit

Companion: `docs/design/legal-launch-consolidated-audit/NEW-OWNER-SIGNUP-VERIFICATION.md`  
Stripe evidence: `docs/design/legal-launch-consolidated-audit/human-checkout-stripe-evidence.json`

---

## Final readiness verdict

### **CONDITIONAL GO — UX polish implemented locally; ops notify + Gather/LY still open**

| Area | Status |
|---|---|
| Payment / enrollment / WG routing (prior verify) | **PASS** |
| Approved WG UX corrections (local) | **DONE** — tests **20/20 pass** |
| Legal acceptance architecture | **Intentional deferral** to activate; checkout metadata durable; see § Legal |
| Internal purchase email | **Likely not delivered** — `INQUIRY_NOTIFY_EMAIL` unset in local env; historically missing from marketing CFN; CRM queue still works |
| Gather + Launch Yourself human proof | **Open** |
| Deploy of UX fixes | **Not authorized this pass** |

---

## 1. Exact local UX changes

| File | Change |
|---|---|
| `app/onboarding/white-glove/[token]/page.tsx` | Single welcome card; correct access messaging; removed false “login already set” |
| `components/onboarding/onboarding-intake-form.tsx` | WG header shortened (no repeated White Glove pitch) |
| `lib/onboarding/types.ts` | Warmer HoneyBook / Tripleseat / other-system descriptions |
| `components/onboarding/white-glove-intake-client.tsx` | Upload limits from real constants; keep “add later” |
| `components/onboarding/white-glove-waiting-client.tsx` | Same limits + add-later clarity |
| `lib/onboarding/tasting-signal.test.ts` | Assert new welcome copy |
| `lib/onboarding/types.test.ts` | Assert warm / no-auto-migration copy |
| `lib/onboarding/materials.test.ts` | Assert limits wiring |
| `docs/qa/white-glove-intake-ux/verify-browser.mts` | Align browser expectations |

**Preserved:** fields, conditionals, validation, upload API, upsert submit, waiting routing, no wizard.

---

## 2. Before / after copy

### Welcome card (`wg-welcome-box`)

**Before**
- “Welcome to White Glove Setup!”
- Excited / details / “We'll take care of the setup from there.”
- “Your account login is already set. The contact information you provide below…”

**After**
- “Welcome to White Glove Setup”
- Excited; share details + materials; don’t need everything prepared; team builds workspace
- “You'll receive access to sign in once we've completed setup and activated your account. Venue phone and website below help us configure your space and reach you during setup.”

### Form H1 (WG mode)

**Before:** “Let's get your venue ready” + two paragraphs repeating White Glove pitch  
**After:** “Tell us about your venue” + one short line about decisions we can’t make for them

### Bring-business descriptions

| Choice | Before (essence) | After |
|---|---|---|
| HoneyBook | Note + supported export; “nothing imports automatically from this answer alone” | Note HoneyBook; help export what you want; “nothing moves over automatically” |
| Tripleseat | Same defensive pattern | Same warm pattern as HoneyBook |
| Another system | Note + guide export/review | “Tell us what you use; we'll help you gather the pieces that matter — nothing imports on its own.” |
| Starting fresh | Unchanged | Unchanged |

### Uploads

Near control (intake + waiting), from `WG_MATERIAL_MAX_BYTES` / `WG_MATERIAL_MAX_COUNT`:

> PDF, Word, Excel, PowerPoint, CSV, images, or ZIP · up to 25 MB each · up to 40 files

Plus existing “add more later from the waiting page” / waiting-page resume language.

---

## 3. Test results

```text
npx tsx --test lib/onboarding/types.test.ts lib/onboarding/materials.test.ts lib/onboarding/tasting-signal.test.ts
→ 20 pass / 0 fail
```

Coverage includes: welcome copy (no “login already set”), bring-business warmth / no auto-migration promise, upload-limit constants on intake + waiting, form WG header simplification, existing materials validation / waiting resume wiring.

**Not run this pass:** full browser E2E against Sandbox (needs deploy of local UX); live intake submit (forbidden).

**Unchanged by design:** Stripe enrollment, legal persistence logic, onboarding redirects/loops, Launch Yourself form mode.

---

## 4. Legal acceptance investigation (read-only)

### Where checkout acknowledgment is stored

| Store | What |
|---|---|
| Stripe Checkout session (+ subscription) metadata | `legal_accepted=true`, `legal_accepted_at`, `legal_accept_ip`, `legal_accept_ua`, `legal_tos_document_id`, `legal_privacy_document_id` |
| Session create path | `marketing/app/api/stripe/checkout/route.ts` loads **active** VSA + Privacy IDs at checkbox time |

For this purchase: IDs = active published **`2026-09-23.2`** (verified earlier).

### Durable `legal_acceptances` rows?

**Not written at WG checkout.** Purchaser `user_id` still has **[]** acceptances.

Durable append-only rows are written at **Activate Account** via:

1. Workspace form requires `legalAccepted` checkbox (`workspace/components/activate/activate-account-form.tsx`)  
2. `completeVenueActivateLegalViaProduct` → `POST /api/internal/legal/venue-activate`  
3. `recordVenueSubscriptionLegalAcceptances` → current **active** VSA + Privacy versions, method **“Venue Signup”**, keyed by resolved `user_id` (+ optional relationshipId)

Enrollment activate also requires `legalAccepted` (`app/api/internal/enrollment/activate/route.ts`) before password/venue staff handoff.

### Second affirmative acceptance?

**Yes — intentional.** Checkout collects consent for purchase; Activate / Welcome Home re-affirms and persists `legal_acceptances`.

### Architecture / compliance notes

- Matches existing split: marketing pricing consent in Stripe metadata; product gate + history in `legal_acceptances`.  
- **Audit-trail nuance:** activate records **currently active** versions, not the exact checkout document IDs. If versions change between purchase and activate, history reflects activate-time docs; checkout-time IDs remain in Stripe metadata.  
- **Gap (known, not changed this pass):** WG period between pay and activate has no `legal_acceptances` row — only Stripe metadata + enrollment. Proxy enforcement for owners typically begins after activate/login.

**Recommendation (needs separate approval):** optionally also persist checkout-time IDs at webhook, or pass checkout document IDs into activate writer — **do not implement without legal/product approval.**

---

## 5. Internal notification investigation (read-only)

### Purchase notification pipeline

1. Webhook → `createVenueEnrollment`  
2. On **first** insert only: `notifySubscriptionEnrollment` (`marketing/lib/crm/notify.ts`)  
3. Subject: **“New Hello to Cheers Subscription”**  
4. Recipient: `process.env.INQUIRY_NOTIFY_EMAIL`  
5. If unset → **console.info dry-run** (no email)

### Evidence for this human purchase

| Check | Result |
|---|---|
| Enrollment created once | Yes |
| Customer emails | `white_glove_welcome` + `welcome_back` (`welcome_email_sent_at` set) |
| `notification_log` for venue/email | **[]** |
| Local `.env.local` `INQUIRY_NOTIFY_EMAIL` | **UNSET** |
| Repo infra / CFN references | **No** `INQUIRY_NOTIFY` in `infra/`; contact hardening docs: **missing from marketing CFN task** |
| Example recipient | `marketing/.env.example` → `hello@hellotocheers.com` |

**Conclusion:** Code path exists; **successful ops email delivery for this Sandbox purchase is not evidenced** and is consistent with unset `INQUIRY_NOTIFY_EMAIL` (log-only). Did not change env or send test mail.

### Can the team identify WG purchases / pending intake?

| Channel | Adequate? |
|---|---|
| CRM `htc_crm_relationships` (`rel_b6485860126a`, status `white_glove_implementation`, Welcome Back pending, product venue linked) | **Yes** for purchase awareness |
| HQ White Glove operator panel + engagement row | **Yes** once operators look |
| Email push on purchase | **Unproven / likely off** without env |
| Email on intake submit | **No** — CRM milestone `wg_intake_submitted:{venueId}` only |

### Separate intake-submission notification?

**Helpful, not a substitute for purchase notify.** Recommend (separate approval): ops email when intake moves to `waiting`, using same `INQUIRY_NOTIFY_EMAIL` helper. CRM alone is workable if ops watches the board daily; easy to miss otherwise.

---

## 6. Remaining launch blockers

| ID | Blocker | Owner |
|---|---|---|
| B1 | Deploy local UX corrections to Sandbox (not authorized this pass) | Product/eng approval |
| B2 | Confirm/configure Sandbox (+ Prod) `INQUIRY_NOTIFY_EMAIL` on marketing task — separate infra approval | Ops/infra |
| B3 | Gather + Launch Yourself human Test proof still open | QA |
| B4 | Optional: legal persistence at WG purchase (needs explicit approval) | Legal/product |
| B5 | Optional: intake-submitted ops email | Product |

Non-blockers closed locally: false login copy, redundant intro, defensive migration language, missing upload limits UI.

---

## 7. Recommended next implementation steps (awaiting approval)

1. **Commit + Sandbox deploy** of the UX-only diff (exclude unrelated marketing dirty work).  
2. **Infra:** add `INQUIRY_NOTIFY_EMAIL` to Sandbox marketing task; prove one Test subscription notify lands.  
3. **Human:** Gather + Launch Yourself checkout; optionally submit this Willow Grove disposable intake after UX is live.  
4. **Separate PR (if approved):** intake-submitted ops notify; optional checkout-time `legal_acceptances` write.

---

## Appendix — Prior verification summary (unchanged facts)

- Stripe Test session `cs_test_b0SSWi…` complete/paid; sub `sub_1UaNa8…` active; `livemode: false`  
- Single enrollment; venue provisioned early for WG; staff deferred until Finish / Welcome Home  
- Welcome Back email caused by checkout checkbox — correct path  
- Demo Willow Grove unmodified  
- Intake not submitted on disposable venue  

---

## Constraints confirmation (this pass)

| Constraint | Honored |
|---|---|
| Scoped local UX only | Yes |
| No commit / push / deploy | Yes |
| No legal / notify config changes | Yes |
| No Stripe / Production / payments / new emails | Yes |
| Intake not submitted; venues retained | Yes |
| Unrelated marketing dirty work preserved | Yes |
