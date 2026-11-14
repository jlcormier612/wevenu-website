/**
 * Guest Seating canvas presentation — labels, occupancy copy, and styles
 * for the couple/venue seating chart. Geometry stays authoritative from
 * floor_plan_objects; this only decides how we label and color it.
 */
import type { DisplayShape } from "@/lib/floor-plans/types";
import {
  compactFloorPlanLabel,
  isSeatingDestinationType,
  resolveDisplayShape,
} from "@/lib/floor-plans/resolve-display-shape";

export const SEATING_CANVAS = {
  background: "#FFFFFF",
  border: "#E6E3DC",
  radiusPx: 16,
  guestFill: "#EDF3EE",
  guestStroke: "#688371",
  guestStrokeWidth: 1.5,
  selectedFill: "#DCE9DE",
  selectedStroke: "#446B56",
  selectedStrokeWidth: 2,
  furnitureFill: "#F4F1EB",
  furnitureStroke: "#B8B4AA",
  furnitureStrokeWidth: 1,
  danceFill: "#F4F1EB",
  danceStroke: "#B8B4AA",
  labelPx: 12.5,
  occupancyPx: 10.5,
} as const;

export type SeatingCanvasObject = {
  id: string;
  objectType: string;
  label: string | null;
  capacity: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  displayShape: string | null;
  /** Assigned guests on this object when it is a seating destination. */
  guestCount?: number;
};

export function seatingObjectShape(obj: Pick<SeatingCanvasObject, "displayShape" | "objectType" | "width" | "height" | "label">): DisplayShape {
  return resolveDisplayShape(obj);
}

export function seatingObjectLabel(obj: Pick<SeatingCanvasObject, "label" | "objectType" | "width" | "height">): string {
  return compactFloorPlanLabel(obj.label);
}

export function seatingOccupancyText(guestCount: number, capacity: number | null | undefined): string {
  if (capacity == null) return `${guestCount} seated`;
  return `${guestCount} of ${capacity} seated`;
}

export function seatingSummaryLine(input: {
  totalAssigned: number;
  totalAttending: number;
  tableCount: number;
  totalCapacity: number;
}): string {
  return `${input.totalAssigned} of ${input.totalAttending} seated · ${input.tableCount} tables · ${input.totalCapacity} seats`;
}

export function isInteractiveSeatingObject(objectType: string): boolean {
  return isSeatingDestinationType(objectType);
}

export function seatingObjectStyle(input: {
  objectType: string;
  shape: DisplayShape;
  selected: boolean;
  guestCount: number;
}): { fill: string; stroke: string; strokeWidth: number; showOccupancy: boolean } {
  const seating = isInteractiveSeatingObject(input.objectType);
  if (!seating) {
    const isDance = input.shape === "dance_floor" || input.objectType === "dance_floor";
    return {
      fill: isDance ? SEATING_CANVAS.danceFill : SEATING_CANVAS.furnitureFill,
      stroke: isDance ? SEATING_CANVAS.danceStroke : SEATING_CANVAS.furnitureStroke,
      strokeWidth: SEATING_CANVAS.furnitureStrokeWidth,
      showOccupancy: false,
    };
  }
  if (input.selected) {
    return {
      fill: SEATING_CANVAS.selectedFill,
      stroke: SEATING_CANVAS.selectedStroke,
      strokeWidth: SEATING_CANVAS.selectedStrokeWidth,
      showOccupancy: true,
    };
  }
  return {
    fill: input.guestCount > 0 ? SEATING_CANVAS.guestFill : SEATING_CANVAS.guestFill,
    stroke: SEATING_CANVAS.guestStroke,
    strokeWidth: SEATING_CANVAS.guestStrokeWidth,
    showOccupancy: true,
  };
}

/** Hide long occupancy text when the object is too small at the current scale. */
export function shouldShowOccupancyOnObject(width: number, height: number, zoom: number): boolean {
  const minSide = Math.min(width, height) * zoom;
  return minSide >= 36;
}
