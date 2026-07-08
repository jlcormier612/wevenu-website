-- ============================================================================
-- TR-G3 — venue_users compatibility view ignores staff deactivation
-- Resolves docs/trust-risk-register.md TR-G3. venue_users (a compatibility
-- view over venue_staff, used by RLS/RPCs across ~a dozen subsystems added
-- from Sprint 72 onward — budget, RSVP, seating, couple documents, venue
-- operational info, feedback, Luv) hardcoded `true as is_active` for every
-- row, regardless of the real venue_staff.is_active flag. A team member
-- removed via removeStaffMember() (which correctly sets is_active = false)
-- kept full access to every venue_users-gated table indefinitely.
-- ============================================================================

create or replace view public.venue_users as
  select
    id,
    venue_id,
    user_id,
    role,
    is_active
  from public.venue_staff
  where user_id is not null;

grant select on public.venue_users to authenticated;
