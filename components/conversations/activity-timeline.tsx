"use client";

/**
 * ActivityTimelineView — RC2, Milestone 4.
 *
 * "The timeline should answer 'What happened?' The Conversation answers
 * 'What was said?'" A read-only, chronological audit trail of every
 * business milestone in a relationship — leads, clients, events, payments,
 * invoices, requests, contracts, timeline submissions, guest counts,
 * vendors — plus Conversation activity collapsed into "Conversation
 * started"/"Conversation resumed" markers, never one row per message.
 *
 * Self-fetching (like RelationshipContextPanel) so it drops into any tab
 * slot — the Lead detail "Activity" tab, the Booking Workspace's new
 * "Activity" tab — without threading data through either page's props.
 */
import * as React from "react";
import {
  CalendarClock, CheckCircle2, Circle, FileSignature,
  MessageCircle, Receipt, Truck, UserPlus, Users, Wallet,
} from "lucide-react";

import { getActivityTimelineAction } from "@/app/(app)/messaging/actions";
import type { ActivityTimelineEvent, ActivityTimelineSource } from "@/lib/activity-timeline/types";

const SOURCE_ICON: Record<ActivityTimelineSource, React.ElementType> = {
  lead: UserPlus,
  client: Users,
  event: CalendarClock,
  payment: Wallet,
  invoice: Receipt,
  request: CheckCircle2,
  contract: FileSignature,
  timeline: CalendarClock,
  guests: Users,
  vendor: Truck,
  conversation: MessageCircle,
};

const SOURCE_COLOR: Record<ActivityTimelineSource, string> = {
  lead: "bg-accent/60 text-heading",
  client: "bg-accent/60 text-heading",
  event: "bg-primary/15 text-primary",
  payment: "bg-success/15 text-success",
  invoice: "bg-success/15 text-success",
  request: "bg-muted text-muted-foreground",
  contract: "bg-primary/15 text-primary",
  timeline: "bg-muted text-muted-foreground",
  guests: "bg-muted text-muted-foreground",
  vendor: "bg-warning/15 text-warning-foreground",
  conversation: "bg-info/15 text-info",
};

function formatWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function EventRow({ event, isLast }: { event: ActivityTimelineEvent; isLast: boolean }) {
  const Icon = SOURCE_ICON[event.source] ?? Circle;
  const colorClass = SOURCE_COLOR[event.source] ?? "bg-muted text-muted-foreground";
  return (
    <div className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="pb-5 pt-1">
        <p className="text-sm font-medium text-foreground">{event.title}</p>
        {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground" title={new Date(event.occurredAt).toLocaleString()}>
          {formatWhen(event.occurredAt)}
        </p>
      </div>
    </div>
  );
}

export function ActivityTimelineView({ leadId, clientId }: { leadId: string | null; clientId: string | null }) {
  const [events, setEvents] = React.useState<ActivityTimelineEvent[] | null>(null);

  React.useEffect(() => {
    void getActivityTimelineAction(leadId, clientId).then(setEvents);
  }, [leadId, clientId]);

  if (events === null) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (events.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <div className="relative">
      {events.map((e, i) => (
        <EventRow key={`${e.type}-${e.occurredAt}`} event={e} isLast={i === events.length - 1} />
      ))}
    </div>
  );
}
