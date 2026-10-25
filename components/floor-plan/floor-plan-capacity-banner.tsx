"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  floorPlanCapacityNeedsAttention,
  formatFloorPlanCapacitySentence,
  summarizeFloorPlanCapacity,
  type FloorPlanCapacityObject,
} from "@/lib/floor-plans/capacity";

/**
 * Persistent, non-blocking capacity intelligence for the Floor Plan editor.
 * Same calm register as Inventory Usage / Event Order reconciliation —
 * surfaces shortfalls and incomplete seat counts without gating edits.
 */
export function FloorPlanCapacityBanner({
  objects,
  guestCount,
  spaceCapacity,
  spaceName,
}: {
  objects: FloorPlanCapacityObject[];
  guestCount?: number | null;
  spaceCapacity?: number | null;
  spaceName?: string | null;
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const summary = React.useMemo(
    () => summarizeFloorPlanCapacity({ objects, guestCount, spaceCapacity }),
    [objects, guestCount, spaceCapacity],
  );

  if (dismissed || summary.tableCount === 0) return null;

  const attention = floorPlanCapacityNeedsAttention(summary);
  const sentence = formatFloorPlanCapacitySentence(summary);
  const spaceNote =
    spaceName && summary.spaceCapacity != null
      ? ` (${spaceName})`
      : "";

  return (
    <div
      className={`rounded-xl border px-4 py-3 space-y-2 ${
        attention
          ? "border-warning/40 bg-warning/10"
          : "border-border bg-muted/30"
      }`}
      data-testid="floor-plan-capacity-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Seating capacity
          </p>
          <p className="text-sm text-foreground" data-testid="floor-plan-capacity-sentence">
            {sentence}
            {spaceNote && attention && summary.spaceCapacity != null ? spaceNote : null}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="floor-plan-capacity-legend">
            Layout seats sum seat counts on round, rectangular, and oval tables on this canvas
            (including ceremony rows and cocktail tables when present). That total is one
            simultaneous layout — zone labels like Ceremony / Cocktail / Reception are visual
            areas, not separate timed setups. “Above guest count” is layout seats minus the
            event&apos;s recorded guest count
            {summary.guestCount != null && summary.seatingSurplus != null
              ? ` (${summary.seatingCapacity} − ${summary.guestCount} = ${summary.seatingSurplus})`
              : ""}
            ; it is not Space capacity minus layout seats
            {summary.spaceCapacity != null
              ? ` (${summary.spaceCapacity} − ${summary.seatingCapacity} would be ${(summary.spaceCapacity - summary.seatingCapacity)})`
              : ""}
            .
          </p>
          {attention && (
            <p className="text-xs text-muted-foreground">
              Placement isn&apos;t blocked — add tables, raise seat counts, or update the guest
              count when you&apos;re ready. This just keeps the gap visible.
            </p>
          )}
          {!attention && summary.guestCount == null && summary.tablesWithCapacity > 0 && (
            <p className="text-xs text-muted-foreground">
              Add a guest count on the event to compare seating against who&apos;s coming.
            </p>
          )}
        </div>
        {attention && (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setDismissed(true)}>
            Dismiss for now
          </Button>
        )}
      </div>
    </div>
  );
}
