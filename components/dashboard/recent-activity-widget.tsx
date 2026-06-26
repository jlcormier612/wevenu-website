import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Circle,
  Clock,
  FileText,
  Pencil,
  Phone,
  PlusCircle,
  UserPlus,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelative } from "@/lib/leads/constants";
import type { ActivityItem } from "@/lib/dashboard/types";

const TYPE_ICON: Record<string, React.ElementType> = {
  lead_created:        UserPlus,
  status_changed:      ArrowRight,
  note_added:          FileText,
  note_updated:        Pencil,
  task_created:        PlusCircle,
  task_completed:      Check,
  tour_scheduled:      Calendar,
  follow_up_set:       Clock,
  last_contacted:      Phone,
  lead_updated:        Pencil,
  relationship_updated: Circle,
};

const TYPE_COLOR: Record<string, string> = {
  lead_created:        "bg-primary/10 text-primary",
  status_changed:      "bg-accent/60 text-heading",
  task_completed:      "bg-success/15 text-success",
  tour_scheduled:      "bg-primary/10 text-primary",
  follow_up_set:       "bg-warning/15 text-warning-foreground",
};

export function RecentActivityWidget({
  activities,
}: {
  activities: ActivityItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardDescription>
          What's happened across all your leads recently.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No recent activity. Start working leads to see events here.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activities.map((a) => {
              const Icon = TYPE_ICON[a.type] ?? Circle;
              const colorClass =
                TYPE_COLOR[a.type] ?? "bg-muted text-muted-foreground";
              return (
                <Link
                  key={a.id}
                  href={`/leads/${a.leadId}`}
                  className="flex items-start gap-2.5 rounded-lg border border-border p-3 hover:bg-muted/40 transition-colors"
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{a.title}</p>
                    <p className="text-xs font-medium text-muted-foreground truncate">
                      {a.leadName}
                    </p>
                    <p
                      className="text-xs text-muted-foreground"
                      title={new Date(a.createdAt).toLocaleString()}
                    >
                      {formatRelative(a.createdAt)}
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
