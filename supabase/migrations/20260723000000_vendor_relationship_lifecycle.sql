-- ============================================================================
-- Vendor Relationship Lifecycle — One Fact, One Owner
--
-- Implements the approved Vendor Domain Model (docs/vendor-domain-model-review.md)
-- and Vendor Relationship Lifecycle (docs/vendor-relationship-lifecycle.md):
-- Relationship becomes the sole authoritative owner of the vendor lifecycle;
-- Invitation becomes purely historical; Identity stays vendor-owned with pricing
-- kept vendor-side per explicit product decision, with a venue-flaggable special
-- pricing/promotion note layered on top rather than making pricing itself
-- per-venue.
--
-- Refinement made during implementation, surfaced rather than silently applied:
-- the lifecycle doc proposed a 4-value status (invited/active/preferred/inactive).
-- Implementing it surfaced that `preference_level` already spans every active
-- vendor today (not gated behind a separate flag) and already drives portal
-- ranking — adding 'preferred' as a *status* value would recreate exactly the
-- two-fields-one-concept problem this migration exists to remove. Resolution:
-- status stays a 3-value lifecycle (invited/active/inactive); preference_level
-- alone remains the "how prominently featured" ranking, unchanged in meaning.
-- `is_preferred` is dropped as a derived convenience only (Standard #1) rather
-- than kept as a second independently-writable fact.
-- ============================================================================

-- ── STEP 1: special_pricing_note — the venue-flaggable discount/promo layer ──
-- pricing_tier itself stays on vendors (vendor-owned, see STEP 4). This is the
-- one thing that IS venue-specific: "20% off for repeat bookings," a
-- relationship-specific rate, or any other note a venue wants to flag.

alter table public.venue_vendor_relationships
  add column special_pricing_note text;

-- ── STEP 2: collapse status — backfill before dropping is_active/is_preferred ─

update public.venue_vendor_relationships
set status = case
  when is_active = false or status = 'removed' then 'inactive'
  when status = 'preferred' then 'active'   -- preference_level already carries this distinction
  else status
end;

alter table public.venue_vendor_relationships drop constraint if exists venue_vendor_relationships_status_check;
alter table public.venue_vendor_relationships
  add constraint venue_vendor_relationships_status_check check (status in ('invited', 'active', 'inactive'));
alter table public.venue_vendor_relationships alter column status set default 'active';

alter table public.venue_vendor_relationships drop column is_active;
alter table public.venue_vendor_relationships drop column is_preferred;

-- Replace the is_active-keyed index with the equivalent status-keyed one.
drop index if exists public.vvr_venue_active_pref;
create index vvr_venue_active_pref on public.venue_vendor_relationships (venue_id, preference_level, display_order)
  where status != 'inactive';

-- ── STEP 3: update every live reader of the old is_active / 'removed' values ──
-- (Standard #7 — a superseded representation gets every reader updated in the
-- same change, not left as a follow-up.)

alter policy "venues_select_related_vendors" on public.vendors
  using (
    (exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendors.id and vvr.status <> 'inactive' and v.owner_user_id = auth.uid()
    )) or (id = current_user_vendor_id())
  );

alter policy "venues_see_vendor_packages" on public.vendor_packages
  using (
    (exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_packages.vendor_id and vvr.status <> 'inactive' and v.owner_user_id = auth.uid()
    )) or (exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_packages.vendor_id and vu.user_id = auth.uid() and vu.is_active = true
    ))
  );

alter policy "venues_see_vendor_availability" on public.vendor_availability
  using (
    (exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_availability.vendor_id and vvr.status <> 'inactive' and v.owner_user_id = auth.uid()
    )) or (exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_availability.vendor_id and vu.user_id = auth.uid() and vu.is_active = true
    ))
  );

alter policy "venues_see_vendor_team" on public.vendor_users
  using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_users.vendor_id and vvr.status <> 'inactive' and v.owner_user_id = auth.uid()
    )
  );

