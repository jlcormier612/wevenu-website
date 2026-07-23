-- ============================================================================
-- Venue Payment Processing (Stripe Connect Standard) — Phase B: portal
-- checkout context.
--
-- Mirrors get_portal_payments()'s token-validation shape exactly. The
-- actual Stripe API call (creating the Checkout Session) can't happen
-- inside a plain SQL function, so this RPC only validates the token and
-- the item ownership and returns what the server action needs — the write
-- of stripe_checkout_session_id back onto the item happens afterward via
-- the admin client (lib/stripe/checkout.ts), the same "validate via RPC,
-- external call, write back" shape the QuickBooks sync queue already uses.
--
-- 'view_only' access is explicitly read-only (per client_portal_sessions'
-- own comment) — blocked here, same as 'planning' has no payments at all.
-- ============================================================================

create or replace function public.get_portal_checkout_context(p_token text, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_item    public.payment_line_items%rowtype;
  v_venue   public.venues%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.access_level not in ('couple', 'financial') then
    return jsonb_build_object('error', 'not_permitted');
  end if;

  select pli.* into v_item
  from public.payment_line_items pli
  join public.payment_schedules ps on ps.id = pli.schedule_id
  where pli.id = p_item_id
    and ps.client_id = v_session.client_id
    and pli.venue_id = v_session.venue_id;

  if v_item.id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_item.status not in ('pending', 'overdue') then
    return jsonb_build_object('error', 'not_payable');
  end if;

  select * into v_venue from public.venues where id = v_session.venue_id;

  if v_venue.stripe_account_id is null or v_venue.stripe_onboarding_status != 'connected' then
    return jsonb_build_object('error', 'stripe_not_connected');
  end if;

  return jsonb_build_object(
    'venueId',      v_venue.id,
    'clientId',     v_session.client_id,
    'stripeAccountId', v_venue.stripe_account_id,
    'chargesEnabled',  v_venue.stripe_charges_enabled,
    'acceptedPaymentMethods', to_jsonb(v_venue.stripe_accepted_payment_methods),
    'itemId',       v_item.id,
    'itemLabel',    v_item.label,
    'itemAmount',   v_item.amount,
    'scheduleId',   v_item.schedule_id,
    'invoiceId',    (select ps.invoice_id from public.payment_schedules ps where ps.id = v_item.schedule_id)
  );
end;
$$;

grant execute on function public.get_portal_checkout_context(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
