import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { ClientStatusBadge } from "@/components/clients/client-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  clientDisplayName,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { DashboardClient } from "@/lib/dashboard/types";
import type { ClientStatus } from "@/lib/clients/types";

function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function ClientEventsWidget({
  events,
}: {
  events: DashboardClient[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" />
          Upcoming Client Events
        </CardTitle>
        <CardDescription>Booked events in the next 60 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No events in the next 60 days. Confirmed client events will appear here.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {events.map((client) => {
              const days = client.eventDate ? daysUntil(client.eventDate) : null;
              const isThisWeek = days != null && days <= 7;
              const isTomorrow = days === 1;
              const isToday = days === 0;

              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-start justify-between gap-4 -mx-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-medium text-foreground">
                        {clientDisplayName(
                          client.firstName,
                          client.lastName,
                          client.partnerFirstName,
                          client.partnerLastName,
                        )}
                      </p>
                      {isThisWeek && (
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          {isToday ? "Today" : isTomorrow ? "Tomorrow" : "This Week"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[eventTypeLabel(client.eventType), client.guestCount != null ? `${client.guestCount.toLocaleString()} guests` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {client.eventDate ? formatDate(client.eventDate) : "TBD"}
                    </p>
                    {days != null && (
                      <p className={`text-xs ${isThisWeek ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
                      </p>
                    )}
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
