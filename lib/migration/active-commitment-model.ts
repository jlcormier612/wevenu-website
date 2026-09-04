/**
 * Client-safe Active Commitment types and pure review helpers.
 *
 * Kept separate from `active-commitment.ts` (server commit path) so Client
 * Components can summarize/validate proposals without pulling
 * integrations/supabase/server into the browser bundle.
 */

import type { DocumentCategory } from "@/lib/documents/types";
import type { PaymentObligationKind } from "@/lib/payments/types";

export const HISTORICAL_PAYMENT_PROVENANCE =
  "Migrated payment — collected outside Hello to Cheers; not processed by HTC.";

export type ActiveCommitmentLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  packageId?: string | null;
};

export type ActiveCommitmentScheduleLine = {
  label: string;
  amount: string;
  dueDate?: string | null;
  obligationKind?: PaymentObligationKind | null;
  alreadyPaid?: boolean;
  paidDate?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
};

export type ActiveCommitmentDocument = {
  name: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  category?: DocumentCategory;
  notes?: string | null;
  entityType?: "event" | "client";
};

export type NormalizedActiveCommitment = {
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  contractedTotal: string;
  packageName?: string | null;
  lines?: ActiveCommitmentLine[];
  scheduleLines: ActiveCommitmentScheduleLine[];
  invoiceNotes?: string | null;
  scheduleTitle?: string | null;
  contractTitle?: string | null;
  contractContent?: string | null;
  contractSignedAt?: string | null;
  contractSignerName?: string | null;
  /**
   * Explicit historical booking commitment date from the prior system.
   * Distinct from contractSignedAt — never derive booked_at from the signed date.
   * Used for payment-timing events.booked_at only — not lifecycle Booking.
   */
  bookedAt?: string | null;
  /**
   * Explicit Migration Center decision: record a lifecycle Booking
   * (origin=import). Never inferred from contract/payment/event data.
   */
  markAsAlreadyBooked?: boolean;
  /**
   * Optional historical lifecycle booking date when markAsAlreadyBooked.
   * If omitted while marked, occurred_at is the commit time. Never invented
   * from signed_at / paid_at / events.booked_at.
   */
  lifecycleBookedAt?: string | null;
  documents?: ActiveCommitmentDocument[];
  /**
   * Explicit venue decision: make the externally executed agreement (and
   * attached signed file + invoice) visible in the couple portal via the
   * same is_couple_visible flags native HTC already uses.
   */
  shareSignedAgreementWithCouple?: boolean;
  sourceId?: string | null;
};

export type ActiveCommitmentCommitResult =
  | {
      ok: true;
      eventId: string;
      eventOrderId: string;
      invoiceId: string;
      scheduleId: string;
      contractId: string | null;
      documentIds: string[];
      alreadyCommitted?: boolean;
    }
  | { ok: false; error: string };

function money(value: string | null | undefined): number {
  if (value == null || value === "") return NaN;
  return parseFloat(String(value).replace(/[$,]/g, ""));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateActiveCommitment(n: NormalizedActiveCommitment): string | null {
  const total = money(n.contractedTotal);
  if (!(total > 0)) return "Active commitments need a contracted total greater than zero.";
  if (!n.eventId && !(n.clientEmail || n.clientId) && !n.eventDate) {
    return "Active commitments need an Event id, or a client email/id plus event date.";
  }
  if (!n.scheduleLines?.length) {
    return "Active commitments need at least one payment schedule line (including already-paid amounts).";
  }
  const scheduleSum = round2(n.scheduleLines.reduce((sum, line) => sum + (money(line.amount) || 0), 0));
  if (Math.abs(scheduleSum - total) > 0.01) {
    return `Payment schedule lines ($${scheduleSum.toFixed(2)}) must equal the contracted total ($${total.toFixed(2)}).`;
  }
  for (const line of n.scheduleLines) {
    if (!(money(line.amount) > 0)) return "Every payment schedule line needs a positive amount.";
    if (!line.label?.trim()) return "Every payment schedule line needs a label.";
  }
  const orderLines = commitmentOrderLines(n);
  if (orderLines.length === 0) return "Active commitments need package or line-item contents.";
  const orderSum = round2(orderLines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 1;
    return sum + qty * (money(l.unitPrice) || 0);
  }, 0));
  if (Math.abs(orderSum - total) > 0.01) {
    return `Event Order lines ($${orderSum.toFixed(2)}) must equal the contracted total ($${total.toFixed(2)}).`;
  }
  return null;
}

export function commitmentOrderLines(n: NormalizedActiveCommitment): ActiveCommitmentLine[] {
  if (n.lines?.length) return n.lines;
  if (n.packageName?.trim()) {
    return [{
      description: n.packageName.trim(),
      quantity: "1",
      unitPrice: n.contractedTotal,
      packageId: null,
    }];
  }
  return [];
}

export function summarizeCommitmentForReview(n: NormalizedActiveCommitment) {
  const total = money(n.contractedTotal) || 0;
  const paid = round2(
    n.scheduleLines.filter((l) => l.alreadyPaid).reduce((sum, l) => sum + (money(l.amount) || 0), 0),
  );
  const remaining = round2(total - paid);
  return {
    contractedTotal: total,
    paid,
    remaining,
    lines: commitmentOrderLines(n),
    scheduleLines: n.scheduleLines,
    contractTitle: n.contractTitle ?? null,
    executionOrigin: n.contractTitle?.trim() ? ("external" as const) : null,
    documents: n.documents ?? [],
    shareSignedAgreementWithCouple: !!n.shareSignedAgreementWithCouple,
  };
}
