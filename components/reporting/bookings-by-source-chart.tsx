"use client";

/**
 * Bookings by Source — doughnut for Reporting overview + Sales.
 * Thin wrapper over SourceCompositionChart (preserves existing import sites).
 */
import type { BookingsBySourceReport } from "@/lib/metrics/bookings-by-source";
import { SourceCompositionChart } from "@/components/reporting/source-composition-chart";

export function BookingsBySourceChart({
  report,
  detailHref,
  className,
  compact = false,
}: {
  report: BookingsBySourceReport;
  detailHref?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <SourceCompositionChart
      title="Bookings by Source"
      description={report.basis}
      slices={report.slices}
      total={report.total}
      emptyText="No bookings to show for this period."
      unitSingular="booking"
      unitPlural="bookings"
      detailHref={detailHref}
      detailLabel="Open Sales for lead conversion detail"
      className={className}
      compact={compact}
      testId="bookings-by-source-chart"
    />
  );
}
