# HTC Commercial Pricing Roadmap — GREEN / CLOSED

**Date:** 2026-11-10  
**Serving SHA (acceptance):** `846c5143`  
**Combined acceptance:** `docs/qa/htc-commercial-roadmap-closure/FINAL-COMBINED-ACCEPTANCE.json`  
**Verdict:** **GREEN / CLOSED** for Phases 1–6 in Sandbox (Stripe Test only). Production untouched.

## What this closure proves

Authenticated browser + disposable Stripe Test renewal for the remaining Phase 5/6 gaps:

| Gap | Result |
|---|---|
| Venue Refer a Venue UI submit | GREEN — confirmation + history |
| Founder CRM Referrals UI | GREEN |
| Founder CRM Custom Pricing UI | GREEN (closes Phase 5 browser-smoke gap) |
| Venue Billing special pricing | GREEN |
| Venue Billing referral credit visibility | GREEN |
| Finalized renewal invoice consumes referral credit | GREEN — `in_1Ua3Uz…` **paid**, total `$0` |
| Reward transitions to `applied` | GREEN — matches applied invoice |

## Stripe evidence (Phase 6 application)

- Referrer venue: `f9427d5e-84f9-48bc-a9fa-8a2bcb95af7f` (`[DISPOSABLE-P3-REHEARSAL]`)
- Subscription: `sub_1UZvv7ErUqJH7nktxwGc9vmC` (Celebrate $249)
- Credit invoice item: `ii_1Ua3UtErUqJH7nktl9ZkqlMA` (−$249.00, subscription-scoped)
- Test clock advance → renewal invoice: `in_1Ua3UzErUqJH7nkturUieO32` (**paid**, total `0`)
- Reward `6097ac77-24db-4745-b5af-f89ebae4991d` status **`applied`** with matching `appliedInvoiceId`

## Phase summary

| Phase | Capability | Status |
|---|---|---|
| 1 | Launch catalog + Founding | GREEN (prior) |
| 2 | Former Weven | GREEN (prior) |
| 3 | Tier upgrades | GREEN (prior) |
| 4 | Multi-venue group | GREEN (prior) |
| 5 | Founder custom pricing | GREEN + browser smoke closed |
| 6 | Refer a Venue | GREEN including finalized invoice application |

## Screenshots

Under `docs/qa/htc-commercial-roadmap-closure/acceptance/2026-11-10T01-04-18-627Z/`:

- `02-crm-custom-pricing.png`
- `05-venue-billing-phase5.png`
- `07-referrals-page.png` / `09-referral-confirmation.png`
- `11-crm-referrals.png`
- `22-venue-billing-referral-credit.png`

## Preserved

- Willow Grove demonstration records untouched
- Unrelated local dirty docs/qa work untouched
- Production / Stripe Live untouched
