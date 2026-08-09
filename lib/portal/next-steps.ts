/**
 * Couple Home — Your Next Steps presentation.
 *
 * Groups / orders / caps the incomplete attention list for Home only.
 * Obligation synthesis and payment canonicalization stay in
 * `buildUnifiedTaskList` + `selectCanonicalPaymentSchedules` (Tasks-compatible).
 */
import { formatAbsoluteDueDate } from "@/lib/playbooks/due-dates";
import type { UnifiedTask, UnifiedTaskOwnership, UnifiedTaskTargetSection } from "@/lib/portal/unified-tasks";

export const NEXT_STEPS_HOME_CAP = 5;

export type NextStepsItem = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  isRequired: boolean;
  ownership: UnifiedTaskOwnership;
  targetSection: UnifiedTaskTargetSection;
  actionLabel: string;
  /** Optional kind for compact CTA wording; vendor rows may omit. */
  kind?: UnifiedTask["kind"] | "vendor_task";
};

function todayIso(today?: string): string {
  return today ?? new Date().toISOString().slice(0, 10);
}

function tomorrowIso(today?: string): string {
  const base = new Date(`${todayIso(today)}T12:00:00`);
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

/** Within-group order: overdue → due today → due tomorrow → soonest dated → undated. */
export function compareNextStepsWithinGroup(
  a: Pick<NextStepsItem, "dueDate" | "isOverdue">,
  b: Pick<NextStepsItem, "dueDate" | "isOverdue">,
  today?: string,
): number {
  const t = todayIso(today);
  const tom = tomorrowIso(today);

  if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;

  const rank = (due: string | null, overdue: boolean): number => {
    if (overdue) return 0;
    if (!due) return 4;
    if (due === t) return 1;
    if (due === tom) return 2;
    return 3;
  };

  const ra = rank(a.dueDate, a.isOverdue);
  const rb = rank(b.dueDate, b.isOverdue);
  if (ra !== rb) return ra - rb;

  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (a.dueDate && !b.dueDate) return -1;
  if (!a.dueDate && b.dueDate) return 1;
  return 0;
}

export function sortNextStepsWithinGroup<T extends Pick<NextStepsItem, "dueDate" | "isOverdue">>(
  items: T[],
  today?: string,
): T[] {
  return [...items].sort((a, b) => compareNextStepsWithinGroup(a, b, today));
}

/**
 * Cap for Home: fill with venue-required (P1) first, then highest-priority
 * shared planning (P2). Does not force one of every category.
 * Completed items must be filtered out by the caller.
 */
export function selectNextStepsForHome(
  items: NextStepsItem[],
  cap = NEXT_STEPS_HOME_CAP,
  today?: string,
): { visible: NextStepsItem[]; total: number; hasMore: boolean } {
  const venue = sortNextStepsWithinGroup(
    items.filter((i) => i.ownership === "venue"),
    today,
  );
  const shared = sortNextStepsWithinGroup(
    items.filter((i) => i.ownership === "shared"),
    today,
  );
  const ordered = [...venue, ...shared];
  const total = ordered.length;
  const visible = ordered.slice(0, Math.max(0, cap));
  return { visible, total, hasMore: total > visible.length };
}

/** Fixed display groups: From your venue, then Shared planning (omit empty). */
export function groupNextStepsForDisplay(visible: NextStepsItem[]): {
  venue: NextStepsItem[];
  shared: NextStepsItem[];
} {
  return {
    venue: visible.filter((i) => i.ownership === "venue"),
    shared: visible.filter((i) => i.ownership === "shared"),
  };
}

/**
 * Due copy: Due today / Due tomorrow / Due Aug 18 /
 * Overdue — needed by Aug 18. No shame phrasing.
 */
export function formatNextStepsDueLabel(
  dueDate: string | null,
  isOverdue: boolean,
  today?: string,
): string | null {
  if (!dueDate) return null;
  const t = todayIso(today);
  const tom = tomorrowIso(today);
  if (isOverdue || dueDate < t) {
    return `Overdue — needed by ${formatAbsoluteDueDate(dueDate)}`;
  }
  if (dueDate === t) return "Due today";
  if (dueDate === tom) return "Due tomorrow";
  return `Due ${formatAbsoluteDueDate(dueDate)}`;
}

/** Compact Home CTA wording from existing destination actions (navigate only — never implies complete-in-place). */
export function compactNextStepsActionLabel(item: Pick<NextStepsItem, "actionLabel" | "kind">): string {
  const raw = item.actionLabel.trim();
  const lower = raw.toLowerCase();

  if (item.kind === "payment" || lower.includes("pay")) return "Pay";
  if (item.kind === "timeline" || lower.includes("submit")) return "Submit";
  if (lower.includes("upload")) return "Upload";
  if (lower.includes("approve")) return "Approve";
  if (lower.includes("review") || lower.includes("respond") || lower.includes("sign")) return "Review";
  // Checklist / vendor / questionnaire Home rows only navigate — "Complete" would imply finish-here.
  if (
    item.kind === "venue_task" ||
    item.kind === "vendor_task" ||
    item.kind === "questionnaire" ||
    lower === "mark complete" ||
    lower === "complete" ||
    lower === "complete form" ||
    lower.includes("complete") ||
    lower === "done"
  ) {
    return "Review";
  }
  if (lower === "view") return "Review";
  return raw;
}

export function fromUnifiedTask(t: UnifiedTask): NextStepsItem {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    dueDate: t.dueDate,
    isOverdue: t.isOverdue,
    isRequired: t.isRequired,
    ownership: t.ownership,
    targetSection: t.targetSection,
    actionLabel: t.actionLabel,
    kind: t.kind,
  };
}
