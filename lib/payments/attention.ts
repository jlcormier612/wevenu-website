/**
 * Payments to Watch — shared attention condition for the Dashboard tile and
 * the Payments list filter. One definition: schedules that deriveScheduleStatus
 * classifies as "attention" (overdue / refunded line items).
 */
import { isSupabaseConfigured } from "@/lib/env";
import { getPaymentSchedules } from "@/lib/payments/service";
import { getCurrentVenue } from "@/lib/venue/service";

export type PaymentsToWatchSummary = {
  /** Sum of balances on attention schedules (what the Dashboard shows). */
  amount: number;
  /** Schedule ids producing that amount — same population the filtered list shows. */
  scheduleIds: string[];
};

export async function getPaymentsToWatchSummary(): Promise<PaymentsToWatchSummary> {
  if (!isSupabaseConfigured) return { amount: 0, scheduleIds: [] };
  const venue = await getCurrentVenue();
  if (!venue) return { amount: 0, scheduleIds: [] };

  // getPaymentSchedules runs mark_overdue_payments first — same status source
  // as the Payments page / filter=attention destination.
  const schedules = await getPaymentSchedules();
  const attention = schedules.filter((s) => s.scheduleStatus === "attention");
  return {
    amount: attention.reduce((sum, s) => sum + Math.max(0, s.balance), 0),
    scheduleIds: attention.map((s) => s.id),
  };
}

export function paymentsAttentionHref(): string {
  return "/payments?filter=attention";
}
