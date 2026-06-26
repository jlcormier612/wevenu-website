/**
 * Clients reference data and display helpers (Sprint 9).
 */
import type { Client, ClientInput, ClientStatus } from "@/lib/clients/types";
import { EVENT_TYPES } from "@/lib/leads/constants";

// Re-export so client forms don't need to import from leads.
export { EVENT_TYPES };
export { eventTypeLabel } from "@/lib/leads/constants";

export type StatusMeta = { value: ClientStatus; label: string; description: string };

export const CLIENT_STATUSES: StatusMeta[] = [
  { value: "planning",   label: "Planning",   description: "Actively planning their event" },
  { value: "confirmed",  label: "Confirmed",  description: "All details finalized" },
  { value: "complete",   label: "Complete",   description: "Event happened successfully" },
  { value: "cancelled",  label: "Cancelled",  description: "Booking was cancelled" },
];

/** Suggested key date labels for quick entry. */
export const KEY_DATE_SUGGESTIONS = [
  "Rehearsal Dinner",
  "Final Guest Count Due",
  "Day-of Timeline Sent",
  "Menu Selection Deadline",
  "Venue Walkthrough",
  "Floor Plan Finalized",
];

export function clientStatusLabel(status: string): string {
  return CLIENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function clientDisplayName(
  firstName: string,
  lastName: string,
  partnerFirstName?: string | null,
  partnerLastName?: string | null,
): string {
  const primary = [firstName, lastName].filter(Boolean).join(" ");
  const partner =
    partnerFirstName || partnerLastName
      ? [partnerFirstName, partnerLastName].filter(Boolean).join(" ")
      : null;
  return partner ? `${primary} & ${partner}` : primary;
}

export function createInitialClientInput(source?: Client | null): ClientInput {
  return {
    firstName: source?.firstName ?? "",
    lastName: source?.lastName ?? "",
    email: source?.email ?? "",
    phone: source?.phone ?? "",
    partnerFirstName: source?.partnerFirstName ?? "",
    partnerLastName: source?.partnerLastName ?? "",
    partnerEmail: source?.partnerEmail ?? "",
    eventType: source?.eventType ?? "",
    eventDate: source?.eventDate ?? "",
    endDate: source?.endDate ?? "",
    guestCount: source?.guestCount != null ? String(source.guestCount) : "",
    ceremonyTime: source?.ceremonyTime ?? "",
    receptionTime: source?.receptionTime ?? "",
    rehearsalDate: source?.rehearsalDate ?? "",
    internalNotes: source?.internalNotes ?? "",
  };
}

/** Days from today until a given ISO date. Negative = past. */
export function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  const date = new Date();
  date.setHours(Number(h), Number(m));
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
