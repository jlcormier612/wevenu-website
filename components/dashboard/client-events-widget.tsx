import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/events/constants";
import { eventTypeLabel } from "@/lib/leads/constants";
import type { DashboardEvent } from "@/lib/dashboard/types";

function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Upcoming events sourced from the events table (canonical).
 * Sprint 13: migrated from the previous client-based approach.
 */
export function ClientEventsWidget({
  events,
}: {
  events: DashboardEvent[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          Upcoming Events
        </CardTitle>
        <CardDescription>Confirmed events in the next 60 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-heading">No events in the next 60 days</p>
            <p className="text-xs text-muted-foreground">
              Add an event date to a client record to track it here.
            </p>
            <Link href="/clients" className="inline-block text-xs font-medium text-primary hover:underline underline-offset-2">
              Go to Bookings →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => {
              const days = daysUntil(event.eventDate);
              const isThisWeek = days <= 7;
              const isTomorrow = days === 1;
              const isToday = days === 0;

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-start justify-between gap-4 -mx-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-medium text-foreground">
                        {event.clientName ?? event.name}
                      </p>
                      {isThisWeek && (
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          {isToday ? "Today" : isTomorrow ? "Tomorrow" : "This Week"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[
                        event.guestCount != null ? `${event.guestCount.toLocaleString()} guests` : null,
                        event.startTime ? formatTime(event.startTime) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(event.eventDate)}
                    </p>
                    <p
                      className={`text-xs ${isThisWeek ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
