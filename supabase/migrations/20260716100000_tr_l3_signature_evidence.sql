-- ============================================================================
-- TR-L3 — E-signature captures no real audit trail
-- Resolves docs/trust-risk-register.md TR-L3: sign_contract() previously
-- recorded only a typed name and a timestamp. Adds IP address, user-agent,
-- and an explicit consent flag captured at the moment of signing.
-- ============================================================================

alter table public.contracts
  add column signer_ip text,
  add column signer_user_agent text,
  add column consent_confirmed boolean not null default false;

-- Drop the old 2-arg overload — otherwise it remains callable directly
-- (bypassing the new consent requirement entirely) since Postgres keeps both
-- overloads unless the old one is explicitly removed.
drop function if exists public.sign_contract(uuid, text);

-- Replace sign_contract() to require and record explicit consent plus the
-- IP/user-agent captured server-side at signing time. Still SECURITY DEFINER
-- for the same reason as before — anonymous signers, token-based authorization.
create or replace function public.sign_contract(
  p_token uuid,
  p_signer text,
  p_ip text default null,
  p_user_agent text default null,
  p_consent boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_venue  uuid;
begin
  if not p_consent then
    return false;
  end if;

  select id, venue_id into v_id, v_venue
  from public.contracts
  where sign_token = p_token and status = 'sent';

  if v_id is null then return false; end if;

  update public.contracts set
    status             = 'signed',
    signer_name         = trim(p_signer),
    signed_at           = now(),
    signer_ip           = p_ip,
    signer_user_agent   = p_user_agent,
    consent_confirmed   = p_consent
  where id = v_id;

  insert into public.contract_activities (venue_id, contract_id, type, title, description)
  values (v_venue, v_id, 'signed', 'Contract signed', 'Signed by ' || trim(p_signer));

  return true;
end;
$$;

grant execute on function public.sign_contract(uuid, text, text, text, boolean) to anon, authenticated;
