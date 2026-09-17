/**
 * Canonical open-lead lifecycle — one rule, many consumers.
 *
 * OPEN = sales_stage NOT IN booked | lost | won | cancelled
 *
 * A client row from commercial-only conversion does NOT close a lead.
 * Dashboard Lead Flow, Leads attention=open, Inbox Leads, and nav
 * unseen-lead attention all share this definition.
 */

export const TERMINAL_LEAD_LIFECYCLE_STATES = new Set([
  "booked",
  "lost",
  "won",
  "cancelled",
]);

export function isOpenLeadLifecycle(salesStage: string | null | undefined): boolean {
  const stage = (salesStage ?? "").toLowerCase();
  return !TERMINAL_LEAD_LIFECYCLE_STATES.has(stage);
}

/**
 * Inbox Leads vs Clients follows commercial lifecycle, not client_id presence.
 *
 * - Open lead (with or without client row) → leads
 * - Client without an open lead (booked / client-only / terminal) → clients
 * - Vendor kinds → vendors
 */
export function inboxCategoryFromLifecycle(input: {
  conversationKind?: string | null;
  /** True when a lead row exists on the relationship. */
  hasLead?: boolean;
  /** Lead sales_stage when hasLead. */
  leadSalesStage?: string | null;
  /** True when a client row exists on the relationship. */
  hasClient?: boolean;
}): "leads" | "clients" | "vendors" {
  const kind = input.conversationKind ?? "";
  if (
    kind === "venue_vendor"
    || kind === "couple_vendor"
    || kind === "couple_vendor_inquiry"
  ) {
    return "vendors";
  }
  const hasLead = input.hasLead ?? input.leadSalesStage != null;
  if (hasLead && isOpenLeadLifecycle(input.leadSalesStage)) {
    // Open opportunity stays Lead even when commercial-only created a client.
    return "leads";
  }
  if (input.hasClient) return "clients";
  // No client and no open lead (lost-only / orphan) — default Leads tab.
  return "leads";
}
