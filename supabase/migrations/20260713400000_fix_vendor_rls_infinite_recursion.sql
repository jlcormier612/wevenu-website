-- Fix: "infinite recursion detected in policy for relation
-- venue_vendor_relationships"
--
-- Pre-existing bug from Sprint 104.5, never caught before because these
-- tables were never actually queried through PostgREST until this beta-
-- readiness pass caught the DB up on its migration backlog. Reproduced by
-- simulating the exact embedded query the vendor list uses
-- (venue_vendor_relationships joined to vendors) as the `authenticated`
-- role.
--
-- The cycle: venue_vendor_relationships."vendors_see_own_relationships"
-- queries vendor_users -> vendor_users."venues_see_vendor_team" queries
-- venue_vendor_relationships again -> back to
-- "vendors_see_own_relationships" -> ... infinite.
--
-- Fix: the same pattern already used for current_user_venue_id() — a
-- stable SECURITY DEFINER helper that reads vendor_users once, bypassing
-- RLS internally, so no policy ever needs to re-evaluate another
-- RLS-protected table's policies to answer "which vendor does this user
-- belong to." Every raw `exists (select 1 from vendor_users ...)` subquery
-- in another table's policy is replaced with a call to this helper.

create or replace function public.current_user_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select vendor_id from public.vendor_users
  where user_id = auth.uid() and is_active = true
  limit 1;
$$;

create or replace function public.current_user_vendor_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.vendor_users
  where user_id = auth.uid() and is_active = true
  limit 1;
$$;

grant execute on function public.current_user_vendor_id() to authenticated;
grant execute on function public.current_user_vendor_role() to authenticated;

-- ── vendors ────────────────────────────────────────────────────────────────

drop policy if exists "venues_select_related_vendors" on public.vendors;
create policy "venues_select_related_vendors" on public.vendors
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendors.id
        and vvr.status != 'removed'
        and v.owner_user_id = auth.uid()
    )
    or vendors.id = public.current_user_vendor_id()
  );

drop policy if exists "vendor_users_update_profile" on public.vendors;
create policy "vendor_users_update_profile" on public.vendors
  for update using (
    vendors.id = public.current_user_vendor_id()
    and public.current_user_vendor_role() in ('owner', 'manager')
  );

-- ── vendor_users ─────────────────────────────────────────────────────────────

drop policy if exists "vendor_users_see_own_team" on public.vendor_users;
create policy "vendor_users_see_own_team" on public.vendor_users
  for select using (vendor_users.vendor_id = public.current_user_vendor_id());

drop policy if exists "vendor_owners_manage_team" on public.vendor_users;
create policy "vendor_owners_manage_team" on public.vendor_users
  for all using (
    vendor_users.vendor_id = public.current_user_vendor_id()
    and public.current_user_vendor_role() in ('owner', 'manager')
  );

-- "venues_see_vendor_team" is left as-is — it only reads
-- venue_vendor_relationships + venues, neither of which reference
-- vendor_users anymore after the fix below, so it's no longer part of any
-- cycle.

-- ── venue_vendor_relationships ────────────────────────────────────────────

drop policy if exists "vendors_see_own_relationships" on public.venue_vendor_relationships;
create policy "vendors_see_own_relationships" on public.venue_vendor_relationships
  for select using (venue_vendor_relationships.vendor_id = public.current_user_vendor_id());

notify pgrst, 'reload schema';
