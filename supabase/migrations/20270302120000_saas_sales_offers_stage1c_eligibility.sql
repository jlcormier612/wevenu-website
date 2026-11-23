-- ============================================================================
-- Batch 3.3 Stage 1C — Standard discount eligibility on sales offer drafts
--
-- Durable founder / application eligibility selection for Stage 2 checkout
-- and post-intro fallback. Does not create Stripe objects or consume Founding
-- slots. Drafts only.
-- ============================================================================

alter table public.saas_sales_offers
  add column if not exists standard_discount_eligibility text not null
    default 'not_established'
    check (standard_discount_eligibility in (
      'not_established',
      'former_weven',
      'founding',
      'additional_venue',
      'none'
    ));

alter table public.saas_sales_offers
  add column if not exists standard_discount_evidence text not null
    default 'not_established'
    check (standard_discount_evidence in (
      'not_established',
      'founder_recorded',
      'application_confirmed',
      'explicitly_none'
    ));

comment on column public.saas_sales_offers.standard_discount_eligibility is
  'Stage 1C: which standard discount category applies after custom promo ends (or as fallback). not_established is distinct from none.';

comment on column public.saas_sales_offers.standard_discount_evidence is
  'Stage 1C: how eligibility was established — founder_recorded, application_confirmed, not_established, or explicitly_none.';
