-- QuickBooks requires an income account on every Service Item.
--
-- The original design (docs/quickbooks-online-architecture.md §2 and
-- lib/quickbooks/items.ts) assumed QuickBooks would assign a default income
-- account to the single "Hello to Cheers Services" placeholder Item, so no
-- venue-facing account decision was needed at launch. That assumption was
-- disproven live against Intuit's own sandbox: creating the Item without an
-- account reference fails with
--
--   400 ValidationFault code 2020 — "Required parameter ExpenseAccountRef or
--   IncomeAccountRef is missing in the request"
--
-- QuickBooks exposes no discoverable default either (the company Preferences
-- endpoint carries only DefaultDiscountAccount), and a real company has many
-- equally plausible income accounts, so there is no safe automatic choice.
-- The venue picks one, explicitly, exactly once.
--
-- Cached here next to default_item_quickbooks_id because it is the same kind
-- of connection-level state: one value per connected company, resolved once
-- and reused by every subsequent sync. This is deliberately NOT the full
-- Chart of Accounts mapping feature (§4) — one account, used solely to create
-- the one placeholder Item.

alter table public.quickbooks_connections
  add column if not exists default_income_account_quickbooks_id text,
  add column if not exists default_income_account_name text;

comment on column public.quickbooks_connections.default_income_account_quickbooks_id is
  'QuickBooks Account.Id the venue explicitly chose for the default Service Item. Never auto-selected.';
comment on column public.quickbooks_connections.default_income_account_name is
  'Display name captured at selection time, so Settings can show the choice without a QuickBooks round trip.';
