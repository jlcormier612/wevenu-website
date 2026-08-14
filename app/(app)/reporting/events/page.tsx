import Link from "next/link";

import { DateRangeControl } from "@/components/reporting/date-range-control";
import { ReportHeader } from "@/components/reporting/report-header";
import { ComparisonCard, ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventTypeLabel } from "@/lib/leads/constants";
import { resolveDateRangeFromParams } from "@/lib/reporting/date-range";
import { averageGuestCount, eventsByType, eventsToTrend, getEventsInRange } from "@/lib/reporting/service";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Work Package R1 — Events report: what the business's calendar looks like, not a second calendar (brief §27/§67). */
export default async function EventsReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = resolveDateRangeFromParams(params);
  const window = { from: range.from, to: range.to };
  const prevWindow = { from: range.previousFrom, to: range.previousTo };

  const [events, prevEvents] = await Promise.all([
    getEventsInRange(window),
    getEventsInRange(prevWindow),
  ]);
  const trend = eventsToTrend(events, window);
  const types = eventsByType(events);
  const avgGuests = averageGuestCount(events);
  const prevAvgGuests = averageGuestCount(prevEvents);

  return (
    <div className="space-y-6">
      <ReportHeader title="Events" description="What your event business looks like over time." />
      <DateRangeControl current={range.preset} label={range.label} />

      <ComparisonCardGrid className="sm:grid-cols-2 lg:grid-cols-2 max-w-xl">
        <ComparisonCard label="Events" value={events.length} previousValue={prevEvents.length} comparisonLabel={range.comparisonLabel} polarity="neutral" />
        <ComparisonCard label="Average Guest Count" value={avgGuests} previousValue={avgGuests > 0 ? prevAvgGuests : null} comparisonLabel={range.comparisonLabel} polarity="neutral" />
      </ComparisonCardGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events Over Time</CardTitle>
          <CardDescription>Based on each event's date.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No events in this date range.</p>
          ) : (
            <TrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Types</CardTitle>
        </CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No events in this date range.</p>
          ) : (
            <div className="divide-y divide-border">
              {types.map((t) => (
                <div key={t.type} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{eventTypeLabel(t.type) || t.type}</span>
                  <span className="tabular-nums font-medium text-heading">{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
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
                  <Link key={e.id} href={`/clients/${e.clientId}`} className="flex items-center justify-between gap-4 py-2.5 text-sm hover:bg-muted/30 -mx-2 px-2 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
