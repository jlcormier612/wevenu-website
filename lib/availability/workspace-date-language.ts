/**
 * Date wording for a lead and its pre-booking client workspace.
 * A preferred date, an active hold, and a booked event are different states.
 * A hold counts only while it still protects availability and covers the date shown.
 */
import { formatDate } from "@/lib/availability/constants";
import { holdCoversDate, holdProtectsAvailability } from "@/lib/availability/hold-occupancy";
import type { HoldStatus } from "@/lib/availability/types";

export type WorkspaceDateHold = {
  leadId?: string | null;
  holdDate: string;
  endDate?: string | null;
  status: HoldStatus;
  expiresAt?: string | null;
};

export type WorkspaceDateKind = "none" | "preferred" | "held" | "booked";

export function workspaceDateKind(opts: {
  eventDate: string | null | undefined;
  booked: boolean;
  holds?: readonly WorkspaceDateHold[];
  leadId?: string | null;
  nowMs?: number;
}): WorkspaceDateKind {
  const date = opts.eventDate?.trim() || null;
  if (opts.booked && date) return "booked";
  if (!date) return "none";
  const covers = (opts.holds ?? []).some((hold) => {
    if (opts.leadId && hold.leadId !== opts.leadId) return false;
    if (!holdProtectsAvailability(hold, opts.nowMs)) return false;
    return holdCoversDate(hold, date);
  });
  return covers ? "held" : "preferred";
}

export function workspaceDateText(opts: {
  eventDate: string | null | undefined;
  booked: boolean;
  holds?: readonly WorkspaceDateHold[];
  leadId?: string | null;
  nowMs?: number;
}): string {
  const kind = workspaceDateKind(opts);
  const label = formatDate(opts.eventDate);
  if (kind === "booked") return `Event date: ${label}.`;
  if (kind === "held") return `Date held: ${label}. This date is held but not yet booked.`;
  if (kind === "preferred") return `Preferred date: ${label}. This is a preference, not a reservation.`;
  return "No preferred date yet. A preferred date does not reserve a date.";
}
