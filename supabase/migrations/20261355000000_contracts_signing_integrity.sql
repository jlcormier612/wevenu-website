-- Contracts / Signing integrity (release readiness)
-- 1. Public draft token must not return full contract body
-- 2. Partial-sign notification: "A client signed the contract" (not fully executed)
-- 3. DB content immutability after venue signature
-- 4. RLS: clearing venue signature (signed_at → null) Owner/Manager only
-- Additive / replace-function / replace-policy only. No backfill.

-- ── 1 + 2. get_contract_by_token: withhold draft content ─────────────────────
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
  v_content text;
begin
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

  if v.expires_at is not null and v.expires_at < (timezone('utc', now()))::date then
    return null;
  end if;

  -- Unreleased drafts: metadata / blocked state only — never full body.
  -- Released (sent) and fully signed keep legitimate payload for the public page.
  if v.status = 'draft' then
    v_content := null;
  else
    v_content := v.content;
  end if;

  v_signer_id := v.signer_id;
  v_signer_type := v.signer_type;
  v_signer_name := v.row_signer_name;
  v_signer_email := coalesce(v.row_signer_email, v.client_email);
  v_signer_signed_at := v.row_signed_at;

  return jsonb_build_object(
    'id', v.id, 'venue_id', v.venue_id, 'client_id', v.client_id, 'event_id', v.event_id,
    'template_id', v.template_id, 'title', v.title, 'content', v_content, 'status', v.status,
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

-- ── 2. Partial-sign notification language in sign_contract_signer ────────────
create or replace function public.sign_contract_signer(
  p_token uuid,
  p_signer text,
  p_ip text default null,
  p_user_agent text default null,
  p_consent boolean default false,
  p_consent_text text default null,
  p_content_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signer public.contract_signers%rowtype;
  v_contract public.contracts%rowtype;
  v_required_unsigned int;
  v_hash_mismatch boolean := false;
  v_celebrated boolean := false;
  v_all_hashes text[];
begin
  if not p_consent then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_signer
  from public.contract_signers
  where sign_token = p_token and signer_type = 'client' and signed_at is null;

  if v_signer.id is null then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_contract from public.contracts where id = v_signer.contract_id;

  if v_contract.id is null or v_contract.status <> 'sent' then
    return jsonb_build_object('ok', false);
  end if;

  if v_contract.expires_at is not null and v_contract.expires_at < (timezone('utc', now()))::date then
    return jsonb_build_object('ok', false);
  end if;

  if not exists (
    select 1 from public.contract_signers
    where contract_id = v_contract.id and signer_type = 'venue' and signed_at is not null
  ) then
    return jsonb_build_object('ok', false);
  end if;

  update public.contract_signers set
    signed_at = now(),
    signer_name = coalesce(nullif(trim(signer_name), ''), trim(p_signer)),
    signer_ip = p_ip,
    signer_user_agent = p_user_agent,
    consent_confirmed = p_consent,
    consent_text = coalesce(p_consent_text, 'I agree this constitutes my legal signature on this agreement.'),
    content_hash = p_content_hash,
    updated_at = now()
  where id = v_signer.id
    and signed_at is null;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  update public.contracts set
    signer_name = trim(p_signer),
    signer_ip = p_ip,
    signer_user_agent = p_user_agent,
    consent_confirmed = p_consent
  where id = v_contract.id and signed_at is null;

  insert into public.contract_activities (venue_id, contract_id, type, title, description, actor_id, actor_label)
  values (
    v_contract.venue_id, v_contract.id, 'signed',
    'A client signed the contract',
    trim(p_signer) || ' signed',
    null,
    trim(p_signer)
  );

  -- Honest partial-sign language — does not imply fully executed.
  perform public.create_venue_notification(
    v_contract.venue_id, v_contract.event_id, 'contract_signed',
    'A client signed the contract',
    trim(p_signer) || ' signed "' || coalesce(v_contract.title, 'your contract') || '"',
    '/contracts/' || v_contract.id::text,
    '📝'
  );

  select count(*) into v_required_unsigned
  from public.contract_signers
  where contract_id = v_contract.id
    and signer_type = 'client'
    and is_required = true
    and signed_at is null;

  if v_required_unsigned = 0 then
    select array_agg(distinct content_hash) into v_all_hashes
    from public.contract_signers
    where contract_id = v_contract.id
      and is_required = true
      and content_hash is not null;

    if v_all_hashes is not null and cardinality(v_all_hashes) > 1 then
      v_hash_mismatch := true;
    end if;

    if v_hash_mismatch then
      return jsonb_build_object('ok', false, 'reason', 'content_hash_mismatch');
    end if;

    update public.contracts set
      status = 'signed',
      signed_at = now(),
      signer_name = trim(p_signer)
    where id = v_contract.id and status = 'sent';

    insert into public.contract_activities (venue_id, contract_id, type, title, description, actor_id, actor_label)
    values (
      v_contract.venue_id, v_contract.id, 'fully_executed',
      'Contract fully signed',
      'All required signers have completed the agreement',
      null,
      trim(p_signer)
    );

    perform public.create_venue_notification(
      v_contract.venue_id, v_contract.event_id, 'contract_fully_executed',
      'Contract fully signed',
      '"' || coalesce(v_contract.title, 'Your contract') || '" is fully executed',
      '/contracts/' || v_contract.id::text,
      '✅'
    );

    if v_contract.client_id is not null then
      insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
      values (v_contract.venue_id, v_contract.client_id, v_contract.event_id, 'contract_signed', v_contract.id)
      on conflict (client_id, celebration_type) do nothing
      returning true into v_celebrated;
    end if;

    return jsonb_build_object('ok', true, 'fully_executed', true, 'celebrated', coalesce(v_celebrated, false));
  end if;

  return jsonb_build_object('ok', true, 'fully_executed', false, 'celebrated', false);
end;
$$;

grant execute on function public.sign_contract_signer(uuid, text, text, text, boolean, text, text) to anon, authenticated;

-- ── 3. Content immutability after venue signature ────────────────────────────
-- Protects contracts.content (and title) once the venue signer has signed_at.
-- Status / signer metadata / branding_snapshot / finalization fields remain mutable.

create or replace function public.contracts_enforce_content_immutability()
returns trigger
language plpgsql
as $$
declare
  v_venue_signed boolean;
begin
  if new.content is not distinct from old.content
     and new.title is not distinct from old.title
  then
    return new;
  end if;

  select exists (
    select 1 from public.contract_signers
    where contract_id = old.id
      and signer_type = 'venue'
      and signed_at is not null
  ) into v_venue_signed;

  if v_venue_signed then
    raise exception 'contracts: content is immutable after the venue has signed'
      using errcode = '23001';
  end if;

  return new;
end;
$$;

drop trigger if exists contracts_content_immutability on public.contracts;
create trigger contracts_content_immutability
  before update on public.contracts
  for each row
  execute function public.contracts_enforce_content_immutability();

-- ── 4. RLS: clearing venue signed_at requires Owner/Manager ──────────────────
-- Completing a venue signature (signed_at non-null) remains Owner/Manager.
-- Clearing venue signature (NEW.signed_at IS NULL while OLD was set) now also
-- requires Owner/Manager. Client signer rows and non-clearing updates unchanged.

drop policy if exists contract_signers_update on public.contract_signers;
create policy contract_signers_update on public.contract_signers for update
  using (venue_id = current_user_venue_id())
  with check (
    venue_id = current_user_venue_id()
    and (
      signer_type = 'client'
      or current_user_role() in ('owner', 'manager')
    )
  );
