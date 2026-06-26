import Link from "next/link";
import { CalendarClock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/clients/constants";
import type { DashboardKeyDate } from "@/lib/dashboard/types";

function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function KeyDatesWidget({ keyDates }: { keyDates: DashboardKeyDate[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-warning-foreground" />
          Upcoming Key Dates
        </CardTitle>
        <CardDescription>Client milestones in the next two weeks.</CardDescription>
      </CardHeader>
      <CardContent>
        {keyDates.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No key dates in the next two weeks.
          </p>
        ) : (
          <div className="space-y-2">
            {keyDates.map((kd) => {
              const days = daysUntil(kd.date);
              const urgent = days <= 3;
              return (
                <Link
                  key={kd.id}
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
