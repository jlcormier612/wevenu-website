/**
 * Phase 1 paged Leads candidate — semantics for DB paging.
 *
 * Live list is on Wave 1 (`getLeadsListIndex`). Split hot-path RPCs remain
 * candidates: query correctness + query speed passed, but browser remasure
 * after wire did not beat Wave 1 Filter.
 */

import { normalizeEventType } from "@/lib/event-types/canonical";
import { ACTIVE_STATUSES } from "@/lib/leads/constants";
import {
  buildEventTypeCounts,
  buildStatusCounts,
  isActiveQueueLead,
  isLostLead,
  LEADS_PAGE_SIZE,
  nextProgressiveWindow,
  sliceLeadWindow,
  type LeadsListParams,
  type LeadsListSort,
} from "@/lib/leads/list-query";
import { isOpenLeadOpportunity } from "@/lib/leads/open-lifecycle";
import { migrateLegacyStatusToSalesStage } from "@/lib/leads/sales-stages";
import { isStaleWithoutContact } from "@/lib/leads/stale-contact";
import type { Lead } from "@/lib/leads/types";
import { isUnseenLeadAttention } from "@/lib/navigation/attention";

/** Legacy combined candidate. Not called by the live list page. */
export const LEADS_LIST_PAGE_RPC = "query_leads_list_page";
/** Hot-path page rows only. Not called by the live list page. */
export const LEADS_LIST_ROWS_RPC = "query_leads_list_rows";
/** Hot-path counts only. Not called by the live list page. */
export const LEADS_LIST_COUNTS_RPC = "query_leads_list_counts";

/**
 * Resolved stage used by the list index (`resolveSalesStage` with no tour).
 * Raw `sales_stage` wins when it is a real pipeline value. Cancelled stays
 * cancelled. Otherwise the legacy `status` column is migrated, and qualified
 * does not become tour_scheduled (the list index passes hasRealTour = false).
 */
export function resolvedListSalesStage(
  salesStage: string | null | undefined,
  status: string | null | undefined,
): string {
  if (salesStage === "cancelled") return "cancelled";
  if (
    salesStage === "new_inquiry" ||
    salesStage === "outreach_sent" ||
    salesStage === "enrolled_in_sequence" ||
    salesStage === "tour_scheduled" ||
    salesStage === "proposal_sent" ||
    salesStage === "booked" ||
    salesStage === "lost"
  ) {
    return salesStage;
  }
  if (status) return migrateLegacyStatusToSalesStage(status, false);
  return "new_inquiry";
}

export function leadMatchesListPage(
  lead: Lead,
  params: LeadsListParams,
  nowMs: number = Date.now(),
): boolean {
  const outcome = params.outcome ?? "active";
  const statusFilter = params.status ?? (outcome === "lost" ? "lost" : "all");
  const attention =
    params.attention && params.attention !== "all" ? params.attention : "all";
  const eventTypeFilter = params.eventType ?? "all";
  const q = (params.q ?? "").trim().toLowerCase();
  const unattended = new Set(params.unattendedInquiryLeadIds ?? []);
  const stage = lead.salesStage ?? lead.status;

  const inQueue = statusFilter === "lost" ? isLostLead(lead) : isActiveQueueLead(lead);
  if (!inQueue) return false;
  if (statusFilter !== "all" && statusFilter !== "lost" && stage !== statusFilter) return false;
  if (eventTypeFilter !== "all" && normalizeEventType(lead.eventType) !== eventTypeFilter) {
    return false;
  }
  if (attention === "stale_contact" && !isStaleWithoutContact(lead, nowMs)) return false;
  if (attention === "open" && !isOpenLeadOpportunity({ salesStage: stage })) return false;
  if (
    attention === "unseen" &&
    !isUnseenLeadAttention({ venueSeenAt: lead.venueSeenAt, salesStage: stage })
  ) {
    return false;
  }
  if (attention === "unattended_inquiry" && !unattended.has(lead.id)) return false;
  if (!q) return true;
  return [
    lead.firstName,
    lead.lastName,
    lead.partnerFirstName,
    lead.partnerLastName,
    lead.email,
    lead.phone,
    lead.eventType,
    lead.source,
  ].some((value) => value?.toLowerCase().includes(q));
}

function cmpText(a: string, b: string, direction: "asc" | "desc"): number {
  if (a === b) return 0;
  const asc = a < b ? -1 : 1;
  return direction === "asc" ? asc : -asc;
}

