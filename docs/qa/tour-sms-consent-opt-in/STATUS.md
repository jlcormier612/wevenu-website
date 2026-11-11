# Tour / inquiry SMS consent opt-in — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** GREEN  
**Commit:** `c7bb386ac5850d30a967488989216d4b07bf7376`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38313448457 (success; prior attempt 38313071864 failed on Public ECR rate limit, redeployed)  
**Serving tip:** `dpl=c7bb386ac5850d30a967488989216d4b07bf7376`

## Confirmed root cause

On the **existing-lead / personal tour scheduling** path (`?o=` origin token):

1. `resolveExistingLeadTourContext` prefills name/email/event type but **omitted phone**.
2. `InquiryForm` initialized `phone` to `""` for that path.
3. Submit coerced `smsPermissionGranted: smsPermissionGranted && !!phone.trim()`, so a checked consent box became **`false` in the request** whenever the form phone field was blank.
4. `applyInquiryCommunicationCapture` still saved preferred channels (including Text), then exited without writing `communication_permissions`.
5. Contact UI correctly showed **Not opted in** for the lead’s on-file phone — the write never happened. Venue texting configuration is unrelated.

Authoritative Sandbox proof (Lydia Cormier / Meadowbrook, tour Thu Oct 15 4:00 PM) before fix:

| Fact | Value |
|------|--------|
| Lead | `ba696be0-8565-4385-a226-24e0565242df` |
| Source | `email` (tour attached later) |
| Phone | `(508) 989-6064` |
| Prefs | `["email","sms"]` |
| `communication_permissions` for Meadowbrook + that phone | **none** |
| Entire Sandbox `source=tour_form` rows | **zero** historically |

**Data recovery:** Do **not** invent consent for Lydia (or other historical rows) without trustworthy checkbox evidence. Prefs ≠ consent.

## Scoped fix

- Prefill phone from existing-lead context.
- Send raw checkbox boolean from the public form.
- Resolve consent phone: form phone, else lead/contact on-file phone.
- Surface/log consent write failures; check upsert `ok`.
- Inquire path logging; tour source remains `tour_form`.

## Verification

| Check | Result |
|-------|--------|
| Focused unit/boundary tests | PASS (47) |
| `scripts/qa/tour-sms-consent-persist-proof.mts` | PASS — empty form phone + fallback → `opted_in`/`tour_form` |
| Deployed tip identity | `c7bb386a` |
| Browser: phone prefilled on personal link | PASS |
| Browser: consent checkbox visible | PASS |
| Deployed API book with **empty form phone** + checkbox true | PASS → DB `opted_in` / `tour_form` with matching `evidence.leadId` |
| Unchecked path creates no opted_in row | PASS |
| Lead Contact UI (1280 + 390) shows **Allowed** + tour booking provenance | PASS |
| Production | Untouched |
| Unrelated dirty/untracked work | Preserved |

Evidence: `docs/qa/tour-sms-consent-opt-in/browser-results.json`, screenshots, `persist-proof.json`.
