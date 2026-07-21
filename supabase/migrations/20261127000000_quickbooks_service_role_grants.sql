-- ============================================================================
-- QuickBooks Online Launch Integration — Phase B follow-up.
--
-- Found live, not assumed: the sync processor (service_role, no user
-- session, mirroring lib/scheduled-messages/processor.ts) needs to write
-- quickbooks_sync_status/quickbooks_*_id back onto clients/invoices/
-- payment_line_items after every real sync attempt. None of these three
-- pre-existing tables grant service_role UPDATE (invoices doesn't even
-- grant SELECT) — confirmed via information_schema.role_table_grants
-- after a real dead-letter test left a client's quickbooks_sync_status
-- silently stuck at 'not_synced' instead of advancing to 'failed'.
--
-- Same hazard class already found and fixed twice this engagement
-- (vendor_inquiries/vendor_tasks, Sprint 2): RLS bypass via rolbypassrls
-- does not imply table privileges — a service-role client still needs an
-- explicit GRANT.
-- ============================================================================

grant select, update on public.clients             to service_role;
grant select, update on public.invoices            to service_role;
grant select, update on public.payment_line_items  to service_role;

notify pgrst, 'reload schema';
