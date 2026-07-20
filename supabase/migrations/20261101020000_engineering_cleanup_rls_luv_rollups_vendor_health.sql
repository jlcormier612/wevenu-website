-- ============================================================================
-- Engineering Cleanup — enable RLS on public.luv_rollups and
-- public.vendor_health_scores
--
-- docs/release-readiness-status.md §3 item 1. Both tables were flagged
-- repeatedly by `supabase db query --local`'s own security advisory output
-- as RLS-disabled and anon-exposed, and never fixed in any of the sessions
-- that surfaced it. Closing both here, deliberately scoped to exactly this
-- (enable RLS + a correctly-scoped policy) — no application-code behavior
-- change, since every real read/write path already goes through a
-- SECURITY DEFINER RPC or an already-authenticated session that these
-- policies match.
--
-- luv_rollups: every real access already goes through save_luv_rollup()/
-- get_luv_rollups() (both SECURITY DEFINER, 20260712100000), which bypass
-- RLS as the defining role — this policy is a real defense-in-depth
-- backstop matching the RPCs' own venue-scoping logic (current_user_
-- venue_id(), the modern staff-inclusive helper — the RPCs themselves
-- still use the older owner_user_id-only check; that's a separate,
-- pre-existing gap, out of scope here and not touched).
--
-- vendor_health_scores: read via lib/vendor-health/service.ts's
-- getVendorHealthScore (cookie-session client, no RPC) from the vendor's
-- own dashboard/profile/availability/luv pages, and written by the same
-- session on cache-miss (computeVendorHealthScore's upsert). Policy
-- shape copied exactly from vendor_packages/vendor_availability
-- (20260706110000_sprint104_5_vendor_foundation.sql) — the two tables
-- this one is structurally closest to: a related venue may SELECT, any
-- active vendor_users member (any role — this is a system-computed score,
-- not a role-gated edit, and any logged-in vendor role's page load can
-- trigger the recompute/upsert) may read and write their own vendor's row.
-- ============================================================================

alter table public.luv_rollups enable row level security;

create policy luv_rollups_venue_select
  on public.luv_rollups for select
  using (venue_id = public.current_user_venue_id());

grant select on public.luv_rollups to authenticated;

alter table public.vendor_health_scores enable row level security;

create policy venues_see_vendor_health_scores
  on public.vendor_health_scores for select
  using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      join public.venues v on v.id = vvr.venue_id
      where vvr.vendor_id = vendor_health_scores.vendor_id
        and vvr.status != 'removed'
        and v.owner_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_health_scores.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

create policy vendor_users_manage_health_score
  on public.vendor_health_scores for all
  using (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_health_scores.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.vendor_users vu
      where vu.vendor_id = vendor_health_scores.vendor_id
        and vu.user_id = auth.uid()
        and vu.is_active = true
    )
  );

grant select, insert, update, delete on public.vendor_health_scores to authenticated;
