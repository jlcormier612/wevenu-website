-- SMS consent email tokens: venue may request SMS permission by email.
-- Consent is NEVER granted by sending/opening the email — only after the
-- recipient submits an affirmative opt-in on the public token page.
-- Same communication_permissions SoT (source = email_sms_consent).

create table if not exists public.sms_consent_email_tokens (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  lead_id         uuid not null references public.leads (id) on delete cascade,
  relationship_id uuid references public.venue_customer_relationships (id) on delete set null,
  token_hash      text not null unique,
  email_address   text not null,
  phone_e164      text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  revoked_at      timestamptz,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  constraint sms_consent_email_tokens_one_use check (used_at is null or revoked_at is null or used_at is not null)
);

create index if not exists sms_consent_email_tokens_lead
  on public.sms_consent_email_tokens (lead_id, created_at desc);
create index if not exists sms_consent_email_tokens_venue
  on public.sms_consent_email_tokens (venue_id);

alter table public.sms_consent_email_tokens enable row level security;

drop policy if exists "venue staff read sms_consent_email_tokens" on public.sms_consent_email_tokens;
create policy "venue staff read sms_consent_email_tokens"
  on public.sms_consent_email_tokens
  for select
  using (venue_id = public.current_user_venue_id());

-- Inserts/updates go through service role (token hash + redemption).
grant select on public.sms_consent_email_tokens to authenticated;
grant select, insert, update on public.sms_consent_email_tokens to service_role;

comment on table public.sms_consent_email_tokens is
  'One-time tokens for email-based SMS consent requests. Opening email is not consent; redeeming with affirmative opt-in records communication_permissions.';

notify pgrst, 'reload schema';
