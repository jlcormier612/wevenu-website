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
  MessageCircle, Receipt, Truck, UserPlus, Users, Wallet, Workflow,
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
  automation: Workflow,
};

/** Wave G5 — visible eucalyptus wash (not washed-out primary/15 gray). */
const ACTIVITY_ICON_EUCALYPTUS =
  "bg-[var(--htc-eucalyptus-surface)] text-[var(--htc-botanical)]";

const SOURCE_COLOR: Record<ActivityTimelineSource, string> = {
  lead: ACTIVITY_ICON_EUCALYPTUS,
  client: ACTIVITY_ICON_EUCALYPTUS,
  event: ACTIVITY_ICON_EUCALYPTUS,
  payment: ACTIVITY_ICON_EUCALYPTUS,
  invoice: ACTIVITY_ICON_EUCALYPTUS,
  request: ACTIVITY_ICON_EUCALYPTUS,
  contract: ACTIVITY_ICON_EUCALYPTUS,
  timeline: ACTIVITY_ICON_EUCALYPTUS,
  guests: ACTIVITY_ICON_EUCALYPTUS,
  vendor: ACTIVITY_ICON_EUCALYPTUS,
  conversation: ACTIVITY_ICON_EUCALYPTUS,
  automation: ACTIVITY_ICON_EUCALYPTUS,
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
  const colorClass = SOURCE_COLOR[event.source] ?? ACTIVITY_ICON_EUCALYPTUS;
  return (
    <div className="htc-working-row flex gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex shrink-0 flex-col items-center">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="pb-1 pt-1">
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
    return (
      <div className="htc-surface-guidance px-4 py-10 text-center" data-testid="activity-timeline-empty">
        <p className="text-sm font-medium text-heading">No activity recorded yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Milestones for this relationship will appear here as they happen.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      {events.map((e, i) => (
        <EventRow key={`${e.type}-${e.occurredAt}`} event={e} isLast={i === events.length - 1} />
      ))}
    </div>
  );
}
