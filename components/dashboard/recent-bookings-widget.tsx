import Link from "next/link";
import { PartyPopper } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { Badge } from "@/components/ui/badge";
import {
  clientDisplayName,
  eventTypeLabel,
  formatDate,
} from "@/lib/clients/constants";
import type { DashboardClient } from "@/lib/dashboard/types";

// Dashboard Component System, Phase 1 Step 2 — shell migrated to
// AttentionList; row content and copy unchanged.
export function RecentBookingsWidget({
  bookings,
}: {
  bookings: DashboardClient[];
}) {
  return (
    <AttentionList
      icon={<PartyPopper className="h-4 w-4 text-primary" />}
      title="Recent Bookings"
      description="Your most recently booked clients."
      items={bookings}
      getKey={(client) => client.id}
      emptyState={
        <div className="py-6 text-center space-y-2">
          <p className="text-sm font-medium text-heading">No bookings yet</p>
          <p className="text-xs text-muted-foreground">
            When you mark a lead as Won, they&apos;ll appear here.
          </p>
          <Link href="/leads" className="inline-block text-xs font-medium text-primary hover:underline underline-offset-2">
            View all leads →
          </Link>
        </div>
      }
      renderRow={(client) => (
        <Link
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
      )}
    />
  );
}
