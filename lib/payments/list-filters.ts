/**
 * Payments list filters — Contracts-pattern filter row.
 * Authoritative keys derive from scheduleStatus + paid/balance amounts
 * (payment_schedules + payment_line_items aggregates), not sales pipeline.
 */
import type { PaymentScheduleSummary } from "@/lib/payments/types";

export type PaymentListFilterKey =
  | "all"
  | "action_required"
  | "on_track"
  | "partially_paid"
  | "paid_in_full"
  | "no_payments";

/**
 * Order is product-locked: All first, then Action Required, then lifecycle statuses.
 */
export const PAYMENT_LIST_FILTERS: { value: PaymentListFilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "action_required", label: "Action Required" },
  { value: "on_track", label: "On Track" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid_in_full", label: "Paid in Full" },
  { value: "no_payments", label: "No Payments" },
];

/** Default: All — ordinary/current/paid plans must be discoverable without a toggle. */
export const DEFAULT_PAYMENT_LIST_FILTER: PaymentListFilterKey = "all";

/** Needs venue attention: overdue / refunded / partially refunded (exclude reporting-excluded). */
export function isVenueActionRequiredSchedule(s: PaymentScheduleSummary): boolean {
  return s.scheduleStatus === "attention" && !s.excludeFromBusinessReporting;
}

/** Money received and balance remains — authoritative from aggregates. */
export function isPartiallyPaidSchedule(s: PaymentScheduleSummary): boolean {
  return s.totalPaid > 0.009 && s.balance > 0.009;
}

export function paymentScheduleFilterKey(
  s: PaymentScheduleSummary,
): Exclude<PaymentListFilterKey, "all" | "action_required"> {
  if (s.scheduleStatus === "complete") return "paid_in_full";
  if (s.scheduleStatus === "no_payments") return "no_payments";
  if (isPartiallyPaidSchedule(s)) return "partially_paid";
  return "on_track";
}

export function paymentMatchesListFilter(
  s: PaymentScheduleSummary,
  filter: PaymentListFilterKey,
): boolean {
  if (filter === "all") return true;
  if (filter === "action_required") return isVenueActionRequiredSchedule(s);
  // Overdue / refunded plans are Action Required. They are not On Track,
  // even when no money has been received yet. Partially paid stays in
  // Partially Paid (and also Action Required when a line is overdue).
  if (filter === "on_track") {
    return s.scheduleStatus === "on_track" && !isPartiallyPaidSchedule(s);
  }
  return paymentScheduleFilterKey(s) === filter;
}

export function paymentMatchesListSearch(
  s: Pick<PaymentScheduleSummary, "title" | "clientName">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [s.title, s.clientName].some((v) => v?.toLowerCase().includes(q));
}

export function parsePaymentListFilter(raw: string | undefined): PaymentListFilterKey {
  if (!raw) return DEFAULT_PAYMENT_LIST_FILTER;
  // Back-compat: prior ?filter=attention → Action Required
  if (raw === "attention") return "action_required";
  if (PAYMENT_LIST_FILTERS.some((f) => f.value === raw)) {
    return raw as PaymentListFilterKey;
  }
  return DEFAULT_PAYMENT_LIST_FILTER;
}

export function countVenueActionRequiredSchedules(
  schedules: readonly PaymentScheduleSummary[],
): number {
  return schedules.filter(isVenueActionRequiredSchedule).length;
}
