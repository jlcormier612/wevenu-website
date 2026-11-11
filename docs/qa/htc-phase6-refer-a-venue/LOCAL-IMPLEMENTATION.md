# HTC Phase 6 — Refer a Venue

## Local readiness

- Migration: `supabase/migrations/20270114120000_saas_pricing_phase6_referrals.sql`
- Flags:
  - `REFERRAL_PROGRAM_V1` — submission, CRM, qualification (default off)
  - `REFERRAL_REWARD_ISSUE` — Stripe credit issuance (default off; enable after billing acceptance)
  - `REFERRAL_QUALIFICATION_DAYS` — policy window (default 30)
  - `REFERRAL_STORE=postgres` in Sandbox
- Scheduler: hourly `:35` `referrals-process`
- Credit mechanism: subscription-scoped **negative invoice item** (not customer balance)

## Surfaces

- Venue: `/settings/referrals` + Billing thank-you credits card
- Founder CRM: `/referrals` (Owner/Administrator via `manage_product_sync`)
- Internal: `/api/internal/pricing/referrals` (+ `/process`)
- Workspace proxy: `/api/relationships/referrals`

## Policy

- One-time thank-you = one month of the **referrer's** discounted recurring SaaS amount at eligibility
- Earliest valid referral wins for a converted venue (founder can override)
- No automated outreach to the referred prospect
- No stacking; no White Glove / tax / one-time fee inclusion
