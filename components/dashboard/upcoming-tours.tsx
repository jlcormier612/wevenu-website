import Link from "next/link";
import { Building2, Clock } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { eventTypeLabel, formatDate, leadDisplayName } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";

function daysUntil(iso: string): number {
  return Math.ceil(
    (new Date(iso).getTime() - Date.now()) / 86_400_000,
  );
}

// Dashboard Component System, Phase 1 Step 2 — shell migrated to
// AttentionList; row content and copy unchanged.
export function UpcomingToursWidget({ leads }: { leads: Lead[] }) {
  return (
    <AttentionList
      icon={<Building2 className="h-4 w-4 text-primary" />}
      title="Upcoming Tours"
      description="Venue tours in the next two weeks."
      items={leads}
      getKey={(lead) => lead.id}
      emptyState={
        <div className="py-6 text-center space-y-2">
          <p className="text-sm font-medium text-heading">No tours this fortnight</p>
          <p className="text-xs text-muted-foreground">
            Set a tour date on any lead to see it here.
          </p>
          <Link href="/leads" className="inline-block text-xs font-medium text-primary hover:underline underline-offset-2">
            View all leads →
          </Link>
        </div>
      }
      renderRow={(lead) => {
        const days = lead.tourDate ? daysUntil(lead.tourDate) : null;
        const isToday = days === 0;
        const isTomorrow = days === 1;
        const urgencyLabel = isToday
          ? "Today"
          : isTomorrow
            ? "Tomorrow"
            : days != null
              ? `In ${days} days`
              : "";

        return (
          <Link
            href={`/leads/${lead.id}`}
            className="flex items-start justify-between gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-medium text-foreground">
                {leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}
              </p>
              <p className="text-xs text-muted-foreground">
                {[eventTypeLabel(lead.eventType), lead.guestCount != null ? `${lead.guestCount} guests` : ""].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="shrink-0 text-right space-y-0.5">
              <p className={`text-xs font-semibold ${isToday || isTomorrow ? "text-destructive" : "text-foreground"}`}>
                {urgencyLabel}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
                <Clock className="h-3 w-3" />
                {formatDate(lead.tourDate)}
                {lead.tourTime ? ` · ${lead.tourTime.slice(0, 5)}` : ""}
              </p>
            </div>
          </Link>
        );
      }}
    />
  );
}
