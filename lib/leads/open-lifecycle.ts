/**
 * Canonical open-lead lifecycle — Dashboard Lead Flow and Leads attention.
 *
 * OPEN = sales_stage NOT IN booked | lost | won | cancelled
 *
 * A client row from commercial-only conversion does NOT close a lead.
 *
 * Inbox Leads vs Clients does NOT use this module — see
 * lib/conversations/inbox-ownership.ts (conversation owner/source).
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
