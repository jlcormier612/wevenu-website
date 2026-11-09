-- ============================================================================
-- Phase 1B — RLS lock-down for SaaS pricing tables created in
-- 20270109120000_saas_pricing_phase1a.sql.
--
-- Service-role only. No anon/authenticated access.
-- RLS enabled with zero policies (access via service-role bypass only).
-- ============================================================================

alter table public.saas_price_versions enable row level security;
alter table public.saas_checkout_offers enable row level security;
alter table public.saas_offer_grants enable row level security;
alter table public.saas_offer_applications enable row level security;
alter table public.weven_claims enable row level security;

revoke all on table public.saas_price_versions from authenticated, anon;
revoke all on table public.saas_checkout_offers from authenticated, anon;
revoke all on table public.saas_offer_grants from authenticated, anon;
revoke all on table public.saas_offer_applications from authenticated, anon;
revoke all on table public.weven_claims from authenticated, anon;

grant all on table public.saas_price_versions to service_role;
grant all on table public.saas_checkout_offers to service_role;
grant all on table public.saas_offer_grants to service_role;
grant all on table public.saas_offer_applications to service_role;
grant all on table public.weven_claims to service_role;
