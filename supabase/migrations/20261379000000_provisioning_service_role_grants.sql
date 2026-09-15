-- ============================================================================
-- Service-role grants for product workspace provisioning (White Glove + Self-Setup)
--
-- Cold POST /api/internal/enrollment/provision uses createAdminClient()
-- (service_role). Historical grants only covered SELECT (and later UPDATE) on
-- venues / venue_staff, so venue INSERT failed with:
--   permission denied for table venues
--
-- This migration grants the minimum DML required by:
--   lib/provisioning/workspace.ts
--   lib/provisioning/starters.ts (message_sequences / sequence_steps)
--   lib/onboarding/white-glove-handoff.ts (engagement update + hq task alert)
--
-- Does NOT grant to anon/authenticated/PUBLIC. RLS is unchanged; service_role
-- already bypasses RLS — table GRANTs are the gate.
-- ============================================================================

-- Core venue creation + owner linkage
grant select, insert, update on public.venues to service_role;
grant select, insert, update on public.venue_staff to service_role;

-- White Glove engagement row (provision upsert + Finish handoff update)
grant select, insert, update on public.venue_onboarding_engagements to service_role;

-- HQ alert tasks (provision starter failures + Finish email failure blocker)
grant select, insert, update on public.venue_hq_tasks to service_role;

-- Starter automations (seedWorkspaceStarters → message sequences)
-- SELECT already granted in 20261177000000; INSERT/UPDATE required to seed.
grant select, insert, update on public.message_sequences to service_role;
grant select, insert, update, delete on public.sequence_steps to service_role;
