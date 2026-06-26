"use client";

import * as React from "react";

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

import { formatRelative } from "@/lib/leads/constants";
import type { LeadActivity } from "@/lib/leads/types";

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
  lead_created:        "bg-accent/60 text-heading",
  status_changed:      "bg-primary/15 text-primary",
  note_added:          "bg-muted text-muted-foreground",
  note_updated:        "bg-muted text-muted-foreground",
  task_created:        "bg-muted text-muted-foreground",
  task_completed:      "bg-success/15 text-success",
  tour_scheduled:      "bg-primary/15 text-primary",
  follow_up_set:       "bg-warning/15 text-warning-foreground",
  last_contacted:      "bg-accent/60 text-heading",
  lead_updated:        "bg-muted text-muted-foreground",
  relationship_updated: "bg-muted text-muted-foreground",
};

function ActivityItem({ activity }: { activity: LeadActivity }) {
  const Icon = TYPE_ICON[activity.type] ?? Circle;
  const colorClass = TYPE_COLOR[activity.type] ?? "bg-muted text-muted-foreground";

  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="pb-5 pt-1">
        <p className="text-sm font-medium text-foreground">{activity.title}</p>
        {activity.description ? (
          <p className="text-xs text-muted-foreground">{activity.description}</p>
        ) : null}
        <p
          className="mt-0.5 text-xs text-muted-foreground"
          title={new Date(activity.createdAt).toLocaleString()}
        >
          {formatRelative(activity.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ActivityTimeline({
  activities,
}: {
  activities: LeadActivity[];
}) {
  if (activities.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="relative">
      {activities.map((a, i) => (
        <div key={a.id} className={i === activities.length - 1 ? "[&_.w-px]:hidden" : ""}>
          <ActivityItem activity={a} />
        </div>
      ))}
    </div>
  );
}
