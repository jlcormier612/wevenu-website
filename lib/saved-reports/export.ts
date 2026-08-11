/**
 * Work Package D7C — CSV export for a Saved Report. CSV, not PDF: this
 * data is inherently tabular (headline figures for a period), and the
 * research pass found no existing report-PDF precedent worth extending
 * for this (the two real PDF generators in this codebase both render a
 * single fixed business document, not an arbitrary numeric summary).
 *
 * Every figure below is read straight from the exact same canonical
 * functions the Reporting Overview page itself calls
 * (app/(app)/reporting/page.tsx) — nothing here recalculates anything.
 */
import { getCanonicalBookings } from "@/lib/metrics/booking";
import { getConversionFunnel } from "@/lib/metrics/conversion";
import { getGrossBookedRevenue, getOutstandingBalance, getPaymentsCollected } from "@/lib/metrics/revenue";
import { getLeadsTrend } from "@/lib/reporting/service";
import { resolveDateRange } from "@/lib/reporting/date-range";
import { formatMoney } from "@/lib/event-orders/constants";
import { toCsv } from "@/lib/csv";
import { SAVED_REPORT_PATH_LABEL, type SavedReport } from "@/lib/saved-reports/types";

export async function buildSavedReportCsv(report: SavedReport): Promise<string> {
  const range = resolveDateRange(report.datePreset, report.customFrom ?? undefined, report.customTo ?? undefined);
  const window = { from: range.from, to: range.to };

  const [bookings, grossRevenue, paymentsCollected, outstanding, leads, funnel] = await Promise.all([
    getCanonicalBookings(window),
    getGrossBookedRevenue(window),
    getPaymentsCollected(window),
    getOutstandingBalance(window),
    getLeadsTrend(window),
    getConversionFunnel(window),
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
      ["Bookings", bookings.length],
      ["Leads", leads.total],
      ["Booking Conversion Rate", `${funnel?.bookingConversionRate ?? 0}%`],
      ["Gross Booked Revenue", formatMoney(grossRevenue ?? 0)],
      ["Payments Collected", formatMoney(paymentsCollected ?? 0)],
      ["Outstanding Balance", formatMoney(outstanding ?? 0)],
    ],
  );

  return [...metaLines, body].join("\n");
}
