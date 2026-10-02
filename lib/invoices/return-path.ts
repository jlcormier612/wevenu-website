/**
 * Originating-workflow return for Invoice Detail.
 * Reuses the contract return-path allowlist (leads/clients/documents)
 * plus the global invoices list. Payment-schedule handoff stays on
 * `safePaymentScheduleReturnPath` and is not the back arrow.
 *
 * Fully Executed / paid ≠ Booked. An invoice opened from an unbooked
 * Lead returns to that Lead, not /invoices or /clients/.
 */
import {
  BOOKING_JOURNEY_PAYMENTS_HASH,
  safeContractReturnPath,
} from "@/lib/contracts/return-path";

export function safeInvoiceReturnPath(raw: string | null | undefined): string | null {
  const shared = safeContractReturnPath(raw);
  if (shared) return shared;
  if (!raw?.trim()) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("://")) {
    return null;
  }
  const pathOnly = decoded.split("#")[0] ?? decoded;
  const pathNoQuery = pathOnly.split("?")[0] ?? pathOnly;
  if (pathOnly.includes("..")) return null;
  if (pathNoQuery === "/invoices") return decoded;
  return null;
}

export function appendInvoiceReturnTo(
  href: string | null | undefined,
  returnTo: string | null | undefined,
): string | null {
  if (!href) return null;
  const safe = safeInvoiceReturnPath(returnTo);
  if (!safe) return href;
  if (!href.startsWith("/invoices/")) return href;
  if (href.includes("returnTo=")) return href;
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}returnTo=${encodeURIComponent(safe)}`;
}

/**
 * Canonical workspace for an invoice when returnTo is missing.
 * Unbooked → Lead payment section. Booked → Client workspace.
 */
export function invoiceRelationshipReturnPath(input: {
  leadId?: string | null;
  clientId?: string | null;
  relationshipBooked?: boolean;
}): string | null {
  if (input.relationshipBooked !== true && input.leadId?.trim()) {
    return `/leads/${input.leadId.trim()}#${BOOKING_JOURNEY_PAYMENTS_HASH}`;
  }
  if (input.clientId?.trim()) {
    return `/clients/${input.clientId.trim()}`;
  }
  return null;
}

export function resolveInvoiceBackNavigation(input: {
  returnTo?: string | null;
  clientName?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  relationshipBooked?: boolean;
}): { href: string; label: string } {
  const safe = safeInvoiceReturnPath(input.returnTo);
  const coupleLabel = input.clientName?.trim() || null;

  if (safe) {
    const pathOnly = (safe.split("#")[0] ?? safe).split("?")[0] ?? safe;
    if (pathOnly.startsWith("/leads/")) {
      return { href: safe, label: coupleLabel ?? "Lead" };
    }
    if (pathOnly.startsWith("/clients/")) {
      return { href: safe, label: coupleLabel ?? "Client" };
    }
    if (pathOnly === "/invoices" || pathOnly.startsWith("/invoices")) {
      return { href: safe, label: "Invoices" };
    }
    if (pathOnly === "/documents" || pathOnly.startsWith("/documents")) {
      return { href: safe, label: "Documents" };
    }
    return { href: safe, label: coupleLabel ?? "Back" };
  }

  const inferred = invoiceRelationshipReturnPath({
    leadId: input.leadId,
    clientId: input.clientId,
    relationshipBooked: input.relationshipBooked,
  });
  if (inferred) {
    if (inferred.startsWith("/leads/")) {
      return { href: inferred, label: coupleLabel ?? "Lead" };
    }
    return { href: inferred, label: coupleLabel ?? "Client" };
  }

  return { href: "/invoices", label: "Invoices" };
}
