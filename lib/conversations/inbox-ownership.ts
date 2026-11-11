/**
 * Inbox Leads vs Clients — conversation ownership, not pipeline stage.
 *
 * Dashboard Lead Flow (open = sales_stage ∉ terminal) is a separate metric.
 * Do not import open-lead / sales_stage into Inbox categorization.
 */

export type InboxOwnerKind = "lead" | "client";

export type InboxCategory = "leads" | "clients" | "vendors";

const VENDOR_KINDS = new Set([
  "venue_vendor",
  "couple_vendor",
  "couple_vendor_inquiry",
]);

/**
 * Classify an Inbox row from the conversation's stamped owner/source.
 * Never uses sales_stage or "open lead" heuristics.
 */
export function inboxCategoryFromOwnership(input: {
  conversationKind?: string | null;
  /** Stamped owner on the conversation row. */
  inboxOwnerKind?: InboxOwnerKind | string | null;
  /**
   * Fallback only when owner was never stamped (legacy rows).
   * Prefer lead when a lead record exists — stage is irrelevant.
   */
  hasLead?: boolean;
  hasClient?: boolean;
}): InboxCategory {
  const kind = input.conversationKind ?? "";
  if (VENDOR_KINDS.has(kind)) return "vendors";

  const owner = (input.inboxOwnerKind ?? "").toLowerCase();
  if (owner === "client") return "clients";
  if (owner === "lead") return "leads";

  // Legacy fallback: belonging to a lead/opportunity record → Leads
  // regardless of stage. Client-only relationships → Clients.
  if (input.hasLead) return "leads";
  if (input.hasClient) return "clients";
  return "leads";
}

/** @deprecated Use inboxCategoryFromOwnership — kept name for call-site clarity. */
export function inboxCategoryFromConversation(input: {
  conversationKind?: string | null;
  inboxOwnerKind?: InboxOwnerKind | string | null;
  leadId?: string | null;
  clientId?: string | null;
}): InboxCategory {
  return inboxCategoryFromOwnership({
    conversationKind: input.conversationKind,
    inboxOwnerKind: input.inboxOwnerKind,
    hasLead: Boolean(input.leadId),
    hasClient: Boolean(input.clientId),
  });
}
