/**
 * Unified Tasks — the couple's operational home (Client Collaboration
 * Workspace, 2026-07-22): "the couple should never have to hunt through
 * the application to complete an assigned task." One chronological,
 * date-driven list synthesized from every venue-assigned system that can
 * put something on a couple's plate — not a new source of truth, a
 * normalized read over data every one of these systems already exposes.
 *
 * Pure, I/O-free — the caller fetches from each system's own existing
 * endpoint and hands the results here.
 */
import type { PortalRequestSummary } from "@/lib/requests/types";
import type { PortalTask } from "@/lib/portal/types";

export type UnifiedTaskKind = "venue_task" | "request" | "contract" | "payment" | "questionnaire" | "timeline";

/** Home Next Steps ownership — couple personal todos never appear here. */
export type UnifiedTaskOwnership = "venue" | "shared";

export type UnifiedTask = {
  id: string;
  kind: UnifiedTaskKind;
  title: string;
  description: string | null;
  dueDate: string | null;
  /** Present for venue_task items — used for event-relative due labels. */
  daysOffset?: number | null;
  dueDateLocked?: boolean;
  completed: boolean;
  /** Overdue venue need / past-due shared obligation — sorted before upcoming. */
  isOverdue: boolean;
  /** Venue-required cue for Home list rows (venue_task only when isRequired). */
  isRequired: boolean;
  ownership: UnifiedTaskOwnership;
  // Where completing this actually happens — Tasks never re-implements
  // another section's real action (a payment button, a sign flow, a
  // questionnaire form); it always hands off to the section that owns it.
  targetSection: "tasks" | "requests" | "documents" | "payments" | "questionnaire" | "timeline";
  actionLabel: string;
  // Only venue_task items complete in place, directly within the list —
  // everything else's completion is derived from the owning system's own
  // real state (paid, signed, submitted).
  completableHere: boolean;
};

type PaymentSchedule = {
  title: string;
  lineItems: { id: string; label: string; amount: number; dueDate: string | null; status: string }[];
};

type ContractDoc = { id: string; docType: string; name: string; status: string | null; signToken?: string | null };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPastDue(dueDate: string | null | undefined, today = todayIso()): boolean {
  return Boolean(dueDate && dueDate < today);
}

export function ownershipForKind(kind: UnifiedTaskKind): UnifiedTaskOwnership {
  if (kind === "payment" || kind === "timeline") return "shared";
  return "venue";
}

export function ownershipLabel(ownership: UnifiedTaskOwnership): string {
  return ownership === "shared" ? "Shared planning" : "From your venue";
}

export function buildUnifiedTaskList(input: {
  venueTasks: PortalTask[];
  requests: PortalRequestSummary[];
  paymentSchedules: PaymentSchedule[];
  questionnaire: { status: string } | null;
  documents: ContractDoc[];
  timelineHasUnpublishedChanges: boolean;
}): UnifiedTask[] {
  const out: UnifiedTask[] = [];
  const today = todayIso();

  for (const t of input.venueTasks) {
    const done = t.status === "complete";
    const overdue = !done && (t.status === "overdue" || isPastDue(t.dueDate, today));
    out.push({
      id: `task_${t.id}`, kind: "venue_task", title: t.title, description: t.description,
      dueDate: t.dueDate, daysOffset: t.daysOffset, dueDateLocked: false, completed: done,
      isOverdue: overdue, isRequired: t.isRequired, ownership: "venue",
      targetSection: "tasks",
      actionLabel: done ? "Done" : t.canComplete ? "Mark complete" : "View",
      completableHere: !done && t.canComplete,
    });
  }

  for (const r of input.requests) {
    if (r.status === "submitted" || r.status === "reviewed" || r.status === "completed" || r.status === "cancelled") continue;
    if (!r.clientActionEnabled) continue;
    const overdue = isPastDue(r.dueDate, today);
    out.push({
      id: `request_${r.id}`, kind: "request", title: r.title, description: r.description,
      dueDate: r.dueDate, completed: false, isOverdue: overdue, isRequired: false, ownership: "venue",
      targetSection: "requests",
      actionLabel: r.requestType === "approval" ? "Review & respond" : r.requestType === "upload" ? "Upload" : "Respond",
      completableHere: false,
    });
  }

  for (const d of input.documents) {
    if (d.docType !== "contract" || d.status !== "sent" || !d.signToken) continue;
    out.push({
      id: `contract_${d.id}`, kind: "contract", title: `Sign: ${d.name}`, description: "Your venue is waiting on your signature.",
      dueDate: null, completed: false, isOverdue: false, isRequired: false, ownership: "venue",
      targetSection: "documents", actionLabel: "Review & sign",
      completableHere: false,
    });
  }

  for (const s of input.paymentSchedules) {
    for (const li of s.lineItems) {
      if (li.status === "paid" || li.status === "cancelled") continue;
      const overdue = li.status === "overdue" || isPastDue(li.dueDate, today);
      out.push({
        id: `payment_${li.id}`, kind: "payment", title: li.label, description: `${s.title} — payment due`,
        dueDate: li.dueDate, completed: false, isOverdue: overdue, isRequired: false, ownership: "shared",
        targetSection: "payments", actionLabel: "Pay now",
        completableHere: false,
      });
    }
  }

  if (input.questionnaire && input.questionnaire.status === "sent") {
    out.push({
      id: "questionnaire", kind: "questionnaire", title: "Complete your final details form",
      description: "Guest count, songs, meal preferences, and day-of contacts.",
      dueDate: null, completed: false, isOverdue: false, isRequired: false, ownership: "venue",
      targetSection: "questionnaire", actionLabel: "Complete form",
      completableHere: false,
    });
  }

  if (input.timelineHasUnpublishedChanges) {
    out.push({
      id: "timeline", kind: "timeline", title: "Submit your timeline updates",
      description: "You've made changes your venue hasn't seen yet.",
      dueDate: null, completed: false, isOverdue: false, isRequired: false, ownership: "shared",
      targetSection: "timeline", actionLabel: "Review & submit",
      completableHere: false,
    });
  }

  // Attention order: overdue first, then earliest due date, undated last
  // (stable within equal buckets).
  return out.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}
