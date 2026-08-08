import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { AttentionList } from "@/components/dashboard-system/attention-list";
import { formatDate } from "@/lib/clients/constants";
import type { DashboardKeyDate } from "@/lib/dashboard/types";

function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Dashboard Component System, Phase 1 Step 2 — shell migrated to
// AttentionList (bordered row variant, matching the original's
// individually-bordered cards rather than a divide-y list); row content
// and copy unchanged.
export function KeyDatesWidget({ keyDates }: { keyDates: DashboardKeyDate[] }) {
  return (
    <AttentionList
      icon={<CalendarClock className="h-4 w-4 text-warning-foreground" />}
      title="Upcoming Key Dates"
      description="Client milestones in the next two weeks."
      items={keyDates}
      getKey={(kd) => kd.id}
      rowVariant="bordered"
      emptyState={
        <p className="py-4 text-center text-sm text-muted-foreground">
          No key dates in the next two weeks.
        </p>
      }
      renderRow={(kd) => {
        const days = daysUntil(kd.date);
        const urgent = days <= 3;
        return (
          <Link
            href={`/clients/${kd.clientId}`}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium text-foreground truncate">
                {kd.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {kd.clientName}
              </p>
            </div>
            <div className="shrink-0 text-right space-y-0.5">
              <p className={`text-xs font-medium ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatDate(kd.date)}
              </p>
            </div>
          </Link>
        );
      }}
    />
  );
}
