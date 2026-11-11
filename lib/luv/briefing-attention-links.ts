/**
 * Daily Briefing attention links — route to the owning action surface for the
 * specific readiness issue, not a generic client workspace root.
 */
import type { Contract } from "@/lib/contracts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Request as PortalRequest } from "@/lib/requests/types";

export function contractAttentionHref(
  contracts: Contract[],
  clientId: string,
): string {
  const actionable = contracts.find((c) => c.status === "draft")
    ?? contracts.find((c) => c.status !== "signed" && c.status !== "cancelled");
  if (actionable) return `/contracts/${actionable.id}`;
  return `/clients/${clientId}#documents`;
}

export function paymentsAttentionHref(
  invoices: Invoice[],
  clientId: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = invoices.find(
    (inv) => inv.balanceDue > 0 && inv.dueDate != null && inv.dueDate < today,
  );
  if (overdue) return `/invoices/${overdue.id}`;
  const open = invoices.find((inv) => inv.balanceDue > 0);
  if (open) return `/invoices/${open.id}`;
  if (invoices[0]) return `/invoices/${invoices[0].id}`;
  return `/clients/${clientId}#invoice`;
}

export function requestsAttentionHref(
  requests: PortalRequest[],
  clientId: string,
): string {
  const outstanding = requests.find(
    (r) => r.status !== "draft" && r.status !== "completed" && r.status !== "cancelled",
  );
  if (outstanding) return `/requests/${outstanding.id}`;
  if (requests[0]) return `/requests/${requests[0].id}`;
  return `/clients/${clientId}#requests-summary-card`;
}
