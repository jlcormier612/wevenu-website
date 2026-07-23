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

export type UnifiedTask = {
  id: string;
  kind: UnifiedTaskKind;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
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

export function buildUnifiedTaskList(input: {
  venueTasks: PortalTask[];
  requests: PortalRequestSummary[];
  paymentSchedules: PaymentSchedule[];
  questionnaire: { status: string } | null;
  documents: ContractDoc[];
  timelineHasUnpublishedChanges: boolean;
}): UnifiedTask[] {
  const out: UnifiedTask[] = [];

  for (const t of input.venueTasks) {
    if (t.status === "complete") continue;
    out.push({
      id: `task_${t.id}`, kind: "venue_task", title: t.title, description: t.description,
      dueDate: t.dueDate, completed: false, targetSection: "tasks",
      actionLabel: t.canComplete ? "Mark complete" : "View",
      completableHere: t.canComplete,
    });
  }

  for (const r of input.requests) {
    if (r.status === "submitted" || r.status === "reviewed" || r.status === "completed" || r.status === "cancelled") continue;
    if (!r.clientActionEnabled) continue;
    out.push({
      id: `request_${r.id}`, kind: "request", title: r.title, description: r.description,
      dueDate: r.dueDate, completed: false, targetSection: "requests",
      actionLabel: r.requestType === "approval" ? "Review & respond" : r.requestType === "upload" ? "Upload" : "Respond",
      completableHere: false,
    });
  }

  for (const d of input.documents) {
    if (d.docType !== "contract" || d.status !== "sent" || !d.signToken) continue;
    out.push({
      id: `contract_${d.id}`, kind: "contract", title: `Sign: ${d.name}`, description: "Your venue is waiting on your signature.",
      dueDate: null, completed: false, targetSection: "documents", actionLabel: "Review & sign",
      completableHere: false,
    });
  }

  for (const s of input.paymentSchedules) {
    for (const li of s.lineItems) {
      if (li.status === "paid" || li.status === "cancelled") continue;
      out.push({
        id: `payment_${li.id}`, kind: "payment", title: li.label, description: `${s.title} — payment due`,
        dueDate: li.dueDate, completed: false, targetSection: "payments", actionLabel: "Pay now",
        completableHere: false,
      });
    }
  }

  if (input.questionnaire && input.questionnaire.status === "sent") {
    out.push({
      id: "questionnaire", kind: "questionnaire", title: "Complete your final details form",
      description: "Guest count, songs, meal preferences, and day-of contacts.",
      dueDate: null, completed: false, targetSection: "questionnaire", actionLabel: "Complete form",
      completableHere: false,
    });
  }

  if (input.timelineHasUnpublishedChanges) {
    out.push({
      id: "timeline", kind: "timeline", title: "Submit your timeline updates",
      description: "You've made changes your venue hasn't seen yet.",
      dueDate: null, completed: false, targetSection: "timeline", actionLabel: "Review & submit",
      completableHere: false,
    });
  }

  // Chronological — dated items first (soonest due date first), undated
  // items (respond-when-you-can requests, the questionnaire, timeline)
  // trail at the end rather than sorting arbitrarily first.
  return out.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}
