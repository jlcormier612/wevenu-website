import Link from "next/link";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { SourceCompositionChart } from "@/components/reporting/source-composition-chart";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendGranularityControl } from "@/components/reporting/trend-granularity-control";
import { allocateIntegerPercents } from "@/lib/attribution/bookings-by-source";
import { eventTypeLabel } from "@/lib/leads/constants";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { averageGuestCount, eventsByType, eventsToTrend, getEventsInRange } from "@/lib/reporting/service";
import {
  availableTrendGranularities,
  parseTrendGranularity,
} from "@/lib/reporting/trend-buckets";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Work Package R1 — Events report: what the business's calendar looks like, not a second calendar (brief §27/§67). */
export default async function EventsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };
  const grain = parseTrendGranularity(
    typeof params.grain === "string" ? params.grain : undefined,
    window.from,
    window.to,
  );
  const grainOptions = availableTrendGranularities(window.from, window.to);

  const [events, prevEvents] = await Promise.all([
    getEventsInRange(window),
    getEventsInRange(prevWindow),
  ]);
  const trend = eventsToTrend(events, window, grain);
  const types = eventsByType(events);
  const avgGuests = averageGuestCount(events);
  const prevAvgGuests = averageGuestCount(prevEvents);
  const typePercents = allocateIntegerPercents(types.map((t) => t.count));
  const typeSlices = types.map((t, i) => ({
    key: t.type,
    label: t.label,
    count: t.count,
    percent: typePercents[i] ?? 0,
  }));

  return (
    <div className="htc-hospitality-page space-y-6">
      <ReportHeader title="Events" description="Events on the calendar in this date range, grouped by type." />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid className="sm:grid-cols-2 lg:grid-cols-2 max-w-xl">
        <ComparisonCard label="Events" value={events.length} previousValue={prevEvents.length} comparisonLabel={range.comparisonLabel} polarity="neutral" tone="ops" />
        <ComparisonCard label="Average Guest Count" value={avgGuests} previousValue={avgGuests > 0 ? prevAvgGuests : null} comparisonLabel={range.comparisonLabel} polarity="neutral" tone="ops" />
      </ComparisonCardGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={events.length === 0 ? "htc-report-empty-card" : undefined}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-base">Events Over Time</CardTitle>
              <CardDescription>
                {trend.granularityLabel} view based on each event&apos;s date.
              </CardDescription>
            </div>
            <TrendGranularityControl current={grain} available={grainOptions} />
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No events in this date range.</p>
            ) : (
              <TrendChart data={trend.points} />
            )}
          </CardContent>
        </Card>

        <SourceCompositionChart
          title="Event Types"
          description="Share of events on the calendar in this range by type."
          slices={typeSlices}
          total={events.length}
          emptyText="No events in this date range."
          unitSingular="event"
          unitPlural="events"
          testId="event-types-chart"
        />
      </div>

      <Card className={events.length === 0 ? "htc-report-empty-card" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Events</CardTitle>
          <CardDescription>Click an event to open its workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No events in this date range.</p>
          ) : (
            <div className="divide-y divide-border">
              {events.map((e) => {
                // Work Package R3 — a real fix: the hover/focus classes used
                // to live on the inner div, but when wrapped in a Link,
                // *that* is the actual focusable element — a
                // focus-visible ring on a non-focusable descendant never
                // fires. Applied to whichever element is actually
                // interactive instead.
                const content = (
                  <>
                    <span className="font-medium text-foreground">{e.name}</span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      {e.eventType && <span>{eventTypeLabel(e.eventType) || e.eventType}</span>}
                      <span className="tabular-nums">{e.eventDate ? new Date(e.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                    </span>
                  </>
                );
                return e.clientId ? (
                  <Link
                    key={e.id}
                    href={`/clients/${e.clientId}`}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={e.id} className="flex items-center justify-between gap-4 py-2.5 text-sm -mx-2 px-2">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
