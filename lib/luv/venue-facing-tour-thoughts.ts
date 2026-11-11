/**
 * Venue-facing completed-tour Thoughts copy.
 *
 * Internal tour_appointments.notes are legitimate input HERE (private
 * intelligence for the venue team). They must not enter customer-facing
 * drafts — that boundary stays in drafts.ts / evaluateCompletedTour.
 *
 * This module does not classify ACTION / CONTEXT / SILENCE.
 *
 * Thoughts must synthesize — never prefix/read back the venue's own notes.
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

export type VenueFacingTourNoteSignals = {
  strongInterest: boolean;
  ownSecurity: boolean;
  operationalFollowUp: string | null;
};

/** Grounded signals only — no booking predictions, no invented tasks. */
export function extractVenueFacingTourNoteSignals(
  notes: string,
): VenueFacingTourNoteSignals {
  const t = notes.toLowerCase();
  const strongInterest = /\b(loved|love the|really liked|excited about|fell in love|enthusiastic)\b/.test(t);
  const ownSecurity =
    /\b((?:their|her|his|our) own security|own security|bring(?:ing)? (?:their )?own security|provide[sd]? (?:their )?own security)\b/.test(t);

  let operationalFollowUp: string | null = null;
  const sendMatch = t.match(
    /\b(?:need to |still need to |remember to )?(?:email|send) (?:them )?(?:the )?([a-z0-9]+(?:[ -][a-z0-9]+){0,3})\b/,
  );
  if (sendMatch?.[1]) {
    const item = sendMatch[1]
      .replace(/\s+(after|before|for|with|during|from|about|regarding)\b.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (item.length >= 3 && !/^(them|it|this|that|you|we)$/.test(item)) {
      operationalFollowUp = item;
    }
  }
  return { strongInterest, ownSecurity, operationalFollowUp };
}

/** True when copy contains a long verbatim run of the source note. */
export function thoughtsEchoRawNote(copy: string, notes: string, minRun = 28): boolean {
  const source = notes.replace(/\s+/g, " ").trim().toLowerCase();
  const out = copy.replace(/\s+/g, " ").trim().toLowerCase();
  if (source.length < minRun) {
    return source.length >= 12 && out.includes(source);
  }
  for (let i = 0; i <= source.length - minRun; i++) {
    if (out.includes(source.slice(i, i + minRun))) return true;
  }
  return false;
}

function noAttentionNeeded(name: string): string {
  return `${name} has toured the venue. Nothing from the tour record currently needs your attention.`;
}

/**
 * Discrete first-name + rest. Template string — never JSX `{name} has`.
 * Uses internal notes as context; never restates them with "Your notes:".
 */
export function venueFacingCompletedTourThoughts(
  firstName: string,
  internalTourNotes?: string | null,
): string {
  const name = firstName.trim() || "This couple";
  const notes = usefulInternalTourNote(internalTourNotes);
  if (!notes) return noAttentionNeeded(name);

  const signals = extractVenueFacingTourNoteSignals(notes);
  const clauses: string[] = [];
  if (signals.strongInterest) clauses.push("the tour notes indicate strong interest");
  if (signals.ownSecurity) clauses.push("they plan to provide their own security");
  if (signals.operationalFollowUp) {
    clauses.push(`a follow-up on the ${signals.operationalFollowUp} still needs handling`);
  }

  if (clauses.length === 0) return noAttentionNeeded(name);

  if (clauses.length === 1) {
    const only = clauses[0]!;
    if (only.startsWith("they plan")) {
      return `${name} has toured the venue, and ${only}.`;
    }
    return `${name} has toured the venue. ${only.charAt(0).toUpperCase()}${only.slice(1)}.`;
  }

  const head = clauses[0]!;
  const rest = clauses.slice(1);
  const joined = rest.length === 1
    ? `${head}, and ${rest[0]}`
    : `${head}, ${rest.slice(0, -1).join(", ")}, and ${rest[rest.length - 1]}`;
  return `${name} has toured the venue. ${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
}