function tieBreak(a: Lead, b: Lead, includeInquiry: boolean): number {
  if (includeInquiry) {
    const byInquiry = cmpText(a.inquiryDate ?? "", b.inquiryDate ?? "", "desc");
    if (byInquiry !== 0) return byInquiry;
  }
  const byCreated = cmpText(a.createdAt, b.createdAt, "desc");
  if (byCreated !== 0) return byCreated;
  return cmpText(a.id, b.id, "desc");
}

/** Same primary keys as `sortLeadsForList`. Ties break like the index order. */
export function compareLeadsForListPage(
  a: Lead,
  b: Lead,
  sort: LeadsListSort = "newest",
): number {
  let primary = 0;
  switch (sort) {
    case "oldest":
      primary = cmpText(a.inquiryDate ?? "", b.inquiryDate ?? "", "asc");
      break;
    case "az":
      primary = (a.firstName ?? "").localeCompare(b.firstName ?? "");
      break;
    case "za":
      primary = (b.firstName ?? "").localeCompare(a.firstName ?? "");
      break;
    case "event_asc":
      primary = cmpText(a.eventDate ?? "9999", b.eventDate ?? "9999", "asc");
      break;
    case "event_desc":
      primary = cmpText(a.eventDate ?? "", b.eventDate ?? "", "desc");
      break;
    case "budget_high":
      primary = (b.estimatedBudget ?? 0) - (a.estimatedBudget ?? 0);
      break;
    case "budget_low":
      primary = (a.estimatedBudget ?? 0) - (b.estimatedBudget ?? 0);
      break;
    case "last_contacted":
      primary = cmpText(a.lastContactedAt ?? "", b.lastContactedAt ?? "", "desc");
      break;
    case "commitment_high":
      primary = (b.commitmentScore ?? 0) - (a.commitmentScore ?? 0);
      break;
    default:
      primary = cmpText(a.inquiryDate ?? "", b.inquiryDate ?? "", "desc");
  }
  if (primary !== 0) return primary;
  return tieBreak(a, b, sort !== "newest" && sort !== "oldest");
}

export type LeadsListPageSelection = {
  leads: Lead[];
  totalLeads: number;
  totalMatching: number;
  offset: number;
  pageSize: number;
  hasMore: boolean;
  statusCounts: Record<string, number>;
  eventTypeCounts: Array<[string, number]>;
};

export function selectLeadsListPage(
  leads: readonly Lead[],
  params: LeadsListParams = {},
  nowMs: number = Date.now(),
): LeadsListPageSelection {
  const pageSize = params.pageSize ?? LEADS_PAGE_SIZE;
  const sort = (params.sort ?? "newest") as LeadsListSort;
  const matched = leads.filter((lead) => leadMatchesListPage(lead, params, nowMs));
  const sorted = [...matched].sort((a, b) => compareLeadsForListPage(a, b, sort));
  const excludeIds = params.excludeIds ?? [];
  const statusCounts = Object.fromEntries(
    buildStatusCounts(leads, params.currentBookedCount ?? 0),
  );
  if (excludeIds.length > 0) {
    const progressive = nextProgressiveWindow(sorted, excludeIds, pageSize);
    return {
      leads: progressive.pageItems,
      totalLeads: leads.length,
      totalMatching: progressive.totalMatching,
      offset: 0,
      pageSize: progressive.pageSize,
      hasMore: progressive.hasMore,
      statusCounts,
      eventTypeCounts: buildEventTypeCounts(leads),
    };
  }
  const windowed = sliceLeadWindow(
    sorted,
    params.offset != null
      ? params.offset
      : params.page != null
        ? Math.max(0, (params.page - 1) * pageSize)
        : 0,
    pageSize,
  );
  return {
    leads: windowed.pageItems,
    totalLeads: leads.length,
    totalMatching: windowed.totalMatching,
    offset: windowed.offset,
    pageSize: windowed.pageSize,
    hasMore: windowed.hasMore,
    statusCounts,
    eventTypeCounts: buildEventTypeCounts(leads),
  };
}

/** Stages the SQL count object must always include, even at zero. */
export const LEADS_LIST_PAGE_COUNT_STAGES = [
  "all",
  ...ACTIVE_STATUSES,
  "lost",
] as const;
