/**
 * P7 planning-window observations — one event, given already-computed readiness.
 *
 * Used by getLuvObservations after per-event readiness is loaded (in parallel).
 * Semantics match the former sequential loop in observations.ts.
 */

import { computePlanningReadiness, computeTimelineReadiness } from "@/lib/readiness/compute";
import type { EventReadiness } from "@/lib/playbooks/types";
import type { TimelineEntry } from "@/lib/timeline/types";
import type { LuvObservation } from "@/lib/luv/types";

export type PlanningWindowEvent = {
  id: string;
  name: string;
  event_date: string;
  client_id: string | null;
  clients?: { first_name?: string | null; partner_first_name?: string | null } | null;
};

export type PlanningWindowReadiness = {
  client: EventReadiness | null;
  venue: EventReadiness | null;
};

function inDays(iso: string): string {
  const days = Math.round((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

export function buildPlanningWindowObservationsForEvent(
  ev: PlanningWindowEvent,
  readinessByKind: PlanningWindowReadiness,
  timelineEntries: Pick<TimelineEntry, "status">[],
  totalMessageCount: number,
): LuvObservation[] {
  const observations: LuvObservation[] = [];
  const du = Math.ceil((new Date(ev.event_date + "T12:00:00").getTime() - Date.now()) / 86_400_000);
  const name = [ev.clients?.first_name, ev.clients?.partner_first_name].filter(Boolean).join(" & ") || ev.name;

  if (readinessByKind.client || readinessByKind.venue) {
    const planning = computePlanningReadiness(readinessByKind);
    const totalRequired = (readinessByKind.client?.totalRequired ?? 0) + (readinessByKind.venue?.totalRequired ?? 0);
    const completedRequired = (readinessByKind.client?.completedRequired ?? 0) + (readinessByKind.venue?.completedRequired ?? 0);

    if (planning.status === "needs_attention") {
      observations.push({
        id: `planning-attention-${ev.id}`,
        kind: "risk",
        priority: du <= 30 ? "high" : "medium",
        message: `${name}'s planning needs attention.`,
        detail: planning.detail,
        link: `/events/${ev.id}#playbook`,
        actionLabel: "View Playbook →",
        recommendation: { label: "Review overdue or blocked tasks", link: `/events/${ev.id}#playbook`, type: "navigate" },
      });
    } else if (totalRequired >= 5 && completedRequired / totalRequired >= 0.7) {
      observations.push({
        id: `strong-momentum-${ev.id}`,
        kind: "fact",
        priority: "low",
        message: `${name} has no exceptions and is ${planning.metric ?? `${completedRequired}/${totalRequired}`} ready.`,
        detail: du <= 30 ? "Everything is on track for the big day." : "Planning momentum looks strong.",
        link: `/events/${ev.id}`,
        actionLabel: "View Event →",
      });
    }
  }

  if (du > 21) {
    const entries = timelineEntries;
    const timeline = computeTimelineReadiness(entries as unknown as TimelineEntry[]);
    if (timeline.status === "waiting" && entries.length >= 5) {
      const complete = entries.filter((e) => e.status === "complete").length;
      if (complete / entries.length < 0.5) {
        observations.push({
          id: `timeline-attention-${ev.id}`,
          kind: "risk",
          priority: du <= 60 ? "medium" : "low",
          message: `${name}'s day-of timeline is ${timeline.metric ?? `${complete}/${entries.length}`} complete with ${du} days to go.`,
          link: `/events/${ev.id}#timeline`,
          actionLabel: "View Timeline →",
          recommendation: { label: "Review the timeline", link: `/events/${ev.id}#timeline`, type: "navigate" },
        });
      }
    }
  }

  if (du <= 30) {
    if (totalMessageCount === 0) {
      observations.push({
        id: `communication-none-${ev.id}`,
        kind: "fact",
        priority: "low",
        message: `${name} is ${inDays(ev.event_date)} with no messages logged yet.`,
        link: `/events/${ev.id}#messages`,
        actionLabel: "View Event →",
      });
    }
  }

  return observations;
}
