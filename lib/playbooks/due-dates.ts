/**
 * Event-relative task due dates.
 *
 * Source of truth for unlockedish planning tasks is `days_offset` relative to
 * `events.event_date` (event start). `due_date` is the resolved calendar day
 * used for overdue, reminders, and display — recomputed when the event date
 * changes. Multi-day events always anchor to start (`event_date`), not end.
 */

/** Add `days` to an ISO date string (YYYY-MM-DD). Noon local avoids DST edge cases. */
export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Signed day delta from `fromDate` to `toDate` (both YYYY-MM-DD). */
export function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + "T12:00:00").getTime();
  const to = new Date(toDate + "T12:00:00").getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Days until due (negative = overdue). */
export function daysUntilDue(dueDate: string, today = new Date().toISOString().slice(0, 10)): number {
  return daysBetween(today, dueDate);
}

export function formatAbsoluteDueDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Short relative phrase without “the event” — “30 days before”, “On the event day”. */
export function formatShortDaysOffset(offset: number): string {
  if (offset === 0) return "On the event day";
  if (offset < 0) {
    const n = Math.abs(offset);
    return `${n} day${n === 1 ? "" : "s"} before`;
  }
  return `${offset} day${offset === 1 ? "" : "s"} after`;
}

/** Urgency from the resolved calendar due date. */
export function formatUrgencyDue(dueDate: string, today?: string): string {
  const du = daysUntilDue(dueDate, today);
  if (du < -1) return `${Math.abs(du)} days overdue`;
  if (du === -1) return "1 day overdue";
  if (du === 0) return "Due today";
  if (du === 1) return "Due tomorrow";
  if (du <= 14) return `Due in ${du} days`;
  return `Due ${formatAbsoluteDueDate(dueDate)}`;
}

/**
 * Human due label for venue / couple / vendor surfaces.
 * - planning: “30 days before · Sept 12”
 * - urgency:  “Due in 12 days · 30 days before” (falls back sensibly when far out)
 * Locked absolute overrides show the calendar date only (plus “(fixed)” in planning).
 */
export function formatEventRelativeDue(opts: {
  daysOffset?: number | null;
  dueDate?: string | null;
  dueDateLocked?: boolean;
  style?: "planning" | "urgency";
  today?: string;
}): string {
  const { daysOffset, dueDate, dueDateLocked = false, style = "planning", today } = opts;

  if (dueDateLocked || daysOffset == null) {
    if (!dueDate) return daysOffset != null ? formatShortDaysOffset(daysOffset) : "";
    if (style === "urgency") return formatUrgencyDue(dueDate, today);
    return `${formatAbsoluteDueDate(dueDate)}${dueDateLocked ? " (fixed)" : ""}`;
  }

  const relative = formatShortDaysOffset(daysOffset);

  if (style === "urgency") {
    if (!dueDate) return relative;
    const urgency = formatUrgencyDue(dueDate, today);
    // When urgency already encodes the calendar day far out, still include relative meaning.
    if (urgency.startsWith("Due ") && !urgency.includes(" in ") && !urgency.includes("today") && !urgency.includes("tomorrow")) {
      return `${urgency} · ${relative}`;
    }
    return `${urgency} · ${relative}`;
  }

  if (dueDate) return `${relative} · ${formatAbsoluteDueDate(dueDate)}`;
  return relative;
}
