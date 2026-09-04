/**
 * Hello to Cheers — Payment Plan starter presentation helpers.
 * Presets themselves live in SCHEDULE_PRESETS (lib/payments/constants.ts).
 * Masters are code fixtures — not a second payment-plan template database.
 */
import type { PaymentObligationKind } from "@/lib/payments/types";
import {
  SCHEDULE_PRESETS,
  type PaymentTiming,
  type SchedulePreset,
  type SchedulePresetItem,
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

/** Add/subtract calendar days from a YYYY-MM-DD date (noon local avoids DST edge cases). */
export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.trim().slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Human timing for venue owners — never expose implementation field names. */
export function formatTimingLabel(timing?: PaymentTiming | null): string {
  if (!timing) return "You set the date when you create the schedule";
  if (timing.type === "at_booking") return "At booking";
  if (timing.type === "after_booking") {
    return timing.days === 1 ? "1 day after booking" : `${timing.days} days after booking`;
  }
  // before_event — days 0 means the event day, not "at booking"
  if (timing.days === 0) return "On the event day";
  return timing.days === 1 ? "1 day before the event" : `${timing.days} days before the event`;
}

/**
 * @deprecated Prefer formatTimingLabel. Kept for any callers still passing legacy offsets.
 * Positive = after event, negative = before event, 0 = event day.
 */
export function formatRelativeDueLabel(offsetDaysFromEvent?: number | null): string {
  if (offsetDaysFromEvent == null) return formatTimingLabel(null);
  if (offsetDaysFromEvent === 0) return formatTimingLabel({ type: "before_event", days: 0 });
  if (offsetDaysFromEvent > 0) {
    const days = offsetDaysFromEvent;
    return days === 1 ? "1 day after the event" : `${days} days after the event`;
  }
  return formatTimingLabel({ type: "before_event", days: Math.abs(offsetDaysFromEvent) });
}

/** Display percentage without floating noise (33.33 → about 33%). */
export function formatPresetPercent(pctOfTotal: number): string {
  const rounded = Math.round(pctOfTotal);
  if (Math.abs(pctOfTotal - rounded) < 0.05) return `${rounded}%`;
  return `about ${rounded}%`;
}

/**
 * Concrete calendar due date from a reusable timing rule.
 * Returns null when the required anchor date is missing (Event or booking date).
 */
export function resolveDueDateFromTiming(
  timing: PaymentTiming,
  ctx: { eventDate: string | null; bookingDate: string | null },
): string | null {
  if (timing.type === "at_booking") {
    return ctx.bookingDate ? ctx.bookingDate.trim().slice(0, 10) : null;
  }
  if (timing.type === "after_booking") {
    if (!ctx.bookingDate) return null;
    return addCalendarDays(ctx.bookingDate, timing.days);
  }
  if (!ctx.eventDate) return null;
  return addCalendarDays(ctx.eventDate, -timing.days);
}

export function resolvePresetItemDueDate(
  item: Pick<SchedulePresetItem, "timing">,
  ctx: { eventDate: string | null; bookingDate: string | null },
): string | null {
  return resolveDueDateFromTiming(item.timing, ctx);
}

/** @deprecated Prefer resolveDueDateFromTiming with before_event. */
export function previewDueDateFromEvent(
  eventDate: string,
  offsetDaysFromEvent: number,
): string {
  return addCalendarDays(eventDate, offsetDaysFromEvent);
}

export function formatPreviewDueDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

/**
 * Safe relative return path for payment-schedule context handoff
 * (invoice → add amount → back to schedule). Rejects open redirects.
 */
export function safePaymentScheduleReturnPath(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/payments")) return null;
  if (decoded.startsWith("//") || decoded.includes("://")) return null;
  return decoded;
}
