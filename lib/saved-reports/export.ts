/**
 * Saved Report CSV — same definitions as Reporting Overview.
 */
import { getCanonicalBookings } from "@/lib/metrics/booking";
import {
  getLeadCohortLifecycleBookingStats,
  getLifecycleBookings,
} from "@/lib/metrics/lifecycle-booking";
import { getGrossBookedRevenue, getOutstandingBalance, getPaymentsCollected } from "@/lib/metrics/revenue";
import { getLeadsTrend } from "@/lib/reporting/service";
import { resolveDateRange } from "@/lib/reporting/date-range";
import { formatMoney } from "@/lib/event-orders/constants";
import { toCsv } from "@/lib/csv";
import { SAVED_REPORT_PATH_LABEL, type SavedReport } from "@/lib/saved-reports/types";

export async function buildSavedReportCsv(report: SavedReport): Promise<string> {
  const range = resolveDateRange(report.datePreset, report.customFrom ?? undefined, report.customTo ?? undefined);
  const window = { from: range.from, to: range.to };

  const [bookings, financiallyCommitted, grossRevenue, paymentsCollected, outstanding, leads, cohort] = await Promise.all([
    getLifecycleBookings(window),
    getCanonicalBookings(window),
    getGrossBookedRevenue(window),
    getPaymentsCollected(window),
    getOutstandingBalance(window),
    getLeadsTrend(window),
    getLeadCohortLifecycleBookingStats(window),
  ]);

  const meta = [
    ["Report", report.name],
    ["Type", SAVED_REPORT_PATH_LABEL[report.reportPath]],
    ["Period", range.label],
    ["From", range.from],
    ["To", range.to],
    [],
  ];
  const metaLines = meta.map((row) => row.join(","));

  const body = toCsv(
    ["Metric", "Value"],
    [
      ["Bookings (lifecycle, period)", bookings.length],
      ["Leads entered", leads.total],
      ["Lead → Booked rate (cohort %, excl. cancelled/lost)", `${cohort.conversionRate}%`],
      ["Financially Committed (period)", financiallyCommitted.length],
      ["Gross Booked Revenue", formatMoney(grossRevenue ?? 0)],
      ["Payments Collected", formatMoney(paymentsCollected ?? 0)],
      ["Outstanding Balance", formatMoney(outstanding ?? 0)],
    ],
  );

  return [...metaLines, body].join("\n");
}
