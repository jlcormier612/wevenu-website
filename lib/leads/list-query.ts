/**
 * Server-backed Leads list filter / sort / paginate.
 * Shared by the list page assembler and unit tests — keeps counts and
 * search semantics identical to the prior client-only LeadList logic.
 */

import { ACTIVE_STATUSES } from "@/lib/leads/constants";
import { normalizeEventType } from "@/lib/event-types/canonical";
import { isOpenLeadLifecycle, isOpenLeadOpportunity } from "@/lib/leads/open-lifecycle";
import { isStaleWithoutContact } from "@/lib/leads/stale-contact";
import { isUnseenLeadAttention } from "@/lib/navigation/attention";
import type { Lead } from "@/lib/leads/types";

/** Initial / progressive chunk size for the Leads table. */
export const LEADS_PAGE_SIZE = 20;

export type LeadsListAttention =
  | "stale_contact"
  | "open"
  | "unseen"
  | "unattended_inquiry"
  | "all";

export type LeadsListSort =
  | "newest"
  | "oldest"
  | "az"
  | "za"
  | "event_asc"
  | "event_desc"
  | "budget_high"
  | "budget_low"
  | "last_contacted"
  | "commitment_high";

export type LeadsListParams = {
  q?: string;
  status?: string;
  eventType?: string;
  sort?: LeadsListSort;
  attention?: LeadsListAttention;
  /** 0-based offset into the filtered matching set (progressive load). */
  offset?: number;
  /** @deprecated Prefer offset; kept for transitional callers. */
  page?: number;
  /** Lost outcome list (view=lost). */
  outcome?: "active" | "lost";
  unattendedInquiryLeadIds?: readonly string[];
  currentBookedCount?: number;
  pageSize?: number;
};

export function isLostLead(lead: Lead): boolean {
  const stage = lead.salesStage ?? lead.status;
  return stage === "lost";
}

export function isActiveQueueLead(lead: Lead): boolean {
  return isOpenLeadLifecycle(lead.salesStage ?? lead.status);
}

export function sortLeadsForList(leads: Lead[], sort: LeadsListSort): Lead[] {
  return [...leads].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return (a.inquiryDate ?? "") < (b.inquiryDate ?? "") ? -1 : 1;
      case "az":
        return (a.firstName ?? "").localeCompare(b.firstName ?? "");
      case "za":
        return (b.firstName ?? "").localeCompare(a.firstName ?? "");
      case "event_asc":
        return (a.eventDate ?? "9999") < (b.eventDate ?? "9999") ? -1 : 1;
      case "event_desc":
        return (b.eventDate ?? "") < (a.eventDate ?? "") ? -1 : 1;
      case "budget_high":
        return (b.estimatedBudget ?? 0) - (a.estimatedBudget ?? 0);
      case "budget_low":
        return (a.estimatedBudget ?? 0) - (b.estimatedBudget ?? 0);
      case "last_contacted":
        return (b.lastContactedAt ?? "") < (a.lastContactedAt ?? "") ? -1 : 1;
      case "commitment_high":
        return (b.commitmentScore ?? 0) - (a.commitmentScore ?? 0);
      default:
        return (b.inquiryDate ?? "") < (a.inquiryDate ?? "") ? -1 : 1;
    }
  });
}

export function buildStatusCounts(
  allLeads: readonly Lead[],
  currentBookedCount: number,
): Map<string, number> {
  const queue = allLeads.filter(isActiveQueueLead);
  const map = new Map<string, number>([["all", queue.length]]);
  ACTIVE_STATUSES.forEach((s) => map.set(s, 0));
  queue.forEach((l) => {
    const stage = l.salesStage ?? l.status;
    map.set(stage, (map.get(stage) ?? 0) + 1);
  });
  map.set("booked", currentBookedCount);
  map.set("lost", allLeads.filter(isLostLead).length);
  return map;
}

