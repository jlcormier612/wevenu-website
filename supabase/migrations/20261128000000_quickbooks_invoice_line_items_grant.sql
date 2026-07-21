-- ============================================================================
-- QuickBooks Online Launch Integration — Phase C follow-up.
--
-- Found live, not assumed: syncInvoice() (lib/quickbooks/sync/invoice.ts)
-- reads invoice_line_items via the service_role admin client to build the
-- QBO Invoice's Line array. A real dead-letter test against a live invoice
-- with a real line item row came back "Invoice has no line items to sync"
-- even though the row existed — service_role had no SELECT grant on
-- invoice_line_items at all (confirmed via information_schema.role_table_
-- grants), so PostgREST silently returned zero rows before RLS was ever
-- evaluated.
--
-- Same hazard class already found and fixed three times this engagement
-- (vendor_inquiries/vendor_tasks in Sprint 2; clients/invoices/
-- payment_line_items in QuickBooks Phase B): RLS bypass via rolbypassrls
-- does not imply table privileges — a service-role client still needs an
-- explicit GRANT.
-- ============================================================================

grant select on public.invoice_line_items to service_role;

notify pgrst, 'reload schema';
