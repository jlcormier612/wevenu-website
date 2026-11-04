"use client";

import * as React from "react";

import {
  ArrowRight,
  Calendar,
  Check,
  Circle,
  Clock,
  Eye,
  FileText,
  MessageSquareWarning,
  Pencil,
  PlusCircle,
  Phone,
  RotateCcw,
  Send,
  ShieldOff,
  UserPlus,
} from "lucide-react";

import { formatRelative } from "@/lib/leads/constants";
/** Minimal shape the timeline needs — compatible with LeadActivity and ClientActivity. */
export type ActivityRecord = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, React.ElementType> = {
  lead_created:        UserPlus,
  status_changed:      ArrowRight,
  note_added:          FileText,
  note_updated:        Pencil,
  task_created:        PlusCircle,
  task_completed:      Check,
  tour_scheduled:      Calendar,
  follow_up_set:       Clock,
  follow_up_completed: Check,
  last_contacted:      Phone,
  lead_updated:        Pencil,
  relationship_updated: Circle,
  sent:                Send,
  resent:              Send,
  opened:              Eye,
  submitted:           Check,
  reviewed:            Check,
  completed:           Check,
  resubmitted:         Check,
  changes_requested:   MessageSquareWarning,
  reopened:            RotateCcw,
  access_withdrawn:    ShieldOff,
  shared:              Send,
  additional_inquiry_message: MessageSquareWarning,
};

/** Wave G5 — visible eucalyptus wash (not washed-out primary/15 gray). */
const ACTIVITY_ICON_EUCALYPTUS =
  "bg-[var(--htc-eucalyptus-surface)] text-[var(--htc-botanical)]";

const TYPE_COLOR: Record<string, string> = {
  lead_created: ACTIVITY_ICON_EUCALYPTUS,
  status_changed: ACTIVITY_ICON_EUCALYPTUS,
  note_added: ACTIVITY_ICON_EUCALYPTUS,
  note_updated: ACTIVITY_ICON_EUCALYPTUS,
  task_created: ACTIVITY_ICON_EUCALYPTUS,
  task_completed: ACTIVITY_ICON_EUCALYPTUS,
  tour_scheduled: ACTIVITY_ICON_EUCALYPTUS,
  follow_up_set: ACTIVITY_ICON_EUCALYPTUS,
  follow_up_completed: ACTIVITY_ICON_EUCALYPTUS,
  last_contacted: ACTIVITY_ICON_EUCALYPTUS,
  lead_updated: ACTIVITY_ICON_EUCALYPTUS,
  relationship_updated: ACTIVITY_ICON_EUCALYPTUS,
  sent: ACTIVITY_ICON_EUCALYPTUS,
  resent: ACTIVITY_ICON_EUCALYPTUS,
  opened: ACTIVITY_ICON_EUCALYPTUS,
  submitted: ACTIVITY_ICON_EUCALYPTUS,
  reviewed: ACTIVITY_ICON_EUCALYPTUS,
  completed: ACTIVITY_ICON_EUCALYPTUS,
  resubmitted: ACTIVITY_ICON_EUCALYPTUS,
  changes_requested: ACTIVITY_ICON_EUCALYPTUS,
  reopened: ACTIVITY_ICON_EUCALYPTUS,
  access_withdrawn: ACTIVITY_ICON_EUCALYPTUS,
  shared: ACTIVITY_ICON_EUCALYPTUS,
  additional_inquiry_message: ACTIVITY_ICON_EUCALYPTUS,
};

function ActivityItem({ activity }: { activity: ActivityRecord }) {
  const Icon = TYPE_ICON[activity.type] ?? Circle;
  const colorClass = TYPE_COLOR[activity.type] ?? ACTIVITY_ICON_EUCALYPTUS;

  return (
    <div className="htc-working-row flex gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
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
  activities: ActivityRecord[];
}) {
  if (activities.length === 0) {
    return (
      <div className="htc-surface-guidance px-4 py-10 text-center" data-testid="lead-activity-empty">
        <p className="text-sm font-medium text-heading">No activity recorded yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Milestones for this lead will appear here as they happen.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      {activities.map((a, i) => (
        <div key={a.id} className={i === activities.length - 1 ? "[&_.w-px]:hidden" : ""}>
          <ActivityItem activity={a} />
        </div>
      ))}
    </div>
  );
}
