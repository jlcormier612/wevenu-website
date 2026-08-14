-- Contract presentation branding freeze at draft→sent (release), matching
-- invoices.branding_snapshot. Additive only. Never overwritten. Pre-existing
-- sent/signed contracts without a snapshot fall back to live venue branding
-- (no silent backfill). Does not change signing, release, or status semantics.

alter table public.contracts
  add column if not exists branding_snapshot jsonb;

comment on column public.contracts.branding_snapshot is
  'Presentation-only venue branding frozen at draft→sent (release). Never overwritten. Pre-existing contracts without a snapshot fall back to live venue branding (no silent backfill).';

-- Return branding_snapshot on the public sign-page RPC so the client-facing
-- page can prefer the freeze when present.
create or replace function public.get_contract_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_signer_id uuid;
  v_signer_type text;
  v_signer_name text;
  v_signer_email text;
  v_signer_signed_at timestamptz;
  v_legacy boolean := false;
begin
  -- Prefer per-signer token (new model)
  select
    c.id, c.venue_id, c.client_id, c.event_id, c.template_id, c.title, c.content, c.status,
    c.sign_token, c.signer_name, c.signed_at, c.sent_at, c.expires_at, c.created_at, c.updated_at,
    c.branding_snapshot,
    cl.first_name as client_first_name, cl.last_name as client_last_name,
    cl.partner_first_name as client_partner_first_name, cl.partner_last_name as client_partner_last_name,
    cl.email as client_email,
    e.event_date,
    ven.name as venue_name, ven.primary_color as venue_primary_color, ven.secondary_color as venue_secondary_color,
    ven.accent_color as venue_accent_color, ven.neutral_color as venue_neutral_color, ven.logo_url as venue_logo_url,
    s.id as signer_id, s.signer_type, s.signer_name as row_signer_name, s.signer_email as row_signer_email,
    s.signed_at as row_signed_at
  into v
  from public.contract_signers s
  join public.contracts c on c.id = s.contract_id
  left join public.clients cl on cl.id = c.client_id
  left join public.events e on e.id = c.event_id
  left join public.venues ven on ven.id = c.venue_id
  where s.sign_token = p_token;

  if v.id is null then
    -- Legacy shared contracts.sign_token path (in-flight at cutover)
    select
      c.id, c.venue_id, c.client_id, c.event_id, c.template_id, c.title, c.content, c.status,
      c.sign_token, c.signer_name, c.signed_at, c.sent_at, c.expires_at, c.created_at, c.updated_at,
      c.branding_snapshot,
      cl.first_name as client_first_name, cl.last_name as client_last_name,
      cl.partner_first_name as client_partner_first_name, cl.partner_last_name as client_partner_last_name,
      cl.email as client_email,
      e.event_date,
      ven.name as venue_name, ven.primary_color as venue_primary_color, ven.secondary_color as venue_secondary_color,
      ven.accent_color as venue_accent_color, ven.neutral_color as venue_neutral_color, ven.logo_url as venue_logo_url,
      null::uuid as signer_id, 'client'::text as signer_type, null::text as row_signer_name,
      null::text as row_signer_email, null::timestamptz as row_signed_at
    into v
    from public.contracts c
    left join public.clients cl on cl.id = c.client_id
    left join public.events e on e.id = c.event_id
    left join public.venues ven on ven.id = c.venue_id
    where c.sign_token = p_token;
    v_legacy := true;
  end if;

  if v.id is null then
    return null;
  end if;

  -- Enforce expires_at (date column; expire at end of that calendar day UTC)
  if v.expires_at is not null and v.expires_at < (timezone('utc', now()))::date then
    return null;
  end if;

  v_signer_id := v.signer_id;
  v_signer_type := v.signer_type;
  v_signer_name := v.row_signer_name;
  v_signer_email := coalesce(v.row_signer_email, v.client_email);
  v_signer_signed_at := v.row_signed_at;

  return jsonb_build_object(
    'id', v.id, 'venue_id', v.venue_id, 'client_id', v.client_id, 'event_id', v.event_id,
    'template_id', v.template_id, 'title', v.title, 'content', v.content, 'status', v.status,
    'sign_token', v.sign_token, 'signer_name', v.signer_name, 'signed_at', v.signed_at,
    'sent_at', v.sent_at, 'expires_at', v.expires_at, 'created_at', v.created_at, 'updated_at', v.updated_at,
    'branding_snapshot', v.branding_snapshot,
    'clients', case when v.client_first_name is not null then jsonb_build_object(
      'first_name', v.client_first_name, 'last_name', v.client_last_name,
      'partner_first_name', v.client_partner_first_name, 'partner_last_name', v.client_partner_last_name,
      'email', v.client_email
    ) else null end,
    'events', case when v.event_date is not null then jsonb_build_object('event_date', v.event_date) else null end,
    'venue', jsonb_build_object(
      'name', v.venue_name, 'primaryColor', v.venue_primary_color, 'secondaryColor', v.venue_secondary_color,
      'accentColor', v.venue_accent_color, 'neutralColor', v.venue_neutral_color, 'logoUrl', v.venue_logo_url
    ),
    'signer', case when v_signer_id is not null then jsonb_build_object(
      'id', v_signer_id,
      'signerType', v_signer_type,
      'signerName', v_signer_name,
      'signerEmail', v_signer_email,
      'signedAt', v_signer_signed_at,
      'legacy', false
    ) when v_legacy then jsonb_build_object(
      'id', null,
      'signerType', 'client',
      'signerName', null,
      'signerEmail', v.client_email,
      'signedAt', v.signed_at,
      'legacy', true
    ) else null end
  );
end;
$$;

grant execute on function public.get_contract_by_token(uuid) to anon, authenticated;
