/**
 * Navigation attention badges — "what needs my look?" not inventory counts.
 *
 * Pure helpers only. Fetching lives in attention-service.ts.
 */

import { TERMINAL_LEAD_LIFECYCLE_STATES } from "@/lib/dashboard/business-snapshot";
import { deriveScheduleStatus } from "@/lib/payments/constants";
import type { PaymentLineItem } from "@/lib/payments/types";

export type NavAttentionCounts = {
  leads: number;
  tours: number;
  inbox: number;
  tasks: number;
  payments: number;
};

export const NAV_ATTENTION_BADGE_IDS = [
  "leads",
  "tours",
  "inbox",
  "task-center",
  "payments",
] as const;

export type NavAttentionBadgeId = (typeof NAV_ATTENTION_BADGE_IDS)[number];

/** HTC pink attention treatment (maps to --destructive / dusty-rose). */
export const NAV_ATTENTION_BADGE_CLASS =
  "ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground";

export function emptyNavAttentionCounts(): NavAttentionCounts {
  return { leads: 0, tours: 0, inbox: 0, tasks: 0, payments: 0 };
}

export function badgeCountForNavItem(
  itemId: string,
  counts: NavAttentionCounts,
): number {
  switch (itemId) {
    case "leads":
      return counts.leads;
    case "tours":
      return counts.tours;
    case "inbox":
      return counts.inbox;
    case "task-center":
      return counts.tasks;
    case "payments":
      return counts.payments;
    default:
      return 0;
  }
}

/** Display value: hide when zero; cap visual at 99+. */
export function formatAttentionBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return String(count);
}

// ── Leads ────────────────────────────────────────────────────────────────────

export type LeadAttentionRow = {
  venueSeenAt: string | null;
  salesStage: string | null;
};

/**
 * Unseen lead attention: open lifecycle + never acknowledged by venue staff.
 * Does not count ordinary open leads that have already been viewed.
 */
export function isUnseenLeadAttention(row: LeadAttentionRow): boolean {
  if (row.venueSeenAt) return false;
  const stage = (row.salesStage ?? "").toLowerCase();
  if (TERMINAL_LEAD_LIFECYCLE_STATES.has(stage)) return false;
  return true;
}

export function countUnseenLeads(rows: readonly LeadAttentionRow[]): number {
  return rows.filter(isUnseenLeadAttention).length;
}

// ── Tours ────────────────────────────────────────────────────────────────────

export type TourAttentionRow = {
  venueSeenAt: string | null;
  status: string;
};

const TOUR_INACTIVE = new Set(["cancelled", "completed", "no_show"]);

/** Unseen scheduled/confirmed tour activity (not every upcoming tour). */
export function isUnseenTourAttention(row: TourAttentionRow): boolean {
  if (row.venueSeenAt) return false;
  if (TOUR_INACTIVE.has(row.status)) return false;
  return true;
}

export function countUnseenTours(
  appointments: readonly TourAttentionRow[],
  unresolvedProtectionCount = 0,
): number {
  return appointments.filter(isUnseenTourAttention).length + Math.max(0, unresolvedProtectionCount);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export type TaskAttentionRow = {
  status: string;
  dueDate: string | null | undefined;
  assignedToStaffId: string | null | undefined;
  completed?: boolean;
};

/**
 * Past-due incomplete tasks for the logged-in staff member only.
 * Undated and future incomplete tasks never inflate the badge.
 */
export function isPastDueStaffTask(
  row: TaskAttentionRow,
  staffId: string | null,
  today: string,
): boolean {
  if (!staffId) return false;
  if (row.assignedToStaffId !== staffId) return false;
  if (row.completed === true) return false;
  if (row.status === "complete" || row.status === "waived") return false;
  const due = (row.dueDate ?? "").slice(0, 10);
  if (!due) return false;
  return due < today || row.status === "overdue";
}

export function countPastDueStaffTasks(
  rows: readonly TaskAttentionRow[],
  staffId: string | null,
  today: string,
): number {
  return rows.filter((r) => isPastDueStaffTask(r, staffId, today)).length;
}

// ── Payments ─────────────────────────────────────────────────────────────────

export type PaymentAttentionSchedule = {
  excludeFromBusinessReporting?: boolean | null;
  lineItems: PaymentLineItem[];
};

/** Same attention population as /payments?filter=attention. */
export function isPaymentAttentionSchedule(schedule: PaymentAttentionSchedule): boolean {
  if (schedule.excludeFromBusinessReporting) return false;
  return deriveScheduleStatus(schedule.lineItems) === "attention";
}

export function countPaymentAttention(
  schedules: readonly PaymentAttentionSchedule[],
): number {
  return schedules.filter(isPaymentAttentionSchedule).length;
}

// ── Inbox category ───────────────────────────────────────────────────────────

export type InboxCategory = "leads" | "clients" | "vendors";

export const INBOX_CATEGORY_OPTIONS: { value: InboxCategory; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "clients", label: "Clients" },
  { value: "vendors", label: "Vendors" },
];

export function inboxCategoryFromConversation(input: {
  conversationKind?: string | null;
  clientId?: string | null;
  leadId?: string | null;
}): InboxCategory {
  const kind = input.conversationKind ?? "";
  if (
    kind === "venue_vendor"
    || kind === "couple_vendor"
    || kind === "couple_vendor_inquiry"
  ) {
    return "vendors";
  }
  if (input.clientId) return "clients";
  return "leads";
}

/** Map UI category → inbox RPC relationship param (clients → bookings). */
export function inboxRelationshipParam(category: InboxCategory): "leads" | "bookings" | "vendors" {
  if (category === "clients") return "bookings";
  return category;
}
