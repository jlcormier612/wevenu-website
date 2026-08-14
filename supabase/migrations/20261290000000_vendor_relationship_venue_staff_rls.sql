-- ============================================================================
-- Vendor remediation — venue-wide staff RLS for vendor relationships.
--
-- P0 from docs/vendor-lifecycle-status-truth-audit.md Finding 4:
-- venues_manage_relationships and venues_see_vendor_team still checked
-- venues.owner_user_id = auth.uid(), blocking Manager/Staff who share the
-- venue via current_user_venue_id() (Sprint 107 pattern).
--
-- Change ONLY these two policies to the established venue-wide staff pattern.
-- No other Vendor RLS, roles, or current_user_venue_id() itself are modified.
-- ============================================================================

-- venue_vendor_relationships: direct venue_id column — same pattern as
-- event_questionnaires_all / packages / inventory after Sprint 107.
drop policy if exists "venues_manage_relationships" on public.venue_vendor_relationships;

create policy "venues_manage_relationships" on public.venue_vendor_relationships
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- vendor_users: no venue_id on the row — keep the existing join through
-- venue_vendor_relationships, but authorize via current_user_venue_id()
-- instead of owner_user_id. Preserve the inactive-status filter from
-- 20260723000000_vendor_relationship_lifecycle.sql.
drop policy if exists "venues_see_vendor_team" on public.vendor_users;

create policy "venues_see_vendor_team" on public.vendor_users
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      where vvr.vendor_id = vendor_users.vendor_id
        and vvr.status <> 'inactive'
        and vvr.venue_id = public.current_user_venue_id()
    )
  );
