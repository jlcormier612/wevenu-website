-- ============================================================================
-- White-label invoice branding snapshot + Contract electronic signature
-- (docs/contract-signature-architecture-plan.md,
--  docs/venue-white-label-collateral-implementation-plan.md Workstream C)
--
-- Additive only:
--   1. invoices.branding_snapshot jsonb (presentation freeze at draft→sent)
--   2. contract_activities.actor_id / actor_label
--   3. contract_signers table + RLS
--   4. get_contract_by_token: enforce expires_at; support per-signer tokens
--   5. sign_contract_signer RPC (new per-signer path)
--   6. legacy sign_contract kept for in-flight contracts.sign_token
-- ============================================================================

-- ── 1. Invoice branding snapshot ─────────────────────────────────────────────
alter table public.invoices
  add column if not exists branding_snapshot jsonb;

comment on column public.invoices.branding_snapshot is
  'Presentation-only venue branding frozen at draft→sent. Never overwritten. Pre-existing sent invoices without a snapshot fall back to live venue branding (no silent backfill).';

-- ── 2. contract_activities actor ─────────────────────────────────────────────
alter table public.contract_activities
  add column if not exists actor_id uuid,
  add column if not exists actor_label text;

comment on column public.contract_activities.actor_id is
  'Authenticated venue staff user id when known; null for anonymous client sign events.';
comment on column public.contract_activities.actor_label is
  'Human-readable actor label at the time of the event (staff name or signer name).';

-- ── 3. contract_signers ──────────────────────────────────────────────────────
create table if not exists public.contract_signers (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  signer_type text not null check (signer_type in ('venue', 'client')),
  signer_role text,
  signer_ref_id uuid,
  client_contact_id uuid references public.client_contacts(id) on delete set null,
  signer_name text,
  signer_email text,
  is_required boolean not null default true,
  sign_order integer not null default 1,
  sign_token uuid not null default gen_random_uuid(),
  signed_at timestamptz,
  signer_ip text,
  signer_user_agent text,
  consent_confirmed boolean,
  consent_text text,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_signers_sign_token_unique unique (sign_token)
);

create unique index if not exists contract_signers_one_venue_per_contract
  on public.contract_signers (contract_id)
  where signer_type = 'venue';

create index if not exists contract_signers_contract_idx
  on public.contract_signers (contract_id, sign_order);

create index if not exists contract_signers_venue_idx
  on public.contract_signers (venue_id);

create index if not exists contract_signers_token_idx
  on public.contract_signers (sign_token);

alter table public.contract_signers enable row level security;

-- Venue-scoped SELECT for any authenticated staff at the venue
drop policy if exists contract_signers_select on public.contract_signers;
create policy contract_signers_select on public.contract_signers for select
  using (venue_id = current_user_venue_id());

-- INSERT: any authenticated venue staff may create signer rows (placeholders
-- at contract create). Completing a venue signature is gated on UPDATE below.
drop policy if exists contract_signers_insert on public.contract_signers;
create policy contract_signers_insert on public.contract_signers for insert
  with check (venue_id = current_user_venue_id());

-- UPDATE: completing a venue signature (signed_at non-null) requires
-- owner/manager. Clearing a venue signature (signed_at null — reopen /
-- withdraw) is allowed for any venue staff so negotiation loops work.
drop policy if exists contract_signers_update on public.contract_signers;
create policy contract_signers_update on public.contract_signers for update
  using (venue_id = current_user_venue_id())
  with check (
    venue_id = current_user_venue_id()
    and (
      signer_type = 'client'
      or current_user_role() in ('owner', 'manager')
      or signed_at is null
    )
  );

drop policy if exists contract_signers_delete on public.contract_signers;
create policy contract_signers_delete on public.contract_signers for delete
  using (
    venue_id = current_user_venue_id()
    and current_user_role() in ('owner', 'manager')
  );

grant select, insert, update, delete on public.contract_signers to authenticated;

-- ── 4. get_contract_by_token — expires_at + per-signer tokens ────────────────
-- Returns the contract for either contracts.sign_token (legacy) or a
-- contract_signers.sign_token (new). Expired contracts return null.
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

