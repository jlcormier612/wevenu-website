/**
 * Event Readiness — Phase 1: Platform Integration.
 *
 * Pure functions only — every input here is data a completed feature
 * already computed (or, for Guests/Seating, a small aggregate query added
 * alongside this task; see lib/guests/service.ts and lib/seating/
 * service.ts for why those two needed a new call site). Nothing in this
 * file queries anything itself, invents a metric, or duplicates a
 * capability's own logic — it only reads already-computed fields and
 * decides which of four operational statuses that adds up to.
 */
import type { GuestReadinessSummary } from "@/lib/guests/service";
import type { SeatingReadinessSummary } from "@/lib/seating/service";
import type { EventReadiness } from "@/lib/playbooks/types";
import type { TimelineEntry } from "@/lib/timeline/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { InventoryUsage } from "@/lib/inventory/types";
import type { Request } from "@/lib/requests/types";
import type { Contract } from "@/lib/contracts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Document } from "@/lib/documents/types";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadWithMessages } from "@/lib/messaging/types";
import type { EventReadinessSummary, ReadinessSection, ReadinessStatus } from "@/lib/readiness/types";

const STATUS_PRIORITY: Record<ReadinessStatus, number> = {
  needs_attention: 0, waiting: 1, not_started: 2, complete: 3,
};

export function computePlanningReadiness(readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null }): ReadinessSection {
  const client = readinessByKind.client;
  const venue = readinessByKind.venue;
  const totalRequired = (client?.totalRequired ?? 0) + (venue?.totalRequired ?? 0);
  const completedRequired = (client?.completedRequired ?? 0) + (venue?.completedRequired ?? 0);
  const blockedCount = (client?.blockedCount ?? 0) + (venue?.blockedCount ?? 0);
  const overdueCount = (client?.overdueCount ?? 0) + (venue?.overdueCount ?? 0);

  let status: ReadinessStatus;
  if (totalRequired === 0) status = "not_started";
  else if (overdueCount > 0 || blockedCount > 0) status = "needs_attention";
  else if (completedRequired >= totalRequired) status = "complete";
  else status = "waiting";

  const flags = [overdueCount > 0 ? `${overdueCount} overdue` : null, blockedCount > 0 ? `${blockedCount} blocked` : null].filter(Boolean);
  const detail = totalRequired === 0
    ? "No required tasks yet."
    : `${completedRequired} of ${totalRequired} required tasks done${flags.length ? ` · ${flags.join(", ")}` : ""}`;

  return {
    key: "planning", label: "Planning", status, detail,
    metric: totalRequired > 0 ? `${completedRequired}/${totalRequired}` : undefined,
    nav: { kind: "tab", tab: "playbook" },
  };
}

export function computeTimelineReadiness(entries: TimelineEntry[]): ReadinessSection {
  const total = entries.length;
  const complete = entries.filter((e) => e.status === "complete").length;
  const outstanding = total - complete;

  let status: ReadinessStatus;
  if (total === 0) status = "not_started";
  else if (complete === total) status = "complete";
  else status = "waiting";

  const detail = total === 0 ? "No timeline items yet." : `${complete} of ${total} items complete${outstanding > 0 ? ` · ${outstanding} outstanding` : ""}`;

  return {
    key: "timeline", label: "Timeline", status, detail,
    metric: total > 0 ? `${complete}/${total}` : undefined,
    nav: { kind: "tab", tab: "timeline" },
  };
}

export function computeGuestsReadiness(summary: GuestReadinessSummary): ReadinessSection {
  let status: ReadinessStatus;
  if (summary.total === 0 || summary.invitationsSent === 0) status = "not_started";
  else if (summary.invitationsOutstanding > 0) status = "waiting";
  else status = "complete";

  const detail = summary.total === 0
    ? "No guests added yet."
    : summary.invitationsSent === 0
      ? `${summary.total} guests added, invitations not sent yet.`
      : `${summary.attending} attending · ${summary.invitationsOutstanding} awaiting response`;

  return {
    key: "guests", label: "Guests", status, detail,
    metric: summary.invitationsSent > 0 ? `${summary.invitationsResponded}/${summary.invitationsSent}` : undefined,
    nav: { kind: "portal", section: "guests" },
  };
}

