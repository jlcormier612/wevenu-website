/**
 * Task Center classification — DO / WATCH / INVESTIGATE.
 *
 * Ownership source of truth (matches playbook Builder + readiness-by-kind):
 *   couple  → client/couple-owned work (Client Planning)
 *   other   → venue/team operational work (Venue Planning), including vendor-owned
 *
 * Visibility is secondary. Prefer owner_type when they disagree.
 *
 * Dashboard Next Steps uses priority "venue" vs "shared" for the same split;
 * Task Center uses DO vs WATCH as the durable workspace language.
 */

export type TaskCenterUrgency =
  | "overdue"
  | "blocked"
  | "due_today"
  | "due_soon"
  | "upcoming";

export type TaskCenterLane = "do" | "watch" | "neither";

export type TaskCenterClassifyInput = {
  ownerType: string;
  status: string;
  dueDate: string;
  isRequired: boolean;
  autoCompleteTrigger: string | null;
  /** Event has a Client Planning application with released_at set. */
  clientPlanningReleased: boolean;
};

export const UPCOMING_DO_PREVIEW = 12;

/** Couple-owned Client Planning work — never DO. */
export function isCoupleOwned(ownerType: string): boolean {
  return ownerType === "couple";
}

/** Venue/team operational work (includes vendor-owned Venue Planning tasks). */
export function isDoOwned(ownerType: string): boolean {
  return !isCoupleOwned(ownerType);
}

export function computeTaskCenterUrgency(
  status: string,
  dueDate: string,
  today: string,
  weekOut: string,
): TaskCenterUrgency {
  if (status === "blocked") return "blocked";
  if (status === "complete" || status === "waived") return "upcoming";
  const due = dueDate.slice(0, 10);
  if (due < today || status === "overdue") return "overdue";
  if (due === today) return "due_today";
  if (due <= weekOut) return "due_soon";
  return "upcoming";
}

/**
 * Meaningful client progress for WATCH.
 * Unreleased Client Planning never surfaces.
 * Far-future optional (and far-future required that is not yet due soon) stay out.
 */
export function qualifiesForWatch(
  input: TaskCenterClassifyInput,
  today: string,
  weekOut: string,
): boolean {
  if (!isCoupleOwned(input.ownerType)) return false;
  if (!input.clientPlanningReleased) return false;

  const urgency = computeTaskCenterUrgency(input.status, input.dueDate, today, weekOut);
  if (urgency === "blocked" || urgency === "overdue") return true;

  if (urgency === "due_today" || urgency === "due_soon") {
    // Near-term client work is always awareness-worthy once released.
    return true;
  }

  // Far future: only event-critical required items with a domain trigger —
  // still excluded from proactive WATCH (they belong on event Planning until due soon).
  // Spec: far-future optional stays out; far-future required also stays out of the queue.
  void input.isRequired;
  void input.autoCompleteTrigger;
  return false;
}

export function laneForTask(
  input: TaskCenterClassifyInput,
  today: string,
  weekOut: string,
): TaskCenterLane {
  if (isDoOwned(input.ownerType)) return "do";
  if (qualifiesForWatch(input, today, weekOut)) return "watch";
  return "neither";
}

export type SearchableEvent = {
  id: string;
  name: string;
  eventDate: string | null;
  coupleLabel: string;
};

/** Case-insensitive match on couple label or event name. */
export function matchEventsForFind(
  events: SearchableEvent[],
  query: string,
): SearchableEvent[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return events.filter((e) => {
    const hay = `${e.coupleLabel} ${e.name}`.toLowerCase();
    return hay.includes(q);
  });
}

export function coupleLabelFromParts(parts: {
  first_name?: string | null;
  last_name?: string | null;
  partner_first_name?: string | null;
  partner_last_name?: string | null;
} | null | undefined): string {
  if (!parts) return "";
  const a = [parts.first_name, parts.last_name].filter(Boolean).join(" ").trim();
  const b = [parts.partner_first_name, parts.partner_last_name].filter(Boolean).join(" ").trim();
  if (a && b) return `${parts.first_name} & ${parts.partner_first_name}`;
  return a || b;
}
