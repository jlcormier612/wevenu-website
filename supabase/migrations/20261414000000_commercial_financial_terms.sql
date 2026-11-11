-- ============================================================================
-- Commercial financial terms (contract-first tax & discounts)
--
-- Selected Package (commercial_selections) captures agreed package / discount /
-- exclusive tax / final total before a contract or invoice exists.
-- total_amount remains the final agreed commitment (payment-plan / invoice SoT).
-- package_amount preserves the original package price when terms diverge.
--
-- invoice_line_items gains applied tax rate metadata so venue default changes
-- cannot rewrite existing tax lines. Legacy deposit invoice lines are untouched;
-- application totals no longer treat them as discounts.
-- ============================================================================

-- commercial_selections: additive financial breakdown ----------------------------
alter table public.commercial_selections
  add column if not exists package_amount numeric(10, 2),
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists discount_type text
    check (discount_type is null or discount_type in ('fixed', 'percent')),
  add column if not exists discount_value numeric(10, 4),
  add column if not exists tax_rate_percent numeric(10, 4),
  add column if not exists tax_amount numeric(10, 2) not null default 0,
  add column if not exists tax_applied boolean not null default false;

comment on column public.commercial_selections.package_amount is
  'Original package price before discount/tax. Null on legacy rows → treat as total_amount.';
comment on column public.commercial_selections.total_amount is
  'Final agreed commercial commitment (package − discount + exclusive tax). Payment plans and invoices inherit this.';
comment on column public.commercial_selections.deposit_amount is
  'Suggested payment allocation (deposit), not a discount and not part of taxable base.';
comment on column public.commercial_selections.tax_applied is
  'True only when tax was deliberately applied to these terms; venue default alone is not enough.';

-- Backfill: legacy rows have no separate package/discount/tax — package = total.
-- package_amount stays nullable so existing proposal RPCs that omit it keep working;
-- the app treats null as total_amount (legacy = package equals final total).
update public.commercial_selections
set package_amount = total_amount
where package_amount is null;

alter table public.commercial_selections
  add constraint commercial_selections_package_amount_nonneg
    check (package_amount is null or package_amount >= 0);

alter table public.commercial_selections
  add constraint commercial_selections_discount_amount_nonneg
    check (discount_amount >= 0);

alter table public.commercial_selections
  add constraint commercial_selections_tax_amount_nonneg
    check (tax_amount >= 0);

-- invoice_line_items: persist applied tax rate with the line -----------------------
alter table public.invoice_line_items
  add column if not exists tax_rate_mode text
    check (tax_rate_mode is null or tax_rate_mode in ('percent', 'fixed')),
  add column if not exists tax_rate_value numeric(10, 4);

comment on column public.invoice_line_items.tax_rate_mode is
  'When type=tax: how tax_rate_value was applied (percent of taxable base, or fixed).';
comment on column public.invoice_line_items.tax_rate_value is
  'When type=tax: persisted rate/value used to compute amount; venue defaults must not rewrite this.';

notify pgrst, 'reload schema';
