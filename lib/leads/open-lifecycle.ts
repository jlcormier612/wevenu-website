/**
 * Canonical open-lead lifecycle — Dashboard Lead Flow and Leads open filter.
 *
 * OPEN = current pipeline reporting category is not terminal.
 * Terminal reporting categories: booked | lost | cancelled
 * (sales_stage keys booked | lost | won | cancelled when no pipeline stage)
 *
 * Does NOT use:
 * - client_id / whether a client row exists
 * - Inbox conversation ownership
 * - exclude_from_business_reporting (Reporting metrics only — not Lead Flow)
 *
 * Inbox Leads vs Clients does NOT use this module — see
 * lib/conversations/inbox-ownership.ts (conversation owner/source).
 */

import { transitionKindForCanonical } from "@/lib/leads/pipeline-stage-transition";
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

export const TERMINAL_LEAD_LIFECYCLE_STATES = new Set([
  "booked",
  "lost",
  "won",
  "cancelled",
]);

/** sales_stage / legacy status key — terminal when booked/lost/won/cancelled. */
export function isOpenLeadLifecycle(salesStage: string | null | undefined): boolean {
  const stage = (salesStage ?? "").toLowerCase();
  return !TERMINAL_LEAD_LIFECYCLE_STATES.has(stage);
}

/**
 * Pipeline reporting category (canonical_stage) — terminal when booked/lost/cancelled.
 * Custom venue stage *names* are never consulted; only the reporting category.
 * `unmapped` stays open (still in the sales process).
 */
export function isOpenReportingCategory(
  canonical: CanonicalStage | string | null | undefined,
): boolean {
  if (canonical == null || canonical === "") return true;
  return transitionKindForCanonical(canonical) === "normal";
}

/**
 * Active sales opportunity.
 * A terminal sales_stage (booked, lost, won, cancelled) has left the funnel
 * even if a leftover venue pipeline stage still looks open.
 * Otherwise prefer the pipeline reporting category when known.
 * Shared by Dashboard Lead Flow and Leads `attention=open`.
 */
export function isOpenLeadOpportunity(opts: {
  salesStage?: string | null;
  canonicalStage?: CanonicalStage | string | null;
}): boolean {
  if (!isOpenLeadLifecycle(opts.salesStage)) return false;
  if (opts.canonicalStage != null && opts.canonicalStage !== "") {
    return isOpenReportingCategory(opts.canonicalStage);
  }
  return true;
}

type LeadStageCarrier = {
  salesStage?: string | null;
  status?: string | null;
};

/**
 * Active Leads working bucket: sales_stage is still an open opportunity.
 * Booked, lost, won, and cancelled are the same relationship, not deleted —
 * they are no longer active sales work.
 *
 * Uses sales_stage, not the pipeline reporting category. A booked
 * relationship must leave this bucket even if a venue stage id is still set.
 */
export function isActiveSalesLead(lead: LeadStageCarrier): boolean {
  return isOpenLeadLifecycle(lead.salesStage ?? lead.status);
}

export function activeSalesLeads<T extends LeadStageCarrier>(leads: readonly T[]): T[] {
  return leads.filter(isActiveSalesLead);
}

export function closedRelationshipLeads<T extends LeadStageCarrier>(leads: readonly T[]): T[] {
  return leads.filter((lead) => !isActiveSalesLead(lead));
}
