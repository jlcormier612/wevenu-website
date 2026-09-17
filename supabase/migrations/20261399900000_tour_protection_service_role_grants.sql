-- ============================================================================
-- Tour Protection — service_role table privileges.
--
-- 202613996 created tour_protection_requests with RLS and authenticated
-- select/update only. Staging inserts, Stripe session updates, and webhook
-- completion use the service-role admin client, which PostgreSQL will not
-- allow without explicit table grants (RLS bypass is not a substitute).
-- Public/anon remain unggranted. Authenticated privileges are unchanged.
-- ============================================================================

grant select, insert, update on public.tour_protection_requests to service_role;

notify pgrst, 'reload schema';
