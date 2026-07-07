-- ============================================================================
-- Sprint 105 — Vendor Portal MVP
-- "Vendors get an authenticated, self-managed business portal"
--
-- Additions on top of Sprint 104.5:
--   1. accepting_inquiries flag + availability_notes on vendors
--   2. get_vendor_by_claim_token()  — security-definer, called pre-auth from accept page
--   3. get_invitation_preview()     — security-definer, resolves invitation token → venue + vendor names
-- ============================================================================

-- ── STEP 1: New fields on vendors ─────────────────────────────────────────────

alter table public.vendors
  add column if not exists accepting_inquiries boolean not null default true,
  add column if not exists availability_notes  text;

-- ── STEP 2: get_vendor_by_claim_token ────────────────────────────────────────
-- Allows the /vendor/accept page to preview vendor details before the visitor
-- is authenticated. SECURITY DEFINER bypasses RLS (claim_token is the secret).
-- Returns null when token is invalid or already claimed.

create or replace function public.get_vendor_by_claim_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  r record;
begin
  select id, business_name, category
  into r
  from public.vendors
  where claim_token = p_token
    and is_claimed = false;

  if not found then return null; end if;

  return jsonb_build_object(
    'id',           r.id,
    'businessName', r.business_name,
    'category',     r.category
  );
end $$;

grant execute on function public.get_vendor_by_claim_token(text) to anon, authenticated;

-- ── STEP 3: get_invitation_preview ────────────────────────────────────────────
-- Resolves a vendor_invitations token to venue + vendor names for the accept page.
-- Returns null when token is invalid, expired, or already accepted/revoked.

create or replace function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_inv    public.vendor_invitations%rowtype;
  v_biz    text;
  v_venue  text;
begin
  select * into v_inv
  from public.vendor_invitations
  where token = p_token
    and status = 'pending'
    and expires_at > now();

  if not found then return null; end if;

  select business_name into v_biz
  from public.vendors where id = v_inv.vendor_id;

  select name into v_venue
  from public.venues where id = v_inv.venue_id;

  return jsonb_build_object(
    'invitationId', v_inv.id,
    'venueId',      v_inv.venue_id,
    'venueName',    coalesce(v_venue, 'your venue'),
    'vendorId',     v_inv.vendor_id,
    'vendorName',   coalesce(v_biz, 'your business'),
    'email',        v_inv.email
  );
end $$;

grant execute on function public.get_invitation_preview(text) to anon, authenticated;
