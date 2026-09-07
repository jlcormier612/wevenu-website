-- Twilio ISV thin layer: per-venue subaccount config (non-secret).
-- Credentials live in AWS Secrets Manager, never in Postgres.
--
-- Locked v1: one subaccount + one default Messaging Service per venue.
-- Additional messaging_service_sid rows are intentionally not modeled yet.

create table if not exists public.venue_twilio_accounts (
  venue_id                 uuid primary key references public.venues(id) on delete cascade,
  twilio_account_sid       text not null unique,
  messaging_service_sid    text not null,
  default_from_e164        text,
  phone_number_sid         text,
  secondary_profile_sid    text,
  a2p_brand_sid            text,
  a2p_campaign_sid         text,
  status                   text not null default 'provisioning'
                           check (status in (
                             'provisioning',
                             'pending_compliance',
                             'ready',
                             'suspended',
                             'error'
                           )),
  status_detail            text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint venue_twilio_accounts_account_sid_format
    check (twilio_account_sid ~ '^AC[0-9a-fA-F]{32}$'),
  constraint venue_twilio_accounts_ms_sid_format
    check (messaging_service_sid ~ '^MG[0-9a-fA-F]{32}$')
);

create index if not exists venue_twilio_accounts_status_idx
  on public.venue_twilio_accounts (status);

alter table public.venue_twilio_accounts enable row level security;

create policy venue_twilio_accounts_venue_select on public.venue_twilio_accounts
  for select
  using (venue_id = public.current_user_venue_id());

-- Venue staff may read readiness; writes are service-role / ops only for v1.
grant select on public.venue_twilio_accounts to authenticated;
grant select, insert, update, delete on public.venue_twilio_accounts to service_role;

-- Audit which Twilio account produced a MessageSid (ISV multi-subaccount).
alter table public.conversation_messages
  add column if not exists provider_account_sid text;

create index if not exists conversation_messages_provider_account_sid
  on public.conversation_messages (provider_account_sid)
  where provider_account_sid is not null;

-- Venue-scoped inbound match — authoritative tenant routing uses AccountSid → venue first.
create or replace function public.find_relationship_by_phone_for_venue(
  p_phone text,
  p_venue_id uuid
)
returns table (
  venue_id uuid,
  relationship_id uuid,
  entity_type text,
  entity_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := public.normalize_phone_digits(p_phone);
begin
  if p_venue_id is null or v_digits = '' then
    return;
  end if;

  return query
    select l.venue_id, l.relationship_id, 'lead'::text, l.id,
      trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id is not null
      and public.normalize_phone_digits(l.phone) = v_digits
    limit 1;

  if found then
    return;
  end if;

  return query
    select c.venue_id, c.relationship_id, 'client'::text, c.id,
      trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
    from public.clients c
    where c.venue_id = p_venue_id
      and c.relationship_id is not null
      and public.normalize_phone_digits(c.phone) = v_digits
    limit 1;
end;
$$;

-- SECURITY DEFINER phone RPCs must not be callable by clients (cross-tenant risk).
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from public;
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from anon;
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from authenticated;
grant execute on function public.find_relationship_by_phone_for_venue(text, uuid) to service_role;

-- Legacy global matcher is unused by the ISV inbound path; same EXECUTE lockdown.
revoke all on function public.find_relationship_by_phone(text) from public;
revoke all on function public.find_relationship_by_phone(text) from anon;
revoke all on function public.find_relationship_by_phone(text) from authenticated;
grant execute on function public.find_relationship_by_phone(text) to service_role;

notify pgrst, 'reload schema';
