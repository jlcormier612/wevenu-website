/**
 * Payments reference data and display helpers (Sprint 16).
 */
import type { PaymentItemStatus, PaymentObligationKind, PaymentPlanReviewStatus, PaymentSchedule, PaymentLineItem } from "@/lib/payments/types";

export type Option = { value: string; label: string };

export const PAYMENT_METHODS: Option[] = [
  { value: "cash",          label: "Cash" },
  { value: "check",         label: "Check" },
  { value: "bank_transfer", label: "Bank Transfer / ACH" },
  { value: "credit_card",   label: "Credit Card" },
  { value: "venmo",         label: "Venmo / Zelle" },
  { value: "stripe",        label: "Stripe" },
  { value: "other",         label: "Other" },
];

export function paymentMethodLabel(value: string | null): string {
  if (!value) return "";
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

export const STATUS_LABEL: Record<PaymentItemStatus, string> = {
  pending:            "Pending",
  processing:         "Processing",
  overdue:            "Overdue",
  paid:               "Paid",
  cancelled:          "Cancelled",
  partially_refunded: "Partially Refunded",
  refunded:           "Refunded",
};

export function formatMoney(
  amount: number | null | undefined,
  currency = "USD",
): string {
  if (amount == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Derive the schedule-level status from its line items. */
export function deriveScheduleStatus(
  items: PaymentLineItem[],
): "complete" | "attention" | "on_track" | "no_payments" {
  if (items.length === 0) return "no_payments";
  const active = items.filter((i) => i.status !== "cancelled");
  if (active.length === 0) return "no_payments";
  if (active.some((i) => i.status === "overdue" || i.status === "refunded" || i.status === "partially_refunded")) return "attention";
  if (active.every((i) => i.status === "paid")) return "complete";
  return "on_track";
}

/** Total amount actually retained across collected line items, net of any refund (TR-M3). */
export function computeTotalPaid(items: PaymentLineItem[]): number {
  return items
    .filter((i) => i.status === "paid" || i.status === "partially_refunded" || i.status === "refunded")
    .reduce((sum, i) => sum + (i.paidAmount ?? i.amount) - (i.refundedAmount ?? 0), 0);
}

/**
 * Booking Financial Architecture Phase 3c — "Payment Plans should NEVER
 * automatically move... surface a clear Needs Review state." A direct
 * comparison, not a timestamp or revision counter: current whenever the
 * schedule's own total matches its Invoice's total right now, or whenever
 * a coordinator already reviewed and accepted this exact mismatch.
 */
export function paymentPlanReviewStatus(
  schedule: Pick<PaymentSchedule, "totalAmount" | "acknowledgedInvoiceTotal">,
  invoiceTotal: number | null,
): PaymentPlanReviewStatus {
  if (invoiceTotal == null) return "current"; // no linked invoice — nothing to compare against
  if (schedule.totalAmount === invoiceTotal) return "current";
  if (schedule.acknowledgedInvoiceTotal === invoiceTotal) return "current";
  return "needs_review";
}

export const OBLIGATION_KIND_OPTIONS: { value: PaymentObligationKind; label: string }[] = [
  { value: "deposit", label: "Initial Payment" },
  { value: "installment", label: "Planning Payment" },
  { value: "final", label: "Final Payment" },
  { value: "other", label: "Other" },
];

export function obligationKindLabel(kind: PaymentObligationKind | null | undefined): string {
  if (!kind) return "";
  return OBLIGATION_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

/**
 * Reusable payment timing rule for starters / presets.
 * Stored schedules keep concrete due_date only — the rule is not re-stored on lines.
 *
 * at_booking ≠ before_event with days 0 (event day). Those are different business rules.
 * after_booking is supported in the model for future custom structures; starters use
 * at_booking + before_event today.
 */
export type PaymentTiming =
  | { type: "at_booking" }
  | { type: "before_event"; days: number }
  | { type: "after_booking"; days: number };

export type SchedulePresetItem = {
  label: string;
  pctOfTotal: number;
  timing: PaymentTiming;
  /** Authoritative — never re-derived from label later. */
  obligationKind: PaymentObligationKind;
};

/** Schedule template presets for quick setup — structures only; amounts derive from the linked invoice. */
export type SchedulePreset = {
  id: string;
  label: string;
  description: string;
  items: SchedulePresetItem[];
};

/**
 * Hello to Cheers payment-plan starters + legacy certified splits.
 * Percentages: keep existing thirds / 50-50 / 30-70 math; wedding_four uses
 * equal quarters as structure (not a venue deposit policy).
 * Do not invent cancellation fees, late fees, or legal payment language here.
 */
export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "thirds",
    label: "Standard Wedding — 3 Payments",
    description: "Initial payment at booking, a planning payment, and final payment before the event.",
    items: [
      { label: "Initial Payment", pctOfTotal: 33.33, timing: { type: "at_booking" }, obligationKind: "deposit" },
      { label: "Planning Payment", pctOfTotal: 33.33, timing: { type: "before_event", days: 90 }, obligationKind: "installment" },
      { label: "Final Payment", pctOfTotal: 33.34, timing: { type: "before_event", days: 30 }, obligationKind: "final" },
    ],
  },
  {
    id: "wedding_four",
    label: "Standard Wedding — 4 Payments",
    description: "Initial payment at booking, two planning payments, and final payment before the event.",
    items: [
      { label: "Initial Payment", pctOfTotal: 25, timing: { type: "at_booking" }, obligationKind: "deposit" },
      { label: "Planning Payment 1", pctOfTotal: 25, timing: { type: "before_event", days: 120 }, obligationKind: "installment" },
      { label: "Planning Payment 2", pctOfTotal: 25, timing: { type: "before_event", days: 60 }, obligationKind: "installment" },
      { label: "Final Payment", pctOfTotal: 25, timing: { type: "before_event", days: 30 }, obligationKind: "final" },
    ],
  },
  {
    id: "custom",
    label: "Custom Payment Schedule",
    description: "Build a payment schedule that matches the way your venue does business.",
    items: [],
  },
  {
    id: "fifty_fifty",
    label: "50% Initial + 50% Final",
    description: "Half at booking, half before the event (certified split).",
    items: [
      { label: "Initial Payment (50%)", pctOfTotal: 50, timing: { type: "at_booking" }, obligationKind: "deposit" },
      { label: "Final Payment (50%)", pctOfTotal: 50, timing: { type: "before_event", days: 30 }, obligationKind: "final" },
    ],
  },
  {
    id: "deposit_30_70",
    label: "30% Initial + 70% Final",
    description: "Smaller initial payment at booking, larger final before the event (certified split).",
    items: [
      { label: "Initial Payment (30%)", pctOfTotal: 30, timing: { type: "at_booking" }, obligationKind: "deposit" },
      { label: "Final Payment (70%)", pctOfTotal: 70, timing: { type: "before_event", days: 30 }, obligationKind: "final" },
    ],
  },
  {
    id: "fifty_25_25",
    label: "50% Initial + 25% + 25%",
    description: "Half at booking, then two even planning/final payments before the event.",
    items: [
      { label: "Initial Payment (50%)", pctOfTotal: 50, timing: { type: "at_booking" }, obligationKind: "deposit" },
      { label: "Planning Payment (25%)", pctOfTotal: 25, timing: { type: "before_event", days: 60 }, obligationKind: "installment" },
      { label: "Final Payment (25%)", pctOfTotal: 25, timing: { type: "before_event", days: 14 }, obligationKind: "final" },
    ],
  },
];
