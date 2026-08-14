/**
 * Hello to Cheers — Payment Plan starter presentation helpers.
 * Presets themselves live in SCHEDULE_PRESETS (lib/payments/constants.ts).
 * Masters are code fixtures — not a second payment-plan template database.
 */
import type { PaymentObligationKind } from "@/lib/payments/types";
import {
  SCHEDULE_PRESETS,
  type SchedulePreset,
} from "@/lib/payments/constants";

/** Customer-facing starter keys shown first in Library / create flow. */
export const PAYMENT_PLAN_STARTER_IDS = [
  "thirds",
  "wedding_four",
  "custom",
] as const;

export type PaymentPlanStarterId = (typeof PAYMENT_PLAN_STARTER_IDS)[number];

export function isPaymentPlanStarterId(id: string): id is PaymentPlanStarterId {
  return (PAYMENT_PLAN_STARTER_IDS as readonly string[]).includes(id);
}

/** Primary starters for Library / create picker (approved customer names). */
export function getPaymentPlanStarters(): SchedulePreset[] {
  return PAYMENT_PLAN_STARTER_IDS
    .map((id) => SCHEDULE_PRESETS.find((p) => p.id === id))
    .filter((p): p is SchedulePreset => Boolean(p));
}

/** Additional certified presets kept for venues that still prefer them. */
export function getAdditionalSchedulePresets(): SchedulePreset[] {
  const starter = new Set<string>(PAYMENT_PLAN_STARTER_IDS);
  return SCHEDULE_PRESETS.filter((p) => !starter.has(p.id));
}

/**
 * Split a total across preset percentages with exact reconciliation —
 * the last line absorbs remaining cents so the schedule always equals the invoice.
 */
export function allocatePresetAmounts(
  totalAmount: number,
  items: Array<{ pctOfTotal: number }>,
): number[] {
  if (items.length === 0) return [];
  const amounts: number[] = [];
  let allocated = 0;
  for (let i = 0; i < items.length; i++) {
    const isLast = i === items.length - 1;
    const amt = isLast
      ? Math.round((totalAmount - allocated) * 100) / 100
      : Math.round((totalAmount * items[i].pctOfTotal) / 100 * 100) / 100;
    amounts.push(amt);
    allocated += amt;
  }
  return amounts;
}

/** Soft milestone copy for invoices / Pay Now — not legal or fee policy. */
export function paymentMilestoneDescription(
  kind: PaymentObligationKind | null | undefined,
  label?: string,
): string {
  switch (kind) {
    case "deposit":
      return "This invoice represents your initial payment toward your event.";
    case "installment":
      return "This invoice represents your scheduled planning payment.";
    case "final":
      return "This invoice represents the remaining balance due for your event.";
    default:
      return label
        ? `This payment is for: ${label}.`
        : "This invoice is a payment toward your event.";
  }
}

export function defaultInvoiceNotes(venueName: string): string {
  const name = venueName.trim() || "us";
  return `Thank you for choosing ${name} for your celebration. If you have any questions about this invoice, please contact our team.`;
}
