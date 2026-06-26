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
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">No clients yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Convert a Won lead to record your first booking.
            </p>
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
