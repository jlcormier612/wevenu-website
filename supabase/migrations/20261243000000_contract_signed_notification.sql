-- ============================================================================
-- Work Package D3 — "Whose turn is it?" for Contracts closes a real gap
-- found during collaborative-working-item research: sign_contract() already
-- writes a contract_activities row and a luv_celebrations row on signature,
-- but never actually alerts the coordinator — the "signed" fact sat in an
-- activity log nobody is prompted to check. Every other meaningful
-- collaborative event in this app (task completion by a couple/vendor)
-- already fires through create_venue_notification(); this reuses that same
-- existing function — additive only, one new insert appended to the
-- existing sign_contract() body, nothing else in it changed.
-- ============================================================================

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
  v_celebrated boolean := false;
begin
  if not p_consent then
    return jsonb_build_object('ok', false);
  end if;

  select id, venue_id, client_id, event_id, title into v_id, v_venue, v_client_id, v_event_id, v_title
  from public.contracts
  where sign_token = p_token and status = 'sent';

  if v_id is null then return jsonb_build_object('ok', false); end if;

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

  -- New this migration — the actual fix: alert the coordinator, not just
  -- the activity log. Uses the venue's own existing notification
  -- preferences (unrecognized type 'contract_signed' defaults to enabled,
  -- same as every other type not yet given its own preference toggle).
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

notify pgrst, 'reload schema';
