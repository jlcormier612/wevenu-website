# HTC — White Glove Notifications Sandbox Closure

**Date:** 2026-11-10  
**Feature commit:** `4a3b512684ce619ded3456531338e1bb6c5783b6`  
**Build-fix commit (serving):** `44d472d4eebd1193a9d7ace1159a549bbded3394`  
**Failed deploy:** [42923431146](https://github.com/jlcormier612/wevenu-website/actions/runs/42923431146)  
**Successful deploy:** [42928030980](https://github.com/jlcormier612/wevenu-website/actions/runs/42928030980) **SUCCESS**  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Environment:** Sandbox only  

---

## Final verdict

### **GREEN — serving Sandbox verified for UX + notify configuration**

| Gate | Status |
|---|---|
| Local UX + notify implementation | **PASS** |
| Build root cause fixed (`RawSendResult` import) | **PASS** (`44d472d4`) |
| Focused tests | **29/29 PASS** |
| Workspace / marketing / venue `next build` | **PASS** (local preflight) |
| Deploy `42928030980` | **SUCCESS** |
| Serving images | **PASS** — marketing + venue on `44d472d4…` |
| ECS `INQUIRY_NOTIFY_EMAIL` | **PASS** — both services `jennifer@hellotocheers.com` |
| Serving White Glove UX copy | **PASS** (live intake URL) |
| Controlled Resend transport probes | **PASS — `delivered`** (not app HTTP path) |
| Live Stripe webhook / intake-submit notify retest | **Not re-run** (no new payment; user intake not submitted) |

Production, Stripe config, legal migrations, and unrelated marketing dirty work were not touched.

---

## Build root cause and repair

**Failure:** Deploy `42923431146` → job `Build & push (workspace)` → TypeScript  
`Module '"./client"' declares 'RawSendResult' locally, but it is not exported.`

**Cause:** `shared/email/ops-notify.ts` imported `type RawSendResult` from `./client`.  
`client.ts` only *imports* `RawSendResult` from `./types` for its return type; it does **not** re-export it.

**Fix (smallest):** import the type from the authoritative module:

```ts
import { sendRawEmail } from "./client";
import type { RawSendResult } from "./types";
```

No runtime email behavior change. Commit `44d472d4`.

---

## 1. Exact files changed

### Feature (`4a3b5126`) — UX + notify + CFN (prior)
See earlier sections / git show.

### Repair (`44d472d4`)
- `shared/email/ops-notify.ts` — type import fix  
- `marketing/lib/crm/notify.test.ts` — drop unsupported `/s` regex flag for older marketing `tsc` targets  

### Closure doc updates
- This file

---

## 2. Notification configuration and recipient

| Item | Value |
|---|---|
| Env | `INQUIRY_NOTIFY_EMAIL` |
| Sandbox recipient | **`jennifer@hellotocheers.com`** |
| Why not `hello@` | CFN documents hello@ as not a real mailbox |
| Marketing task | `htc-sandbox-marketing:1138` → image `…/htc-sandbox-marketing:44d472d4…` → **INQUIRY_NOTIFY_EMAIL=jennifer@hellotocheers.com** |
| Venue task | `htc-sandbox-venue-app:1164` → image `…/htc-sandbox-venue-app:44d472d4…` → **INQUIRY_NOTIFY_EMAIL=jennifer@hellotocheers.com** |
| Resend | Existing `RESEND_API_KEY` secrets on both tasks (unchanged) |

---

## 3. Subscription notification — trigger & idempotency

- After successful paid enrollment, **first insert only** (`!existing` in `createVenueEnrollment`)
- Abandoned Checkout → no notify  
- Webhook retry → no duplicate  
- Resend key: `htc-ops-subscription:{checkoutSessionId|enrollmentId}`  
- Deployed on **marketing** image `44d472d4`

---

## 4. Intake notification — trigger & idempotency

- After successful first WG intake persist only  
- Edit/retry skipped; Resend key `htc-ops-wg-intake:{enrollmentId}`  
- No file attachments  
- Deployed on **venue-app** image `44d472d4`

---

## 5. Test / build results (pre-redeploy)

- Focused notify/UX tests: **29/29 PASS**  
- `workspace` `npm run build`: **PASS** (was the failing Docker job)  
- `marketing` `npm run build`: **PASS**  
- Venue root `npm run build`: **PASS**

---

## 6. Deployment evidence

- Workflow: https://github.com/jlcormier612/wevenu-website/actions/runs/42928030980  
- Conclusion: **success** (all build jobs + Deploy application stack + Wait & verify)  
- Serving SHA tag: **`44d472d4eebd1193a9d7ace1159a549bbded3394`**

---

## 7. Serving Sandbox verification

### ECS
Confirmed via `aws ecs describe-services` / `describe-task-definition` (above).

### White Glove UX (live)
`GET https://app.sandbox.hellotocheers.com/onboarding/white-glove/intake_0390…` → **200**

| Check | Result |
|---|---|
| “Welcome to White Glove Setup” | Present |
| “login is already set” | **Absent** |
| Access-after-setup copy | Present |
| “Tell us about your venue” | Present |
| Upload limits 25 MB / 40 files | Present |
| HoneyBook / warm migration language | Present |

### Customer emails
Repair commit did not change customer template definitions; no customer emails/SMS sent during this repair verification.

---

## 8. Delivery evidence (distinguish probe types)

### A. Earlier controlled Resend API probes (transport only)
Not the serving webhook/intake HTTP path. Both **`delivered`** to jennifer@:

- `01a1c7c9-c64c-7802-999b-54a3d589aa0f`  
- `01a1c7c9-c6cd-73e9-af3e-94e208662ae6`  

### B. End-to-end serving HTTP notify
**Not re-executed** in this repair pass:

- No new paid Checkout (not authorized)  
- Disposable Willow Grove intake **not submitted** (per instruction)  

Serving proof for notify is therefore: **correct image SHA + `INQUIRY_NOTIFY_EMAIL` on both task defs + code present in that SHA**. Full HTTP path remains available for a later disposable exercise.

---

## 9. Remaining gaps (non-blocking for this repair)

1. Optional: one disposable Launch Yourself or WG purchase to prove marketing webhook → ops email on serving.  
2. Optional: submit a **new** disposable WG intake (not the user’s open form) to prove venue intake → ops email.  
3. Production deploy must pass `InquiryNotifyEmail` when Production is authorized.

---

## 10. Legal safety

Unchanged two-stage model. No WG staff activation changes.
