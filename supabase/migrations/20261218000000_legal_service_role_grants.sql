-- Legal Acceptance Engine + portal/welcome APIs use the service-role client
-- (bypass RLS). Table privileges are still required — these tables were only
-- granted to anon/authenticated, so couple Welcome document load + acceptance
-- inserts failed with "permission denied for table legal_documents".

grant select, insert, update, delete on public.legal_documents to service_role;
grant select, insert, update, delete on public.legal_acceptances to service_role;

notify pgrst, 'reload schema';