export function buildEventTypeCounts(allLeads: readonly Lead[]): Array<[string, number]> {
  const queue = allLeads.filter(isActiveQueueLead);
  const seen = new Map<string, number>();
  queue.forEach((l) => {
    const key = normalizeEventType(l.eventType);
    if (!key) return;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  return [...seen.entries()].sort((a, b) => b[1] - a[1]);
}

export function filterLeadsForList(
  allLeads: readonly Lead[],
  params: LeadsListParams,
): Lead[] {
  const outcome = params.outcome ?? "active";
  const statusFilter = params.status ?? (outcome === "lost" ? "lost" : "all");
  const attention: LeadsListAttention =
    params.attention && params.attention !== "all"
      ? params.attention
      : "all";
  const eventTypeFilter = params.eventType ?? "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const unattendedIdSet = new Set(params.unattendedInquiryLeadIds ?? []);

  const queue =
    statusFilter === "lost"
      ? allLeads.filter(isLostLead)
      : allLeads.filter(isActiveQueueLead);

  const base = queue.filter((l) => {
    if (statusFilter !== "all" && statusFilter !== "lost") {
      if ((l.salesStage ?? l.status) !== statusFilter) return false;
    }
    if (eventTypeFilter !== "all") {
      if (normalizeEventType(l.eventType) !== eventTypeFilter) return false;
    }
    if (attention === "stale_contact") {
      if (!isStaleWithoutContact(l)) return false;
    }
    if (attention === "open") {
      if (
        !isOpenLeadOpportunity({
          salesStage: l.salesStage ?? l.status,
        })
      ) {
        return false;
      }
    }
    if (attention === "unseen") {
      if (
        !isUnseenLeadAttention({
          venueSeenAt: l.venueSeenAt,
          salesStage: l.salesStage ?? l.status,
        })
      ) {
        return false;
      }
    }
    if (attention === "unattended_inquiry") {
      if (!unattendedIdSet.has(l.id)) return false;
    }
    if (!q) return true;
    return [
      l.firstName,
      l.lastName,
      l.partnerFirstName,
      l.partnerLastName,
      l.email,
      l.phone,
      l.eventType,
      l.source,
    ].some((v) => v?.toLowerCase().includes(q));
  });

  return sortLeadsForList(base, params.sort ?? "newest");
}

export function paginateLeads<T>(
  items: readonly T[],
  page: number,
  pageSize: number = LEADS_PAGE_SIZE,
): { pageItems: T[]; page: number; pageSize: number; totalMatching: number; totalPages: number } {
  const totalMatching = items.length;
  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize) as T[],
    page: safePage,
    pageSize,
    totalMatching,
    totalPages,
  };
}

/** Slice a progressive window from a filtered matching set. */
export function sliceLeadWindow<T>(
  items: readonly T[],
  offset: number,
  limit: number = LEADS_PAGE_SIZE,
): {
  pageItems: T[];
  offset: number;
  pageSize: number;
  totalMatching: number;
  hasMore: boolean;
} {
  const totalMatching = items.length;
  const safeOffset = Math.max(0, Math.min(offset, totalMatching));
  const pageItems = items.slice(safeOffset, safeOffset + limit) as T[];
  return {
    pageItems,
    offset: safeOffset,
    pageSize: limit,
    totalMatching,
    hasMore: safeOffset + pageItems.length < totalMatching,
  };
}

export type LeadsListPageResult = {
  /** Current window rows only — never the full venue collection. */
  leads: Lead[];
  /** All non-archived venue leads (for discoverability / empty-state). */
  totalLeads: number;
  totalMatching: number;
  offset: number;
  pageSize: number;
  hasMore: boolean;
  /** @deprecated Prefer offset/hasMore. */
  page: number;
  /** @deprecated Prefer hasMore. */
  totalPages: number;
  statusCounts: Record<string, number>;
  eventTypeCounts: Array<[string, number]>;
  indexTruncated: boolean;
  params: Required<
    Pick<LeadsListParams, "q" | "status" | "eventType" | "sort" | "attention" | "outcome">
  > & { offset: number };
};
