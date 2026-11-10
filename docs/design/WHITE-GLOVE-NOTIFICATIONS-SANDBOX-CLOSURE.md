# HTC — White Glove Notifications Sandbox Closure

**Date:** 2026-11-10  
**Commit SHA:** `4a3b512684ce619ded3456531338e1bb6c5783b6`  
**Deploy workflow:** [Deploy Sandbox #42923431146](https://github.com/jlcormier612/wevenu-website/actions/runs/42923431146)  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Environment:** Sandbox only  

---

## Final verdict

### **YELLOW — implementation + Resend delivery PASS; serving Sandbox deploy still in progress**

| Gate | Status |
|---|---|
| Local UX + notify implementation | **PASS** |
| Focused tests | **29/29 PASS** |
| Scoped commit (no CTA/footer/marketing dirty work) | **PASS** (`4a3b5126`) |
| Sandbox deploy dispatched | **IN PROGRESS** (run `42923431146`) |
| ECS `INQUIRY_NOTIFY_EMAIL` on marketing + venue | **Pending deploy complete** |
| Resend → `jennifer@hellotocheers.com` probes | **PASS — `last_event: delivered`** for both subscription- and intake-shaped probes |
| Human eyeball of Gmail UI | Not opened by agent (Resend delivered = receiving MTA accepted) |
| Serving Sandbox UX copy | **Pending deploy complete** |

**Why not GREEN yet:** Serving Sandbox must finish deploying SHA `4a3b5126` and ECS must show `INQUIRY_NOTIFY_EMAIL` on marketing + venue tasks.

**Why not RED:** Code, tests, commit, Resend delivery to the confirmed ops mailbox, and deploy dispatch all succeeded.

---

## 1. Exact files changed (commit `4a3b5126`)

### UX (already approved, deployed with this commit)
- `app/onboarding/white-glove/[token]/page.tsx`
- `components/onboarding/onboarding-intake-form.tsx`
- `components/onboarding/white-glove-intake-client.tsx`
- `components/onboarding/white-glove-waiting-client.tsx`
- `lib/onboarding/types.ts` (+ tests)
- `docs/qa/white-glove-intake-ux/verify-browser.mts`

### Notifications
- `shared/email/ops-notify.ts` (+ test)
- `shared/email/index.ts`
- `marketing/lib/crm/notify.ts` (+ test)
- `marketing/lib/crm/enrollment-summary.ts`
- `marketing/lib/crm/service.ts` (re-export + first-insert-only call preserved)
- `lib/onboarding/white-glove-ops-notify.ts` (+ test)
- `app/api/onboarding/white-glove/intake/route.ts`

### Sandbox configuration
- `infra/htc-ecs-stack.json` — `InquiryNotifyEmail` → `INQUIRY_NOTIFY_EMAIL` on **marketing** and **venue-app**
- `.github/workflows/deploy-sandbox.yml` — `InquiryNotifyEmail=jennifer@hellotocheers.com`

### Docs / evidence
- `docs/design/WHITE-GLOVE-ONBOARDING-LAUNCH-AUDIT.md`
- `docs/design/legal-launch-consolidated-audit/NEW-OWNER-SIGNUP-VERIFICATION.md`
- `docs/design/legal-launch-consolidated-audit/human-checkout-stripe-evidence.json`

**Excluded from commit:** homepage/Our Story CTAs, footer, unrelated marketing/settings/legal page dirty work, welcome-back template edits.

---

## 2. Notification configuration and recipient

| Item | Decision |
|---|---|
| Proposed `hello@hellotocheers.com` | **Not used** — CFN docs state it is not a real mailbox |
| Sandbox recipient | **`jennifer@hellotocheers.com`** (confirmed existing Sandbox ops address; matches From/Reply-To) |
| Env var | `INQUIRY_NOTIFY_EMAIL` |
| Transport | Existing `RESEND_API_KEY` secret on marketing + venue tasks |
| From identity | Unchanged (`Hello to Cheers <jennifer@hellotocheers.com>`) |

Missing `INQUIRY_NOTIFY_EMAIL` → skip/log (customer flows continue). Missing `RESEND_API_KEY` → simulated dry-run.

---

## 3. Subscription notification — trigger & idempotency

| Gate | Behavior |
|---|---|
| Trigger | `createVenueEnrollment` **only when `!existing`** after successful paid webhook enrollment |
| Abandoned Checkout | No enrollment → **no notify** |
| Webhook retry | Existing enrollment reused → **no second notify** |
| Resend key | `htc-ops-subscription:{checkoutSessionId\|enrollmentId}` |
| Content | Venue, purchaser name/email, tier, onboarding (LY vs WG), WG yes/no, discounts/claims, enrollment + Stripe refs, next action |
| Attachments | None |

---

## 4. Intake notification — trigger & idempotency

| Gate | Behavior |
|---|---|
| Trigger | After **successful** `submitOnboardingIntake` on WG intake POST |
| Failed persist | Notify not called |
| First submit only | `previousWhiteGloveStatus` not already in waiting/in_progress/… |
| Edit / retry | Skipped (`not_first_submit`) + Resend key `htc-ops-wg-intake:{enrollmentId}` |
| Content | Venue, customer email, existing-system choice, materials count (no files), HQ review URL `/admin/onboarding/{venueId}`, next action |
| Attachments | **None** (explicit) |

---

## 5. Test results

```text
npx tsx --test \
  shared/email/ops-notify.test.ts \
  lib/onboarding/white-glove-ops-notify.test.ts \
  marketing/lib/crm/notify.test.ts \
  lib/onboarding/types.test.ts \
  lib/onboarding/materials.test.ts \
  lib/onboarding/tasting-signal.test.ts
→ 29 pass / 0 fail
```

Covers: unset config skip, simulated send, first vs retry intake, no attachment leakage, subscription first-insert + idempotency wiring, UX regression strings.

Legal acceptance logic **unchanged**.

---

## 6. Deployment SHA and workflow

- **SHA:** `4a3b512684ce619ded3456531338e1bb6c5783b6`
- **Workflow:** `deploy-sandbox.yml` run **42923431146**
- **URL:** https://github.com/jlcormier612/wevenu-website/actions/runs/42923431146

---

## 7. Serving Sandbox verification

**Pending deploy completion.** After success, verify:

1. ECS marketing + venue task defs include `INQUIRY_NOTIFY_EMAIL=jennifer@hellotocheers.com`
2. Intake page copy (welcome / upload limits) on `app.sandbox.hellotocheers.com`
3. No customer emails/SMS from probes

---

## 8. Actual delivery evidence

### Controlled Resend probes (no Stripe, no customer intake)

| Probe | Resend id | Recipient | HTTP | last_event |
|---|---|---|---|---|
| Subscription-shaped | `01a1c7c9-c64c-7802-999b-54a3d589aa0f` | jennifer@hellotocheers.com | 200 | **`delivered`** |
| Intake-shaped | `01a1c7c9-c6cd-73e9-af3e-94e208662ae6` | jennifer@hellotocheers.com | 200 | **`delivered`** |

Subjects include `[SANDBOX PROBE]` and stamp `2026-11-10T23-27-31-762Z`. No customer documents attached. No Stripe charge.

---

## 9. Remaining blockers

1. Finish Sandbox deploy `42923431146` and confirm serving SHA / ECS env includes `INQUIRY_NOTIFY_EMAIL=jennifer@hellotocheers.com`.  
2. Optional visual confirm of the two `[SANDBOX PROBE]` messages in jennifer@ (Resend already reports `delivered`).  
3. Optional: live first-intake notify still not exercised on disposable Willow Grove enrollment (intake not submitted per instruction).  
4. Production: CFN default applies; production deploy workflow should pass `InquiryNotifyEmail` explicitly when Production is authorized.

---

## 10. Legal safety (unchanged)

Two-stage model preserved: Stripe metadata at checkout; `legal_acceptances` at Activate. No WG staff activation changes.

---

## Recommended follow-up (same chat or next)

1. Confirm deploy SUCCESS.  
2. `aws ecs describe-task-definition` for marketing + venue → assert `INQUIRY_NOTIFY_EMAIL`.  
3. Confirm jennifer@ inbox (or Resend `delivered`).  
4. Upgrade this report to **GREEN** when 1–3 pass.
