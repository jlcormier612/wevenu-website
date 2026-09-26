/**
 * Couple Documents badges are type-specific.
 * Invoice status "sent" means issued. Contract status "sent" means
 * awaiting the couple's signature. Those must not share a label.
 */

import { invoiceStatusLabel } from "@/lib/invoices/constants";
import type { InvoiceStatus } from "@/lib/invoices/types";

export type CoupleDocumentStatusBadge = {
  label: string;
  color: string;
};

const CONTRACT_SENT: CoupleDocumentStatusBadge = {
  label: "Awaiting your signature",
  color: "bg-amber-50 text-amber-700 border-amber-200",
};

const COLORS: Record<string, string> = {
  signed: "bg-green-50 text-green-700 border-green-200",
  issued: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  draft: "bg-gray-50 text-gray-500 border-gray-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
  void: "bg-gray-50 text-gray-400 border-gray-200",
};

export function coupleContractStatusBadge(status: string | null | undefined): CoupleDocumentStatusBadge | null {
  if (!status) return null;
  if (status === "sent") return CONTRACT_SENT;
  if (status === "signed") return { label: "Signed", color: COLORS.signed };
  if (status === "draft") return { label: "Draft", color: COLORS.draft };
  return null;
}

export function coupleInvoiceStatusBadge(status: string | null | undefined): CoupleDocumentStatusBadge | null {
  if (!status) return null;
  if (status === "sent") {
    return { label: invoiceStatusLabel("sent"), color: COLORS.issued };
  }
  if (status === "paid" || status === "draft") {
    return { label: invoiceStatusLabel(status as InvoiceStatus), color: COLORS[status === "paid" ? "paid" : "draft"] };
  }
  if (status === "void" || status === "cancelled") {
    return { label: invoiceStatusLabel("void"), color: COLORS.void };
  }
  if (status === "overdue") return { label: "Overdue", color: COLORS.overdue };
  return null;
}

export function coupleDocumentStatusBadge(
  docType: string,
  status: string | null | undefined,
): CoupleDocumentStatusBadge | null {
  if (docType === "invoice") return coupleInvoiceStatusBadge(status);
  if (docType === "contract") return coupleContractStatusBadge(status);
  return null;
}
