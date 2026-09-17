-- ============================================================================
-- Tour Protection — staging table keyed by Stripe Checkout session ID.
--
-- Full prospect payload cannot live only in Stripe metadata. This row is the
-- source of truth across redirect, abandonment, webhook delivery, retries,
-- concurrent attempts, and late successful payment.
-- ============================================================================

create table public.tour_protection_requests (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  appointment_id uuid references public.tour_appointments(id) on delete set null,

  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_setup_intent_id text,
  stripe_payment_method_id text,
  stripe_account_id text not null,

  mode text not null check (mode in ('setup', 'fee')),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  refunded_amount_cents integer not null default 0 check (refunded_amount_cents >= 0),

  slot_start timestamptz not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  event_type text,
  event_date text,
  guest_count integer,
  notes text,
  source_data jsonb not null default '{}'::jsonb,
  qr_campaign_id text,

  status text not null default 'pending' check (status in (
    'pending',
    'checkout_open',
    'completed',
    'paid_unbooked',
    'abandoned',
    'expired',
    'failed',
    'refunded'
  )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,

  constraint tour_protection_fee_positive_when_fee
    check (mode <> 'fee' or fee_cents > 0),
  constraint tour_protection_completed_has_appointment
    check (status <> 'completed' or appointment_id is not null),
  constraint tour_protection_paid_unbooked_has_no_appointment
    check (status <> 'paid_unbooked' or appointment_id is null)
);

comment on table public.tour_protection_requests is
  'Staged public tour-protection requests. Appointment is created only after Stripe success via book_protected_tour.';

create unique index tour_protection_requests_session_id
  on public.tour_protection_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index tour_protection_requests_one_completed_appointment
  on public.tour_protection_requests (appointment_id)
  where appointment_id is not null;

create index tour_protection_requests_venue_status
  on public.tour_protection_requests (venue_id, status, created_at desc);

create index tour_protection_requests_lead
  on public.tour_protection_requests (venue_id, lead_id);

create index tour_protection_requests_payment_intent
  on public.tour_protection_requests (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.tour_protection_requests enable row level security;

create policy "venue staff manage tour protection requests"
  on public.tour_protection_requests for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, update on public.tour_protection_requests to authenticated;

-- Public/anon never reads or writes this table. Staging inserts and webhook
-- completion use the service role.

create or replace function public.touch_tour_protection_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger tour_protection_requests_touch_updated_at
  before update on public.tour_protection_requests
  for each row execute function public.touch_tour_protection_request_updated_at();

notify pgrst, 'reload schema';
