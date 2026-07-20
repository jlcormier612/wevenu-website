-- ============================================================================
-- TR-G5 — Refund RLS backstop
--
-- Manager Permissions Architecture Remediation (docs/manager-permissions-
-- architecture-remediation-plan.md). refundLineItem_ (lib/payments/service.ts)
-- is the only owner-only check on a refund, and it's app-layer only —
-- payment_line_items_update's RLS has no role clause. Live-tested during the
-- Manager Permissions Release Readiness audit: a real Manager account issued
-- a refund via a raw PATCH against the table directly, bypassing
-- refundLineItem_ entirely.
--
-- Fix: the existing UPDATE policy's WITH CHECK already runs against the
-- resulting row, so one added condition closes the gap without touching any
-- other legitimate update (recording a payment, editing a due date, adding a
-- note) — a non-owner may update a payment_line_items row for any reason
-- except landing it in status = 'refunded'.
--
-- payment_schedules carries no refund state of its own (refunded_amount/
-- refunded_at/refund_reason/status='refunded' all live only on
-- payment_line_items), so no equivalent change is needed there.
-- ============================================================================

drop policy payment_line_items_update on public.payment_line_items;

create policy payment_line_items_update on public.payment_line_items for update
  using (venue_id = current_user_venue_id())
  with check (
    venue_id = current_user_venue_id()
    and (status <> 'refunded' or current_user_role() = 'owner')
  );
