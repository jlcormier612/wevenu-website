-- Self-service texting provisioning: Trust Product SID, compliance evidence,
-- status mirrors, and an idempotent per-step ledger.
-- messaging_service_sid may be null only while status = provisioning.

alter table public.venue_twilio_accounts
  alter column messaging_service_sid drop not null;

alter table public.venue_twilio_accounts
  drop constraint if exists venue_twilio_accounts_ms_sid_format;

alter table public.venue_twilio_accounts
  add constraint venue_twilio_accounts_ms_sid_format
  check (
    messaging_service_sid is null
    or messaging_service_sid ~ '^MG[0-9a-fA-F]{32}$'
  );

alter table public.venue_twilio_accounts
  add column if not exists a2p_trust_product_sid text;

alter table public.venue_twilio_accounts
  add column if not exists a2p_brand_status text;

alter table public.venue_twilio_accounts
  add column if not exists a2p_campaign_status text;

alter table public.venue_twilio_accounts
  add column if not exists phone_a2p_status text;

alter table public.venue_twilio_accounts
  add column if not exists compliance_submitted_at timestamptz;

alter table public.venue_twilio_accounts
  add column if not exists provisioning_generation integer not null default 1;

alter table public.venue_twilio_accounts
  add constraint venue_twilio_accounts_ready_requires_sender
  check (
    status <> 'ready'
    or (
      messaging_service_sid is not null
      and default_from_e164 is not null
      and phone_number_sid is not null
      and a2p_brand_sid is not null
      and a2p_campaign_sid is not null
    )
  );

create unique index if not exists venue_twilio_accounts_secondary_profile_sid_uidx
  on public.venue_twilio_accounts (secondary_profile_sid)
  where secondary_profile_sid is not null;

create unique index if not exists venue_twilio_accounts_a2p_brand_sid_uidx
  on public.venue_twilio_accounts (a2p_brand_sid)
  where a2p_brand_sid is not null;

create unique index if not exists venue_twilio_accounts_a2p_campaign_sid_uidx
  on public.venue_twilio_accounts (a2p_campaign_sid)
  where a2p_campaign_sid is not null;

create unique index if not exists venue_twilio_accounts_phone_number_sid_uidx
  on public.venue_twilio_accounts (phone_number_sid)
  where phone_number_sid is not null;

create table if not exists public.venue_texting_provisioning_steps (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  generation integer not null default 1,
  step text not null,
  status text not null default 'pending'
    check (status in (
      'pending',
      'running',
      'succeeded',
      'failed',
      'skipped'
    )),
  resource_sid text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  last_error_message text,
  support_debug jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_texting_provisioning_steps_unique
    unique (venue_id, generation, step)
);

create index if not exists venue_texting_provisioning_steps_due_idx
  on public.venue_texting_provisioning_steps (status, next_attempt_at)
  where status in ('pending', 'failed');

alter table public.venue_texting_provisioning_steps enable row level security;

-- Ops / service_role only — venues never read raw provisioning ledger.
grant select, insert, update, delete on public.venue_texting_provisioning_steps to service_role;

notify pgrst, 'reload schema';
