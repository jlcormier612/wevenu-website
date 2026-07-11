import { TIMELINE_AUDIENCES } from "@/lib/timeline/types";

export { TIMELINE_AUDIENCES };

/** "+90 min" / "-30 min" / "At event start", for card and list display. */
export function formatMinutesOffset(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes === 0) return "At event start";
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${Math.abs(minutes)} min`;
}
