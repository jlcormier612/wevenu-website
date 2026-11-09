# HTC Phase 5 — Founder Custom Pricing Controls

## Local readiness

- Migration: `supabase/migrations/20270113120000_saas_pricing_phase5_founder_arrangements.sql`
- Flag: `PRICING_FOUNDER_V1` (default off; Sandbox deploy sets true after migration)
- Product: `STRIPE_SAAS_PRODUCT_ID=prod_V4AgrDDqyO0YGF` (Gather $199 Stripe Product)
- Store: `PRICING_FOUNDER_STORE=postgres`
- Scheduler: hourly `founder-arrangements-process`

## Surfaces

- Founder CRM: `/custom-pricing` (Owner/Administrator via `manage_product_sync`)
- Venue Billing: Special pricing card on Settings → Billing
- Internal: `/api/internal/pricing/founder-arrangements` (+ `/process`)

## Policy

Dollar-best single offer among Weven / Founding / Group / founder arrangement. No coupon stacking. Tier freeze and rate freeze are separate controls. Phase 3 schedule ownership still defers independent Stripe mutations.
