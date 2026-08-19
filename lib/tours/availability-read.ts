import type { TourAvailabilityException, TourAvailabilityWindow } from "@/lib/tours/types";

export type TourAvailabilityLoad =
  | { ok: true; windows: TourAvailabilityWindow[]; exceptions: TourAvailabilityException[] }
  | { ok: false; error: string };

/**
 * Parse the coordinator availability RPC payload.
 * A failed or malformed payload is never treated as an empty schedule.
 */
export function parseCoordinatorTourAvailability(payload: unknown): TourAvailabilityLoad {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, error: "Could not load tour availability." };
  }
  const d = payload as Record<string, unknown>;
  if (d.ok !== true) {
    const code = typeof d.error === "string" ? d.error : "read_failed";
    return { ok: false, error: code === "unauthorized" ? "Session expired." : "Could not load tour availability." };
  }
  if (!Array.isArray(d.windows) || !Array.isArray(d.exceptions)) {
    return { ok: false, error: "Could not load tour availability." };
  }
  const windows: TourAvailabilityWindow[] = [];
  for (const row of d.windows) {
    if (!row || typeof row !== "object") return { ok: false, error: "Could not load tour availability." };
    const w = row as Record<string, unknown>;
    if (typeof w.id !== "string" || typeof w.dayOfWeek !== "number" || typeof w.startTime !== "string" || typeof w.endTime !== "string") {
      return { ok: false, error: "Could not load tour availability." };
    }
    windows.push({
      id: w.id,
      dayOfWeek: w.dayOfWeek,
      startTime: String(w.startTime).slice(0, 5),
      endTime: String(w.endTime).slice(0, 5),
      sortOrder: typeof w.sortOrder === "number" ? w.sortOrder : 0,
    });
  }
  const exceptions: TourAvailabilityException[] = [];
  for (const row of d.exceptions) {
    if (!row || typeof row !== "object") return { ok: false, error: "Could not load tour availability." };
    const e = row as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.startDate !== "string" || typeof e.endDate !== "string") {
      return { ok: false, error: "Could not load tour availability." };
    }
    exceptions.push({
      id: e.id,
      startDate: e.startDate,
      endDate: e.endDate,
      label: typeof e.label === "string" ? e.label : null,
    });
  }
  return { ok: true, windows, exceptions };
}

/** Editor hydration: failed reads do not become an empty schedule. */
export function editorHydrationFromAvailability(load: TourAvailabilityLoad): {
  windows: TourAvailabilityWindow[];
  exceptions: TourAvailabilityException[];
  loadError: string | null;
} {
  if (!load.ok) {
    return { windows: [], exceptions: [], loadError: load.error };
  }
  return { windows: load.windows, exceptions: load.exceptions, loadError: null };
}