export function computeSeatingReadiness(summary: SeatingReadinessSummary | null): ReadinessSection {
  let status: ReadinessStatus;
  let detail: string;

  if (!summary || !summary.floorPlanShared) {
    status = "not_started";
    detail = "No floor plan shared with the couple for seating yet.";
  } else if (summary.totalAttending === 0) {
    status = "not_started";
    detail = "Floor plan shared — no attending guests to seat yet.";
  } else if (summary.needsReassignmentCount > 0) {
    status = "needs_attention";
    detail = `${summary.needsReassignmentCount} guest${summary.needsReassignmentCount === 1 ? "" : "s"} need a new table.`;
  } else if (summary.totalAssigned >= summary.totalAttending) {
    status = "complete";
    detail = "Everyone is seated.";
  } else {
    status = "waiting";
    detail = `${summary.totalAssigned} of ${summary.totalAttending} guests seated.`;
  }

  return {
    key: "seating", label: "Seating", status, detail,
    metric: summary && summary.totalAttending > 0 ? `${summary.totalAssigned}/${summary.totalAttending}` : undefined,
    nav: { kind: "portal", section: "seating" },
  };
}

export function computeFloorPlansReadiness(floorPlans: FloorPlan[], inventoryUsage: InventoryUsage[]): ReadinessSection {
  const sharedCount = floorPlans.filter((p) => p.clientAccess !== "hidden").length;
  const overAllocated = inventoryUsage.filter((u) => u.quantityAvailable - u.quantityUsed < 0).length;

  let status: ReadinessStatus;
  if (floorPlans.length === 0) status = "not_started";
  else if (overAllocated > 0) status = "needs_attention";
  else if (sharedCount === 0) status = "waiting";
  else status = "complete";

  const detail = floorPlans.length === 0
    ? "No floor plan created yet."
    : overAllocated > 0
      ? `${overAllocated} inventory item${overAllocated === 1 ? "" : "s"} over-allocated.`
      : sharedCount === 0
        ? `${floorPlans.length} floor plan${floorPlans.length === 1 ? "" : "s"}, none shared with the couple yet.`
        : `${sharedCount} of ${floorPlans.length} floor plans shared with the couple.`;

  return { key: "floorplans", label: "Floor Plans", status, detail, nav: { kind: "tab", tab: "floorplan" } };
}

export function computeRequestsReadiness(requests: Request[]): ReadinessSection {
  const today = new Date().toISOString().slice(0, 10);
  const waitingOnClient = requests.filter((r) => ["sent", "viewed", "in_progress"].includes(r.status)).length;
  const waitingOnVenue = requests.filter((r) => ["submitted", "reviewed"].includes(r.status)).length;
  const overdue = requests.filter((r) => r.dueDate != null && r.dueDate < today && !["completed", "cancelled"].includes(r.status)).length;

  let status: ReadinessStatus;
  if (requests.length === 0) status = "not_started";
  else if (overdue > 0 || waitingOnVenue > 0) status = "needs_attention";
  else if (waitingOnClient > 0) status = "waiting";
  else status = "complete";

  const parts = [
    waitingOnVenue > 0 ? `${waitingOnVenue} waiting on you` : null,
    overdue > 0 ? `${overdue} overdue` : null,
    waitingOnClient > 0 ? `${waitingOnClient} waiting on client` : null,
  ].filter(Boolean);
  const detail = requests.length === 0 ? "No requests yet." : parts.length ? parts.join(", ") : "All requests resolved.";

  return { key: "requests", label: "Requests", status, detail, nav: { kind: "scroll", elementId: "requests-summary-card" } };
}

export function computeContractsReadiness(contracts: Contract[]): ReadinessSection {
  const signed = contracts.filter((c) => c.status === "signed").length;
  const sent = contracts.filter((c) => c.status === "sent").length;

  let status: ReadinessStatus;
  if (contracts.length === 0) status = "not_started";
  else if (signed === contracts.length) status = "complete";
  else if (sent > 0) status = "waiting";
  else status = "needs_attention";

  const detail = contracts.length === 0
    ? "No contract yet."
    : signed === contracts.length
      ? "Contract signed."
      : sent > 0
        ? "Sent — awaiting signature."
        : "Drafted — not yet sent.";

  return { key: "contracts", label: "Contract", status, detail, nav: { kind: "tab", tab: "documents" } };
}

export function computePaymentsReadiness(invoices: Invoice[]): ReadinessSection {
  const today = new Date().toISOString().slice(0, 10);
  const totalBalanceDue = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0);
  const overdue = invoices.filter((inv) => inv.balanceDue > 0 && inv.dueDate != null && inv.dueDate < today).length;

  let status: ReadinessStatus;
  if (invoices.length === 0) status = "not_started";
  else if (overdue > 0) status = "needs_attention";
  else if (totalBalanceDue === 0) status = "complete";
  else status = "waiting";

  const detail = invoices.length === 0
    ? "No invoice yet."
    : overdue > 0
      ? `${overdue} invoice${overdue === 1 ? "" : "s"} overdue.`
      : totalBalanceDue === 0
        ? "Paid in full."
        : `${formatCents(totalBalanceDue)} balance due.`;

  return { key: "payments", label: "Payments", status, detail, nav: { kind: "tab", tab: "invoice" } };
}

