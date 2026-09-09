/**
 * Portal payment-schedule canonicalization.
 *
 * Booking Financial Architecture (Decision 5): one Payment Plan per Invoice.
 * When duplicate schedules share an invoice_id (seed re-application, accidental
 * re-create), portal surfaces must show ONE obligation set / ONE remaining
 * balance — never sum every overlapping schedule.
 *
 * Schedules for different invoices (legitimately distinct plans) and
 * grandfathered schedules with no invoice_id stay distinct.
 */

import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";

export type PortalPaymentLineItem = {
  id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
  paidAmount?: number | null;
  refundedAmount?: number | null;
};

export type PortalPaymentScheduleLike = {
  id: string;
  title: string;
  invoiceId?: string | null;
  createdAt?: string | null;
  totalAmount?: number;
  lineItems: PortalPaymentLineItem[];
};

/** Newest schedule wins when multiple rows share the same invoice_id. */
export function selectCanonicalPaymentSchedules<T extends PortalPaymentScheduleLike>(
  schedules: T[],
): T[] {
  const byKey = new Map<string, T>();

  // Prefer highest createdAt; when equal / missing, keep first-seen stable then
  // allow a later higher id to break ties deterministically for tests.
  const ranked = [...schedules].sort((a, b) => {
    const ac = a.createdAt ?? "";
    const bc = b.createdAt ?? "";
    if (ac !== bc) return bc.localeCompare(ac);
    return b.id.localeCompare(a.id);
  });

  for (const s of ranked) {
    const key = s.invoiceId ? `invoice:${s.invoiceId}` : `schedule:${s.id}`;
    if (!byKey.has(key)) byKey.set(key, s);
  }

  // Preserve a stable presentation order: newest createdAt first (matches RPC).
  return [...byKey.values()].sort((a, b) => {
    const ac = a.createdAt ?? "";
    const bc = b.createdAt ?? "";
    if (ac !== bc) return bc.localeCompare(ac);
    return b.id.localeCompare(a.id);
  });
}

/** Unpaid remaining across canonical schedules — refund-net, cancelled excluded. */
export function remainingBalanceFromSchedules(
  schedules: PortalPaymentScheduleLike[],
): number {
  const canonical = selectCanonicalPaymentSchedules(schedules);
  return canonical.reduce(
    (sum, s) => sum + computePortalScheduleTotals(s.lineItems).remaining,
    0,
  );
}