create or replace function public.get_portal_vendors(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_session_venue_id uuid;
  v_vendors jsonb;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());

  if v_session_venue_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.venue_id = v_session_venue_id
  ) then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',              vnd.id,
      'name',            vnd.business_name,
      'category',        vnd.category,
      'preferenceLevel', vvr.preference_level,
      'description',     vnd.description,
      'photoUrl',        vnd.logo_url,
      'websiteUrl',      vnd.website_url,
      'instagramUrl',    vnd.instagram_url,
      'pricingTier',     vnd.pricing_tier,
      'email',           vnd.email
    ) order by
      case vvr.preference_level when 'featured' then 1 when 'preferred' then 2 else 3 end,
      vvr.display_order,
      vnd.business_name
  ), '[]'::jsonb) into v_vendors
  from public.vendors vnd
  join public.venue_vendor_relationships vvr
    on vvr.vendor_id = vnd.id and vvr.venue_id = v_session_venue_id
  where vvr.status != 'inactive';

  return jsonb_build_object('vendors', coalesce(v_vendors, '[]'::jsonb));
end $$;

-- ── STEP 4: vendors.is_claimed becomes trigger-maintained, not manually set ──
-- Identity's claim state is now recomputed from vendor_users on every write to
-- it (Standard #1) rather than a second fact claim_vendor_profile() sets by
-- hand — the same discipline already applied to invoice balances.

create or replace function public.sync_vendor_claimed_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  update public.vendors
  set is_claimed = exists (
    select 1 from public.vendor_users
    where vendor_id = v_vendor_id and is_active = true
  )
  where id = v_vendor_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists vendor_users_sync_claimed_status on public.vendor_users;
create trigger vendor_users_sync_claimed_status
  after insert or update or delete on public.vendor_users
  for each row execute function public.sync_vendor_claimed_status();

-- ── STEP 5: claim_vendor_profile — Relationship + Invitation both advance ────
-- Finding 1 (docs/vendor-relationship-lifecycle.md): claiming a profile never
-- advanced the relationship past 'invited', and never marked the invitation
-- accepted — which also meant lib/hq/support-service.ts's "stuck invite"
-- detector could flag vendors who had, in fact, fully claimed their profile.

create or replace function public.claim_vendor_profile(
  p_claim_token text,
  p_role        text default 'owner'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_vendor  public.vendors%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if p_role not in ('owner', 'manager', 'staff', 'contractor') then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;

  select * into v_vendor from public.vendors
  where claim_token = p_claim_token and is_claimed = false;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_already_claimed');
  end if;

  insert into public.vendor_users (vendor_id, user_id, role, accepted_at)
  values (v_vendor.id, v_user_id, p_role, now())
  on conflict (vendor_id, user_id) do update set is_active = true, role = excluded.role, accepted_at = now();
  -- vendors.is_claimed is now recomputed by the trigger above — no manual update needed.

  update public.vendors set claim_token = null where id = v_vendor.id;

  -- Relationship is the authoritative lifecycle owner: advance every invited
  -- relationship for this vendor to active now that they've claimed.
  update public.venue_vendor_relationships
  set status = 'active'
  where vendor_id = v_vendor.id and status = 'invited';

  -- Invitation becomes historical: mark matching pending invitations accepted
  -- so nothing outside the invitation flow ever needs to infer this from status.
  update public.vendor_invitations
  set status = 'accepted', accepted_at = now()
  where vendor_id = v_vendor.id and status = 'pending';

  -- Create default notification preferences for the newly claimed vendor
  insert into public.vendor_notification_preferences (vendor_id) values (v_vendor.id)
  on conflict (vendor_id) do nothing;

  return jsonb_build_object(
    'ok',            true,
    'vendor_id',     v_vendor.id,
    'already_vendor', exists (
      select 1 from public.vendor_users
      where user_id = v_user_id and vendor_id != v_vendor.id and is_active = true
    )
  );
end $$;

-- ── STEP 6: venues may edit identity fields only while the vendor is unclaimed ─
-- A venue-created vendor record is provisional until the vendor claims it —
-- until then, the venue is the only steward and should be able to fix a typo.
-- Once claimed, identity becomes the vendor's own (vendor_users_update_profile
-- already covers that) and the venue-side edit control is removed in the UI.

create policy "venues_update_unclaimed_vendors" on public.vendors
  for update
  using (
    is_claimed = false
    and exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendors.id and vvr.status <> 'inactive' and v.owner_user_id = auth.uid()
    )
  )
  with check (
    is_claimed = false
    and exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendors.id and vvr.status <> 'inactive' and v.owner_user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
