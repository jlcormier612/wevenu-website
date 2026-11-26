-- Gmail forwarding-address verification records (venue-scoped).
-- Written by email-intake service role; staff read via SECURITY DEFINER RPCs.
-- Confirmation URLs stay server-side; codes may be shown to authorized staff.

create table if not exists public.gmail_forwarding_verifications (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  state text not null
    check (state in ('pending', 'opened', 'acknowledged', 'expired', 'superseded', 'dismissed')),
  from_address text not null,
  subject text,
  confirmation_url text,
  confirmation_code text,
  confirmation_host text,
  email_id text,
  intake_attempt_id uuid references public.lead_intake_attempts(id) on delete set null,
  sender_auth_summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  expires_at timestamptz,
  opened_at timestamptz,
  acknowledged_at timestamptz,
  superseded_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gmail_forwarding_verifications_venue_state_idx
  on public.gmail_forwarding_verifications (venue_id, state, received_at desc);

create unique index if not exists gmail_forwarding_verifications_email_id_uidx
  on public.gmail_forwarding_verifications (email_id)
  where email_id is not null;

alter table public.gmail_forwarding_verifications enable row level security;

-- No direct client policies: access only via service role / SECURITY DEFINER helpers.
revoke all on public.gmail_forwarding_verifications from anon, authenticated;
grant select, insert, update on public.gmail_forwarding_verifications to service_role;

create or replace function public.touch_gmail_forwarding_verifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_gmail_forwarding_verifications_updated_at
  on public.gmail_forwarding_verifications;
create trigger trg_gmail_forwarding_verifications_updated_at
  before update on public.gmail_forwarding_verifications
  for each row execute function public.touch_gmail_forwarding_verifications_updated_at();
