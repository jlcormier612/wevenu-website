"use client";

import * as React from "react";

import Link from "next/link";

import { getFloorPlanRequiredStatusAction } from "@/app/(app)/events/[id]/floor-plan-actions";
import type { FloorPlan } from "@/lib/floor-plans/types";

type Status = Awaited<ReturnType<typeof getFloorPlanRequiredStatusAction>>;

/** One line per setup (or layout): Event Order quantities vs placed. Read-only. */
export function FloorPlanRequiredStatus({ eventId, floorPlans }: { eventId: string; floorPlans: FloorPlan[] }) {
  const [status, setStatus] = React.useState<Status | null>(null);
  const planKey = floorPlans.map((p) => `${p.id}:${p.name}:${p.updatedAt}`).join("|");

  React.useEffect(() => {
    let cancelled = false;
    void getFloorPlanRequiredStatusAction(eventId, floorPlans.map((p) => ({ id: p.id, name: p.name })))
      .then((next) => { if (!cancelled) setStatus(next); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, planKey]);

  if (!status || status.lines.length === 0) return null;

  return (
    <div className="rounded-md border border-border px-3 py-2 text-xs space-y-1" data-testid="floor-plan-required-status">
      <p className="font-semibold uppercase tracking-wide text-muted-foreground">Event Order vs floor plans</p>
      <ul className="space-y-0.5">
        {status.lines.map((line) => (
          <li key={line.key} data-testid="floor-plan-required-status-line" data-short={line.shortCount}>
            <Link href={`/events/${eventId}/floor-plans/${line.planId}`} className="hover:underline">
              <span className="font-medium text-foreground">{line.label}:</span>{" "}
              <span className={line.shortCount > 0 ? "text-amber-800" : "text-muted-foreground"}>{line.sentence}</span>
            </Link>
          </li>
        ))}
      </ul>
      {status.unmatchedSections.length > 0 ? (
        <p className="text-amber-900" data-testid="floor-plan-required-status-unmatched">
          {status.unmatchedSections.map((s) => `“${s.name}”`).join(", ")} on the Event Order{" "}
          {status.unmatchedSections.length === 1 ? "doesn't" : "don't"} match a setup and{" "}
          {status.unmatchedSections.length === 1 ? "counts" : "count"} against every layout.{" "}
          <Link href={`/events/${eventId}?tab=event-order#event-order-order`} className="underline">Choose a setup</Link>.
        </p>
      ) : null}
    </div>
  );
}
