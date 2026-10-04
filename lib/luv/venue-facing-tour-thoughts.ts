/**
 * Venue-facing completed-tour Thoughts copy.
 *
 * Internal tour_appointments.notes are legitimate input HERE (private
 * intelligence for the venue team). They must not enter customer-facing
 * drafts — that boundary stays in drafts.ts / evaluateCompletedTour.
 *
 * This module does not classify ACTION / CONTEXT / SILENCE.
 */

import { classifyFollowUpTourState } from "@/lib/luv/follow-up-workflow-context";

const PLACEHOLDER_NOTE = /^(n\/?a|none|nil|null|-|—|–|\.|notes?)\.?$/i;

export function usefulInternalTourNote(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 8) return null;
  if (PLACEHOLDER_NOTE.test(cleaned)) return null;
  return cleaned;
}

/**
 * Pick notes from the same completed appointment classifyFollowUpTourState uses.
 * Archived rows stay eligible — archive is list hygiene, not "tour didn't happen."
 */
export function internalTourNotesForFollowUp(
  appointments: Array<{
    status: string;
    scheduledAt: string | null;
    actualOccurredAt?: string | null;
    completedAt?: string | null;
    notes: string | null;
  }>,
): string | null {
  const rows = appointments.map((a) => ({
    scheduled_at: a.scheduledAt ?? a.actualOccurredAt ?? a.completedAt ?? "",
    status: a.status,
    notes: a.notes,
  }));
  const classified = classifyFollowUpTourState(rows);
  if (classified.kind !== "completed") return null;
  const sorted = [...rows].sort((a, b) =>
    String(b.scheduled_at).localeCompare(String(a.scheduled_at)),
  );
  const active = sorted.find((r) => r.status !== "cancelled");
  if (!active || active.status !== "completed") return null;
  return usefulInternalTourNote(active.notes);
}

/**
 * Discrete first-name + rest. Template string — never JSX `{name} toured`.
 * When notes exist, they are attributed as the venue's notes (no extra inference).
 */
export function venueFacingCompletedTourThoughts(
  firstName: string,
  internalTourNotes?: string | null,
): string {
  const name = firstName.trim() || "This couple";
  const notes = usefulInternalTourNote(internalTourNotes);
  if (!notes) return `${name} toured the venue.`;
  return `${name} toured the venue. Your notes: ${notes}`;
}
