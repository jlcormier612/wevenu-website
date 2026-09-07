-- Public Booking Journey offer page loads/accepts via createAdminClient()
-- (service_role) calling SECURITY DEFINER token-scoped RPCs.
--
-- 20261343000000 granted execute to anon + authenticated only. Without
-- service_role, PostgREST returns a permission error, getOfferByToken
-- returns null, and /offer/{token} 404s — even when the token is valid.
--
-- Keep SECURITY DEFINER + accept_token scoping unchanged. Grant the
-- intended server-side caller (service_role) execute alongside the
-- existing anon/authenticated grants (direct browser RPC remains possible).

grant execute on function public.get_commercial_selection_by_accept_token(text)
  to service_role;

grant execute on function public.accept_commercial_selection(text)
  to service_role;

notify pgrst, 'reload schema';
