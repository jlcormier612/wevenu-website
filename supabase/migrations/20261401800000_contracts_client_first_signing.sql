-- Client-first contract signing:
-- 1. Clients may sign without a prior venue signature.
-- 2. Completing all required client signatures does NOT fully execute —
--    status stays 'sent' (Awaiting Venue Signature) until the venue countersigns.
-- 3. Content becomes immutable once any client has signed (or status is signed),
--    not merely because the venue signed first.

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
  v_all_hashes text[];
  v_venue_unsigned boolean;
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

  -- Client-first: do NOT require venue signed_at before client can sign.

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

    -- All required clients signed — still awaiting venue countersignature.
    -- Do NOT set status = 'signed' or fire fully_executed here.
    select not exists (
      select 1 from public.contract_signers
      where contract_id = v_contract.id and signer_type = 'venue' and signed_at is not null
    ) into v_venue_unsigned;

    if v_venue_unsigned then
      perform public.create_venue_notification(
        v_contract.venue_id, v_contract.event_id, 'contract_requires_attention',
        'Contract awaiting your signature',
        '"' || coalesce(v_contract.title, 'Your contract') || '" has been signed by the client and needs your signature',
        '/contracts/' || v_contract.id::text,
        '✍️'
      );
    end if;

    return jsonb_build_object('ok', true, 'fully_executed', false, 'celebrated', false, 'awaiting_venue', true);
  end if;

  return jsonb_build_object('ok', true, 'fully_executed', false, 'celebrated', false);
end;
$$;

grant execute on function public.sign_contract_signer(uuid, text, text, text, boolean, text, text) to anon, authenticated;

-- Content immutability: lock after any client signature or once fully executed.
create or replace function public.contracts_enforce_content_immutability()
returns trigger
language plpgsql
as $$
declare
  v_client_signed boolean;
begin
  if new.content is not distinct from old.content
     and new.title is not distinct from old.title
  then
    return new;
  end if;

  if old.status = 'signed' or new.status = 'signed' then
    raise exception 'contracts: content is immutable after the contract is fully executed'
      using errcode = '23001';
  end if;

  select exists (
    select 1 from public.contract_signers
    where contract_id = old.id
      and signer_type = 'client'
      and signed_at is not null
  ) into v_client_signed;

  if v_client_signed then
    raise exception 'contracts: content is immutable after a client has signed'
      using errcode = '23001';
  end if;

  return new;
end;
$$;