-- ── 5. sign_contract_signer — per-signer token path ──────────────────────────
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

  -- Expiration
  if v_contract.expires_at is not null and v_contract.expires_at < (timezone('utc', now()))::date then
    return jsonb_build_object('ok', false);
  end if;

  -- Venue must have signed first (release gate already requires this for sent,
  -- but defend in depth)
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

  -- Prefer typed confirmation name on the contracts legacy columns when first client signs
  update public.contracts set
    signer_name = trim(p_signer),
    signer_ip = p_ip,
    signer_user_agent = p_user_agent,
    consent_confirmed = p_consent
  where id = v_contract.id and signed_at is null;

  insert into public.contract_activities (venue_id, contract_id, type, title, description, actor_id, actor_label)
  values (
    v_contract.venue_id, v_contract.id, 'signed',
    'Client signed',
    trim(p_signer) || ' signed',
    null,
    trim(p_signer)
  );

  perform public.create_venue_notification(
    v_contract.venue_id, v_contract.event_id, 'contract_signed',
    'Contract signed',
    trim(p_signer) || ' signed "' || coalesce(v_contract.title, 'your contract') || '"',
    '/contracts/' || v_contract.id::text,
    '📝'
  );

  -- Fully executed when every required client signer has signed
  select count(*) into v_required_unsigned
  from public.contract_signers
  where contract_id = v_contract.id
    and signer_type = 'client'
    and is_required = true
    and signed_at is null;

  if v_required_unsigned = 0 then
    -- Hash integrity: all non-null content hashes across venue + required clients must match
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

-- ── 6. Legacy sign_contract — keep for in-flight; add expires_at + content hash columns on contracts remain untouched
-- Also enforce expires_at on the legacy path.
create or replace function public.sign_contract(
  p_token uuid,
  p_signer text,
  p_ip text default null,
  p_user_agent text default null,
  p_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_venue     uuid;
  v_client_id uuid;
  v_event_id  uuid;
  v_title     text;
  v_expires   date;
  v_celebrated boolean := false;
begin
  if not p_consent then
    return jsonb_build_object('ok', false);
  end if;

  select id, venue_id, client_id, event_id, title, expires_at
  into v_id, v_venue, v_client_id, v_event_id, v_title, v_expires
  from public.contracts
  where sign_token = p_token and status = 'sent';

  if v_id is null then return jsonb_build_object('ok', false); end if;

  if v_expires is not null and v_expires < (timezone('utc', now()))::date then
    return jsonb_build_object('ok', false);
  end if;

  -- If this contract has a venue signer row that is not yet signed, block
  -- (new-model contracts must use sign_contract_signer; legacy has no venue row)
  if exists (
    select 1 from public.contract_signers
    where contract_id = v_id and signer_type = 'venue'
  ) and not exists (
    select 1 from public.contract_signers
    where contract_id = v_id and signer_type = 'venue' and signed_at is not null
  ) then
    return jsonb_build_object('ok', false);
  end if;

  -- New-model contracts with client signer rows should use the per-signer RPC.
  -- Allow legacy only when there are no client signer rows, OR when matching
  -- the shared contracts.sign_token for an in-flight contract that never got
  -- per-signer rows.
  if exists (
    select 1 from public.contract_signers
    where contract_id = v_id and signer_type = 'client'
  ) then
    return jsonb_build_object('ok', false);
  end if;

  update public.contracts set
    status             = 'signed',
    signer_name         = trim(p_signer),
    signed_at           = now(),
    signer_ip           = p_ip,
    signer_user_agent   = p_user_agent,
    consent_confirmed   = p_consent
  where id = v_id;

  insert into public.contract_activities (venue_id, contract_id, type, title, description, actor_id, actor_label)
  values (v_venue, v_id, 'signed', 'Contract signed', 'Signed by ' || trim(p_signer), null, trim(p_signer));

  perform public.create_venue_notification(
    v_venue, v_event_id, 'contract_signed',
    'Contract signed',
    trim(p_signer) || ' signed "' || coalesce(v_title, 'your contract') || '"',
    '/contracts/' || v_id::text,
    '📝'
  );

  if v_client_id is not null then
    insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
    values (v_venue, v_client_id, v_event_id, 'contract_signed', v_id)
    on conflict (client_id, celebration_type) do nothing
    returning true into v_celebrated;
  end if;

  return jsonb_build_object('ok', true, 'celebrated', coalesce(v_celebrated, false));
end;
$$;

grant execute on function public.sign_contract(uuid, text, text, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
