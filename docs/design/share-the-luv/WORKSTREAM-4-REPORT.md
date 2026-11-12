# Workstream 4 — Share the Luv referral experience

**Branch:** `feat/share-the-luv-referral`  
**Base:** `origin/main` @ `cb06cf16`  
**Status:** Implementation ready for review — **not merged / not deployed**

## Creative / copy changes

Implemented on Settings → Refer a Venue (`components/referrals/refer-a-venue-page.tsx`):

- Program identity **SHARE THE LUV**
- Headline: **Share the Luv. Get a free month.**
- Supporting intro + reward card (**One referral. One FREE month.**) with multi-referral note
- CTA: **Share the Luv — Refer a Venue**
- Form intro replaced with approved **Refer a Venue** / “we’ll take it from there” copy
- Confirmation (API + fallback): **Thanks for sharing the Luv!** / take-it-from-here body

Policy truth preserved: one-time subscription credit after qualification window (default 30 days via `getReferralProgramPolicy`), not permanent discount.

## Workflow audit

| Capability | Status |
| --- | --- |
| Stored + attributed to referring venue | **Present** (`submitVenueReferral` → referral store / Postgres) |
| Customer list of own referrals | **Present** (`GET /api/referrals`) |
| No automatic prospect outreach on submit | **Present** (explicit comment + no prospect email) |
| Duplicate / self / same-org safeguards | **Present** |
| Reward pipeline (qualify → issue → apply) | **Present** (Phase 6 service + tests) |
| Workspace CRM `/referrals` nav | **Present** for internal staff |
| Internal notification / actionable queue on new submit | **GAP** — submission is persisted; no dedicated “new referral” alert/email to founders observed in `submitVenueReferral` |
| Customer confirmation | **Updated** (in-app confirmation only) |

### Smallest recommendation for the notification gap

Keep architecture as-is. Add a founder/workspace inbox or email notification on `status=submitted` using existing internal notify patterns — **do not** auto-email the referred venue. Track as a follow-up; not silently inventing CRM systems in this change.

## Tests

`npx tsx --test shared/pricing/referral-phase6.test.ts` → **10/10 PASS**

## Verdict

**YELLOW** for release: customer-facing copy GREEN; follow-up visibility gap YELLOW until internal notify is approved/implemented.
