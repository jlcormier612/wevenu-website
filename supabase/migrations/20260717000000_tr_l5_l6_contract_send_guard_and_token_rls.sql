-- ============================================================================
-- TR-L5 — sendContract/cancelContract have no status guard, allowing a
--   signed contract to be silently re-armed for a second signature.
-- TR-L6 — contracts_sign_read grants anonymous SELECT on ANY sent/signed
--   contract platform-wide (no sign_token check at the RLS layer) — the
--   token is only enforced in application-level query filters, which a
--   direct REST call can bypass entirely.
-- Resolves docs/trust-risk-register.md TR-L5, TR-L6.
-- ============================================================================

-- ---- TR-L6: remove the permissive anon policy; replace anonymous reads
-- with a SECURITY DEFINER RPC that validates the token server-side, the
-- same pattern already used by get_portal_context/get_portal_payments/
-- sign_contract. Authenticated venue-staff reads (contracts_select) are
-- untouched.
drop policy if exists contracts_sign_read on public.contracts;

create or replace function public.get_contract_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select
    c.id, c.venue_id, c.client_id, c.event_id, c.template_id, c.title, c.content, c.status,
    c.sign_token, c.signer_name, c.signed_at, c.sent_at, c.expires_at, c.created_at, c.updated_at,
    cl.first_name as client_first_name, cl.last_name as client_last_name,
    cl.partner_first_name as client_partner_first_name, cl.partner_last_name as client_partner_last_name,
    e.event_date
  into v
  from public.contracts c
  left join public.clients cl on cl.id = c.client_id
  left join public.events e on e.id = c.event_id
  where c.sign_token = p_token;

  if v.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v.id, 'venue_id', v.venue_id, 'client_id', v.client_id, 'event_id', v.event_id,
    'template_id', v.template_id, 'title', v.title, 'content', v.content, 'status', v.status,
    'sign_token', v.sign_token, 'signer_name', v.signer_name, 'signed_at', v.signed_at,
    'sent_at', v.sent_at, 'expires_at', v.expires_at, 'created_at', v.created_at, 'updated_at', v.updated_at,
    'clients', case when v.client_first_name is not null then jsonb_build_object(
      'first_name', v.client_first_name, 'last_name', v.client_last_name,
      'partner_first_name', v.client_partner_first_name, 'partner_last_name', v.client_partner_last_name
    ) else null end,
    'events', case when v.event_date is not null then jsonb_build_object('event_date', v.event_date) else null end
  );
end;
$$;

grant execute on function public.get_contract_by_token(uuid) to anon, authenticated;
