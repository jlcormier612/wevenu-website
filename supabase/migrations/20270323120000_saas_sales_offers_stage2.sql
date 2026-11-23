-- Batch 3.3 Stage 2 — Custom offer send / accept / checkout / paid.
-- Extends saas_sales_offers with public token, recipient, customer message,
-- accepted snapshot, and paid/checkout_pending lifecycle states.

alter table public.saas_sales_offers
  drop constraint if exists saas_sales_offers_status_check;

alter table public.saas_sales_offers
  add constraint saas_sales_offers_status_check
  check (status in (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'checkout_pending',
    'paid',
    'expired',
    'revoked',
    'superseded',
    'discarded'
  ));

alter table public.saas_sales_offers
  add column if not exists public_token text;

alter table public.saas_sales_offers
  add column if not exists recipient_name text;

alter table public.saas_sales_offers
  add column if not exists recipient_email text;

alter table public.saas_sales_offers
  add column if not exists customer_message text;

alter table public.saas_sales_offers
  add column if not exists accepted_snapshot jsonb;

alter table public.saas_sales_offers
  add column if not exists paid_at timestamptz;

alter table public.saas_sales_offers
  add column if not exists accepted_revision integer;

-- Backfill tokens for any existing rows (drafts included) — unused until send.
update public.saas_sales_offers
set public_token = encode(gen_random_bytes(32), 'hex')
where public_token is null;

alter table public.saas_sales_offers
  alter column public_token set not null;

alter table public.saas_sales_offers
  alter column public_token set default encode(gen_random_bytes(32), 'hex');

create unique index if not exists saas_sales_offers_public_token_uidx
  on public.saas_sales_offers (public_token);

create index if not exists saas_sales_offers_recipient_email_idx
  on public.saas_sales_offers (lower(recipient_email))
  where recipient_email is not null;

comment on column public.saas_sales_offers.public_token is
  'Unguessable customer offer link token (/custom-offer/{token}).';
comment on column public.saas_sales_offers.accepted_snapshot is
  'Immutable commercial snapshot at acceptance — Checkout must use this, not live draft fields.';
comment on column public.saas_sales_offers.customer_message is
  'Optional founder-written message shown on the customer offer page (never internal notes).';