function formatCents(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function computeDocumentsReadiness(documents: Document[]): ReadinessSection {
  const today = Date.now();
  const expired = documents.filter((d) => d.expiresAt && new Date(d.expiresAt).getTime() < today).length;
  const expiringSoon = documents.filter((d) => {
    if (!d.expiresAt) return false;
    const days = (new Date(d.expiresAt).getTime() - today) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;

  let status: ReadinessStatus;
  if (documents.length === 0) status = "not_started";
  else if (expired > 0) status = "needs_attention";
  else if (expiringSoon > 0) status = "waiting";
  else status = "complete";

  const detail = documents.length === 0
    ? "No documents yet."
    : expired > 0
      ? `${expired} document${expired === 1 ? "" : "s"} expired.`
      : expiringSoon > 0
        ? `${expiringSoon} document${expiringSoon === 1 ? "" : "s"} expiring within 30 days.`
        : `${documents.length} document${documents.length === 1 ? "" : "s"} on file.`;

  return { key: "documents", label: "Documents", status, detail, nav: { kind: "tab", tab: "documents" } };
}

export function computeCommunicationReadiness(params: {
  conversationExperienceEnabled: boolean;
  conversationMessages: ConversationMessage[];
  threads: ThreadWithMessages[];
}): ReadinessSection {
  const { conversationExperienceEnabled, conversationMessages, threads } = params;

  if (conversationExperienceEnabled) {
    const unread = conversationMessages.filter((m) => m.senderType === "lead_or_client" && !m.venueReadAt).length;
    const status: ReadinessStatus = conversationMessages.length === 0 ? "not_started" : unread > 0 ? "needs_attention" : "complete";
    const detail = conversationMessages.length === 0 ? "No messages yet." : unread > 0 ? `${unread} unread from the client.` : "All caught up.";
    return { key: "communication", label: "Communication", status, detail, nav: { kind: "tab", tab: "messages" } };
  }

  // Legacy threads carry no read-state (booking-overview-summary.tsx makes the
  // same choice) — don't invent one here either.
  const messageCount = threads.reduce((sum, t) => sum + t.messageCount, 0);
  const status: ReadinessStatus = messageCount === 0 ? "not_started" : "complete";
  const detail = messageCount === 0 ? "No messages yet." : `${messageCount} message${messageCount === 1 ? "" : "s"} logged.`;
  return { key: "communication", label: "Communication", status, detail, nav: { kind: "tab", tab: "messages" } };
}

function headlineFor(sections: ReadinessSection[], overallStatus: ReadinessStatus): string {
  const needsAttention = sections.filter((s) => s.status === "needs_attention");
  if (needsAttention.length > 0) {
    return needsAttention.length <= 2
      ? `${needsAttention.map((s) => s.label).join(" and ")} need${needsAttention.length === 1 ? "s" : ""} attention`
      : `${needsAttention.length} areas need attention`;
  }
  if (overallStatus === "waiting") return "On track — nothing urgent right now";
  if (overallStatus === "not_started") return "Just getting started";
  return "This event is fully ready";
}

export function buildEventReadiness(input: {
  readinessByKind: { client: EventReadiness | null; venue: EventReadiness | null };
  timelineEntries: TimelineEntry[];
  guestSummary: GuestReadinessSummary;
  seatingSummary: SeatingReadinessSummary | null;
  floorPlans: FloorPlan[];
  inventoryUsage: InventoryUsage[];
  requests: Request[];
  contracts: Contract[];
  invoices: Invoice[];
  documents: Document[];
  conversationExperienceEnabled: boolean;
  conversationMessages: ConversationMessage[];
  threads: ThreadWithMessages[];
}): EventReadinessSummary {
  const sections = [
    computePlanningReadiness(input.readinessByKind),
    computeTimelineReadiness(input.timelineEntries),
    computeGuestsReadiness(input.guestSummary),
    computeSeatingReadiness(input.seatingSummary),
    computeFloorPlansReadiness(input.floorPlans, input.inventoryUsage),
    computeRequestsReadiness(input.requests),
    computeContractsReadiness(input.contracts),
    computePaymentsReadiness(input.invoices),
    computeDocumentsReadiness(input.documents),
    computeCommunicationReadiness({
      conversationExperienceEnabled: input.conversationExperienceEnabled,
      conversationMessages: input.conversationMessages,
      threads: input.threads,
    }),
  ].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  const overallStatus = sections.reduce<ReadinessStatus>(
    (worst, s) => (STATUS_PRIORITY[s.status] < STATUS_PRIORITY[worst] ? s.status : worst),
    "complete",
  );

  return { overallStatus, headline: headlineFor(sections, overallStatus), sections };
}
