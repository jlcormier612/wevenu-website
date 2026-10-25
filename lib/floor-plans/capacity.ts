/**
 * Floor Plan seating-capacity intelligence — pure helpers.
 *
 * Informational only: never blocks placement, Ready, or sharing.
 * Uses table object capacities already on the plan (canonical SoR for
 * "how many seats does this layout hold") and optional Event guest count /
 * Space capacity already owned by Events / Availability.
 */
import type { ObjectType } from "@/lib/floor-plans/types";

export const SEATING_TABLE_TYPES = new Set<ObjectType>([
  "table_round",
  "table_rect",
  "table_oval",
]);

export type FloorPlanCapacityObject = {
  objectType: ObjectType | string;
  capacity: number | null;
};

export type FloorPlanCapacityInput = {
  objects: FloorPlanCapacityObject[];
  /** Event.guestCount — null/undefined when the venue has not set one. */
  guestCount?: number | null;
  /** venue_spaces.capacity for the plan's Space — null when unknown/unset. */
  spaceCapacity?: number | null;
};

export type FloorPlanCapacityLevel =
  | "ok"
  | "incomplete"
  | "seating_short"
  | "space_short"
  | "both_short";

export type FloorPlanCapacitySummary = {
  tableCount: number;
  tablesWithCapacity: number;
  tablesMissingCapacity: number;
  /** Sum of known table capacities (tables with null capacity contribute 0). */
  seatingCapacity: number;
  guestCount: number | null;
  spaceCapacity: number | null;
  seatingShortfall: number | null;
  seatingSurplus: number | null;
  spaceGuestShortfall: number | null;
  level: FloorPlanCapacityLevel;
};

function positiveInt(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function isSeatingTableType(objectType: string): boolean {
  return SEATING_TABLE_TYPES.has(objectType as ObjectType);
}

export function summarizeFloorPlanCapacity(input: FloorPlanCapacityInput): FloorPlanCapacitySummary {
  const tables = input.objects.filter((o) => isSeatingTableType(String(o.objectType)));
  const tablesWithCapacity = tables.filter((t) => t.capacity != null && t.capacity > 0);
  const tablesMissingCapacity = tables.length - tablesWithCapacity.length;
  const seatingCapacity = tablesWithCapacity.reduce((sum, t) => sum + (t.capacity ?? 0), 0);
  const guestCount = positiveInt(input.guestCount ?? null);
  const spaceCapacity = positiveInt(input.spaceCapacity ?? null);

  // When every table lacks a seat count, treat known seating capacity as 0 so
  // a guest count still surfaces as a shortfall (plan is not yet measurable).
  const measurableSeating = tablesWithCapacity.length > 0 || tables.length === 0
    ? seatingCapacity
    : 0;

  const seatingShortfall =
    guestCount != null && tables.length > 0 && guestCount > measurableSeating
      ? guestCount - measurableSeating
      : null;

  const seatingSurplus =
    guestCount != null && tablesWithCapacity.length > 0 && measurableSeating >= guestCount
      ? measurableSeating - guestCount
      : null;

  const spaceGuestShortfall =
    guestCount != null && spaceCapacity != null && guestCount > spaceCapacity
      ? guestCount - spaceCapacity
      : null;

  const seatingShort = seatingShortfall != null && seatingShortfall > 0;
  const spaceShort = spaceGuestShortfall != null && spaceGuestShortfall > 0;
  const incomplete =
    !seatingShort
    && tables.length > 0
    && tablesMissingCapacity > 0
    && (guestCount != null || tablesWithCapacity.length === 0);

  let level: FloorPlanCapacityLevel = "ok";
  if (seatingShort && spaceShort) level = "both_short";
  else if (seatingShort) level = "seating_short";
  else if (spaceShort) level = "space_short";
  else if (incomplete) level = "incomplete";

  return {
    tableCount: tables.length,
    tablesWithCapacity: tablesWithCapacity.length,
    tablesMissingCapacity,
    seatingCapacity,
    guestCount,
    spaceCapacity,
    seatingShortfall,
    seatingSurplus,
    spaceGuestShortfall,
    level,
  };
}

/**
 * Plain-language outcome line for banners — never implies a hard block.
 *
 * Layout seating is the sum of seat capacities on table_round / table_rect /
 * table_oval objects on this canvas (live). "Seats above guest count" is
 * layoutSeating − event.guestCount — never Space capacity − layout seating.
 * Space capacity is listed separately so it is not mistaken for that surplus.
 */
export function formatFloorPlanCapacitySentence(summary: FloorPlanCapacitySummary): string {
  if (summary.tableCount === 0) {
    return "No seating tables on this plan yet.";
  }

  const seatsPart =
    summary.tablesWithCapacity === 0
      ? `${summary.tableCount} table${summary.tableCount === 1 ? "" : "s"} · set a seat count on each to measure capacity`
      : `${summary.seatingCapacity} layout seat${summary.seatingCapacity === 1 ? "" : "s"} across ${summary.tableCount} table${summary.tableCount === 1 ? "" : "s"}`;

  const parts: string[] = [seatsPart];

  if (summary.guestCount != null) {
    parts.push(
      `${summary.guestCount} guest${summary.guestCount === 1 ? "" : "s"} recorded on this event`,
    );
  }
  if (summary.spaceCapacity != null) {
    parts.push(`assigned Space capacity ${summary.spaceCapacity}`);
  }
  if (summary.tablesMissingCapacity > 0 && summary.tablesWithCapacity > 0) {
    parts.push(
      `${summary.tablesMissingCapacity} table${summary.tablesMissingCapacity === 1 ? "" : "s"} missing a seat count`,
    );
  }

  if (summary.level === "seating_short" || summary.level === "both_short") {
    parts.push(
      `short ${summary.seatingShortfall} seat${summary.seatingShortfall === 1 ? "" : "s"} vs the event guest count`,
    );
  } else if (summary.level === "ok" && summary.seatingSurplus != null && summary.guestCount != null) {
    if (summary.seatingSurplus === 0) {
      parts.push("layout seating matches the event guest count");
    } else {
      parts.push(
        `${summary.seatingSurplus} layout seat${summary.seatingSurplus === 1 ? "" : "s"} above the event guest count`,
      );
    }
  }

  if (summary.level === "space_short" || summary.level === "both_short") {
    parts.push(
      `guest count is ${summary.spaceGuestShortfall} over this Space's capacity`,
    );
  }

  return parts.join(" · ");
}

export function floorPlanCapacityNeedsAttention(summary: FloorPlanCapacitySummary): boolean {
  return summary.level !== "ok";
}
