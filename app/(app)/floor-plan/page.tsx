import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAllFloorPlans } from "@/lib/floor-plans/service";
import { getEvents } from "@/lib/events/service";

export const metadata: Metadata = { title: "Floor Plans" };

export default async function FloorPlanPage() {
  const [floorPlans, events] = await Promise.all([getAllFloorPlans(), getEvents()]);

  // Match floor plans to their events
  const plansByEventId = new Map(floorPlans.map((p) => [p.eventId, p]));

  // Events that have a floor plan
  const eventsWithPlans = events.filter((e) => plansByEventId.has(e.id));
  // Events without a floor plan
  const eventsWithoutPlans = events.filter((e) => !plansByEventId.has(e.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Floor Plans"
        description="Event layouts live on each event record. Open an event and click the Floor Plan tab to create or edit."
      />

      {eventsWithPlans.length === 0 && eventsWithoutPlans.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No events yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create an event first, then open it to build its floor plan.
          </p>
          <Button render={<Link href="/events" />}>Go to Events</Button>
        </div>
      )}

      {eventsWithPlans.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-heading">Events with floor plans</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {eventsWithPlans.map((event) => {
              const plan = plansByEventId.get(event.id)!;
              const objCount = 0; // we don't fetch objects here
              return (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{event.name}</p>
                          {event.eventDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                        <Badge variant="default" className="shrink-0 text-[10px]">Has Plan</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {eventsWithoutPlans.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Events without a floor plan</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {eventsWithoutPlans.slice(0, 6).map((event) => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer opacity-70 hover:opacity-100">
                  <CardContent className="pt-4 pb-4">
                    <p className="truncate text-sm font-medium text-foreground">{event.name}</p>
                    {event.eventDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(event.eventDate + "T12:00:00").toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Open any event → Floor Plan tab to create a layout.
          </p>
        </div>
      )}
    </div>
  );
}
