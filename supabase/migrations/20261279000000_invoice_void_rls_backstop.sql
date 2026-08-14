-- ============================================================================
-- Release Readiness Reconciliation — Invoice void RLS backstop
--
-- lib/invoices/service.ts::updateInvoiceStatus already gates the "void"
-- transition to Owner/Manager at the app layer (Work Package D8), but
-- invoices_update's RLS has no role clause at all — voiding is the one
-- transition with a real, permanent consequence (an invoice taken off the
-- books), the exact same weight class TR-G5 already closed for refunds on
-- payment_line_items. Every other legitimate invoice write (recomputing
-- totals after a line-item edit, sending, reverting to draft, linking an
-- Event Order, the payment-collection auto-transition to 'paid') is
-- unaffected — none of them ever set status = 'void', confirmed by direct
-- repo-wide search (the only writer of that value is the app-layer-checked
-- call site this migration backstops).
--
-- Same shape as 20261001000000_tr_g5_refund_rls_backstop.sql: the existing
-- UPDATE policy's WITH CHECK already runs against the resulting row, so one
-- added condition closes the direct-API bypass without touching any other
-- write path.
-- ============================================================================

drop policy invoices_update on public.invoices;

create policy invoices_update on public.invoices for update
  using (venue_id = current_user_venue_id())
  with check (
    venue_id = current_user_venue_id()
    and (status <> 'void' or current_user_role() in ('owner', 'manager'))
  );
