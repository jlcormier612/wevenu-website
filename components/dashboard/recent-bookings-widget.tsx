import Link from "next/link";
import { PartyPopper } from "lucide-react";

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

export function RecentBookingsWidget({
  bookings,
}: {
  bookings: DashboardClient[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PartyPopper className="h-4 w-4 text-primary" />
          Recent Bookings
        </CardTitle>
        <CardDescription>Your most recently booked couples.</CardDescription>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-heading">No bookings yet</p>
            <p className="text-xs text-muted-foreground">
              When you mark a lead as Won, they&apos;ll appear here.
            </p>
            <Link href="/leads" className="inline-block text-xs font-medium text-primary hover:underline underline-offset-2">
              View all leads →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bookings.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-start justify-between gap-4 -mx-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {clientDisplayName(
                      client.firstName,
                      client.lastName,
                      client.partnerFirstName,
                      client.partnerLastName,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {eventTypeLabel(client.eventType) || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {client.eventDate ? (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(client.eventDate)}
                    </p>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">TBD</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
