/**
 * Client migration classification — a Client import is customer + Event.
 * Preferred dates without a confirmed booking belong on Leads.
 */
import { isPastEventDate } from "@/lib/migration/historical-record";

export type ImportedBookingKind = "upcoming" | "historical";

export type ImportedClientClassification =
  | { kind: ImportedBookingKind; eventDate: string }
  | { kind: "hold"; message: string };

const BOOKED_TOKENS = new Set([
  "booked", "confirmed", "upcoming", "yes", "true", "1", "booked client",
]);
const HISTORICAL_TOKENS = new Set([
  "past", "complete", "completed", "historical", "happened", "done",
]);
const LEAD_TOKENS = new Set([
  "lead", "leads", "preferred", "inquiry", "prospect", "not booked", "unbooked",
]);

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

export function classifyImportedClientBooking(input: {
  eventDate: string | null | undefined;
  bookingStatus?: string | null;
  spaceId?: string | null;
  requiresSpace: boolean;
  spaceResolutionError?: string | null;
}): ImportedClientClassification {
  const eventDate = (input.eventDate ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return {
      kind: "hold",
      message:
        "Client import needs a confirmed event date. Import this person as a Lead if they have not booked.",
    };
  }

  const status = norm(input.bookingStatus);
  if (status && LEAD_TOKENS.has(status)) {
    return {
      kind: "hold",
      message:
        "This row is marked as not booked. Import it as a Lead. A preferred date does not create a Client booking.",
    };
  }

  const past = isPastEventDate(eventDate);
  if (status && HISTORICAL_TOKENS.has(status) && !past) {
    return {
      kind: "hold",
      message:
        "This row is marked as a past event, but the date is not in the past. Resolve the date or booking status before importing.",
    };
  }
  if (status && BOOKED_TOKENS.has(status) && past) {
    return { kind: "historical", eventDate };
  }

  const kind: ImportedBookingKind = past ? "historical" : "upcoming";

  if (kind === "upcoming" && input.spaceResolutionError) {
    return { kind: "hold", message: input.spaceResolutionError };
  }
  if (kind === "upcoming" && input.requiresSpace && !(input.spaceId ?? "").trim()) {
    return {
      kind: "hold",
      message:
        "Assign an Event Space before importing this booked event. This venue can host more than one event at the same time.",
    };
  }

  return { kind, eventDate };
}

export type ExistingImportedEvent = {
  id: string;
  eventDate: string | null;
  status: string;
};

export function findDuplicateImportedEvent(
  existing: readonly ExistingImportedEvent[],
  eventDate: string,
): ExistingImportedEvent | null {
  const date = eventDate.trim().slice(0, 10);
  return existing.find((row) =>
    row.status !== "cancelled" && (row.eventDate ?? "").slice(0, 10) === date,
  ) ?? null;
}

export function importedEventDisplayName(input: {
  firstName: string;
  lastName: string;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  eventType?: string | null;
}): string {
  const a = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const b = `${(input.partnerFirstName ?? "").trim()} ${(input.partnerLastName ?? "").trim()}`.trim();
  const couple = b ? `${a} & ${b}` : a;
  const typeLabel = (input.eventType ?? "").replace(/_/g, " ").trim() || "Event";
  return `${couple} — ${typeLabel}`;
}
