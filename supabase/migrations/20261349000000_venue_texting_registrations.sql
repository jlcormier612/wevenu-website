-- HTC-owned venue texting onboarding (Track A).
-- Product lifecycle + compliance questionnaire live here.
-- Provider SIDs / credentials stay in venue_twilio_accounts + AWS Secrets Manager.

create table if not exists public.venue_texting_registrations (
  venue_id uuid primary key references public.venues(id) on delete cascade,

  phase text not null default 'not_started'
    check (phase in (
      'not_started',
      'details_needed',
      'under_review',
      'needs_attention',
      'setting_up_number',
      'ready',
      'paused',
      'failed'
    )),

  -- Actionable attention (venue-facing). support_debug is never for normal UI.
  attention_code text,
  attention_message text,
  attention_fix_hint text,
  support_debug jsonb,

  -- Business identity snapshot / confirmation (HTC-owned; prefilled from venues)
  business_name text,
  website_url text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country text,
  contact_email text,
  contact_phone text,
  business_confirmed_at timestamptz,

  -- Compliance fields
  business_type text,
  business_industry text,
  registration_id_type text,
  -- AES-GCM ciphertext only (app-layer). Never log or show in Inbox.
  registration_number_ciphertext text,
  registration_number_last4 text,
  regions_of_operation text not null default 'USA_AND_CANADA',

  -- Authorized representative
  rep_first_name text,
  rep_last_name text,
  rep_email text,
  rep_phone text,
  rep_business_title text,
  rep_job_position text,

  -- Messaging use case (plain language)
  messaging_purpose text,
  sample_message_1 text,
  sample_message_2 text,
  opt_in_description text,
  privacy_policy_url text,
  terms_url text,

  submitted_at timestamptz,
  approved_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venue_texting_registrations_phase_idx
  on public.venue_texting_registrations (phase);

alter table public.venue_texting_registrations enable row level security;

create policy venue_texting_registrations_venue_select
  on public.venue_texting_registrations
  for select
  using (venue_id = public.current_user_venue_id());

create policy venue_texting_registrations_venue_insert
  on public.venue_texting_registrations
  for insert
  with check (venue_id = public.current_user_venue_id());

create policy venue_texting_registrations_venue_update
  on public.venue_texting_registrations
  for update
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- Venues never delete their registration row via client; service_role may.
grant select, insert, update on public.venue_texting_registrations to authenticated;
grant select, insert, update, delete on public.venue_texting_registrations to service_role;

-- Support/debug payload is ops-only (not venue UI, not authenticated SELECT).
revoke select (support_debug) on public.venue_texting_registrations from authenticated;
revoke update (support_debug) on public.venue_texting_registrations from authenticated;
revoke insert (support_debug) on public.venue_texting_registrations from authenticated;

notify pgrst, 'reload schema';
