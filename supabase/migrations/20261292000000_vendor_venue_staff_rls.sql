-- ============================================================================
-- Vendor Manager RLS gap — venue-wide staff access on public.vendors.
--
-- Spec: docs/vendor-manager-rls-gap-implementation-specification.md
--
-- Three policies still checked venues.owner_user_id = auth.uid(), blocking
-- Manager/Staff who share the venue via current_user_venue_id().
-- Copy the already-shipped venues_see_vendor_team shape (join through
-- venue_vendor_relationships; compare vvr.venue_id = current_user_venue_id()).
--
-- Change ONLY these three policies. No GRANTs, no vendor_reviews, no helpers.
-- ============================================================================

-- SELECT: same shape as venues_see_vendor_team; preserve vendor self-access.
drop policy if exists "venues_select_related_vendors" on public.vendors;

create policy "venues_select_related_vendors" on public.vendors
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      where vvr.vendor_id = vendors.id
        and vvr.status <> 'inactive'
        and vvr.venue_id = public.current_user_venue_id()
    )
    or id = current_user_vendor_id()
  );

-- UPDATE: same transformation; preserve is_claimed = false gate on both sides.
drop policy if exists "venues_update_unclaimed_vendors" on public.vendors;

create policy "venues_update_unclaimed_vendors" on public.vendors
  for update
  using (
    is_claimed = false and exists (
      select 1 from public.venue_vendor_relationships vvr
      where vvr.vendor_id = vendors.id
        and vvr.status <> 'inactive'
        and vvr.venue_id = public.current_user_venue_id()
    )
  )
  with check (
    is_claimed = false and exists (
      select 1 from public.venue_vendor_relationships vvr
      where vvr.vendor_id = vendors.id
        and vvr.status <> 'inactive'
        and vvr.venue_id = public.current_user_venue_id()
    )
  );

-- INSERT: no relationship row yet — require a resolved venue context.
drop policy if exists "venues_insert_vendors" on public.vendors;

create policy "venues_insert_vendors" on public.vendors
  for insert
  with check (public.current_user_venue_id() is not null);
