/**
 * Events reference data and display helpers (Sprint 11).
 */
import type { EventInput, EventStatus, VenueEvent } from "@/lib/events/types";

export type StatusMeta = { value: EventStatus; label: string; description: string };

export const EVENT_STATUSES: StatusMeta[] = [
  { value: "draft",       label: "Draft",       description: "Not yet fully confirmed" },
  { value: "confirmed",   label: "Confirmed",   description: "All details confirmed" },
  { value: "in_progress", label: "In Progress", description: "Event is actively underway" },
  { value: "complete",    label: "Complete",    description: "Event happened successfully" },
  { value: "cancelled",   label: "Cancelled",   description: "Event was cancelled" },
];

export function eventStatusLabel(status: string): string {
  return EVENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

/** Single day, or "June 5 – June 7, 2026" when end is after start. */
export function formatEventDateRange(
  start: string | null | undefined,
  end?: string | null | undefined,
): string {
  if (!start) return "";
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Short range for compact lists (e.g. "Fri, Jun 5 – Sun, Jun 7"). */
export function formatEventDateRangeShort(
  start: string | null | undefined,
  end?: string | null | undefined,
): string {
  if (!start) return "";
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Persist null for single-day (empty or equal to start). */
export function normalizeEventEndDate(start: string, end: string | null | undefined): string | null {
  const trimmed = (end ?? "").trim();
  if (!trimmed || trimmed === start) return null;
  return trimmed;
}

export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  return new Date(0, 0, 0, Number(h), Number(m)).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });
}

export function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Build an initial EventInput, optionally pre-filled from an existing event or client data. */
export function createInitialEventInput(
  source?: Partial<{
    name: string;
    eventType: string;
    eventDate: string;
    eventEndDate: string | null;
    guestCount: number | null;
    clientId: string;
    spaceId: string | null;
  }> | null,
): EventInput {
  return {
    name: source?.name ?? "",
    eventType: source?.eventType ?? "",
    eventDate: source?.eventDate ?? "",
    eventEndDate: source?.eventEndDate ?? "",
    startTime: "",
    endTime: "",
    setupTime: "",
    teardownTime: "",
    guestCount: source?.guestCount != null ? String(source.guestCount) : "",
    clientId: source?.clientId ?? "",
    spaceId: source?.spaceId ?? "",
  };
}

export function eventInputFromVenueEvent(ev: VenueEvent): EventInput {
  return {
    name: ev.name,
    eventType: ev.eventType ?? "",
    eventDate: ev.eventDate,
    eventEndDate: ev.eventEndDate ?? "",
    startTime: ev.startTime ?? "",
    endTime: ev.endTime ?? "",
    setupTime: ev.setupTime ?? "",
    teardownTime: ev.teardownTime ?? "",
    guestCount: ev.guestCount != null ? String(ev.guestCount) : "",
    clientId: ev.clientId ?? "",
    spaceId: ev.spaceId ?? "",
  };
}
