/**
 * Compact conversation-header orientation (Inbox Product).
 * One event reference when unambiguous; never invents a primary among many.
 */

import type { ConversationSummary } from "@/lib/conversations/types";

export type ConversationHeaderOrientation = {
  relationshipLabel: "Lead" | "Booking";
  /** Single orientation line under the name, or null when nothing useful. */
  eventLine: string | null;
  workspaceHref: string | null;
  workspaceLabel: string | null;
};

function formatLongDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * List-row cue: short date + type OR name — never both type and a name that
 * already repeats the type.
 */
export function formatInboxListEventCue(c: ConversationSummary): string | null {
  if (c.eventCount === 1 && c.eventDate) {
    const d = new Date(`${c.eventDate}T12:00:00`);
    const dateLabel = Number.isNaN(d.getTime())
      ? c.eventDate
      : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (c.eventType) return `${dateLabel} ${c.eventType}`;
    if (c.eventName) return `${dateLabel} · ${c.eventName}`;
    return dateLabel;
  }
  if (!c.clientId && c.preferredDate) {
    const d = new Date(`${c.preferredDate}T12:00:00`);
    const dateLabel = Number.isNaN(d.getTime())
      ? c.preferredDate
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `Preferred · ${dateLabel}`;
  }
  if ((c.eventCount ?? 0) > 1) return "Multiple events";
  return null;
}

export function conversationHeaderOrientation(
  summary: ConversationSummary,
): ConversationHeaderOrientation {
  const isBooking = !!summary.clientId;
  const relationshipLabel: "Lead" | "Booking" = isBooking ? "Booking" : "Lead";
  const workspaceHref = summary.clientId
    ? `/clients/${summary.clientId}`
    : summary.leadId
      ? `/leads/${summary.leadId}`
      : null;
  const workspaceLabel = summary.clientId
    ? "Open booking workspace →"
    : summary.leadId
      ? "Open lead workspace →"
      : null;

  let eventLine: string | null = null;
  if (isBooking) {
    if (summary.eventCount === 1 && (summary.eventName || summary.eventDate)) {
      const dateLabel = formatLongDate(summary.eventDate);
      const name = summary.eventName?.trim() || null;
      if (name && dateLabel) eventLine = `Event · ${name} · ${dateLabel}`;
      else if (name) eventLine = `Event · ${name}`;
      else if (dateLabel) eventLine = `Event · ${dateLabel}`;
    } else if ((summary.eventCount ?? 0) > 1) {
      eventLine = "Multiple events — use the booking workspace for full details";
    }
  } else if (summary.preferredDate) {
    const dateLabel = formatLongDate(summary.preferredDate);
    eventLine = dateLabel ? `Preferred date · ${dateLabel}` : null;
  }

  return { relationshipLabel, eventLine, workspaceHref, workspaceLabel };
}
