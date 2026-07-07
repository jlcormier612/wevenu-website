/**
 * Payments reference data and display helpers (Sprint 16).
 */
import type { PaymentItemStatus, PaymentSchedule, PaymentLineItem } from "@/lib/payments/types";

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

/** Schedule template presets for quick setup. */
export type SchedulePreset = {
  id: string;
  label: string;
  description: string;
  items: Array<{ label: string; pctOfTotal: number; offsetDaysFromEvent?: number }>;
};

export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "fifty_fifty",
    label: "50% Deposit + 50% Final",
    description: "Two equal payments",
    items: [
      { label: "Deposit (50%)", pctOfTotal: 50, offsetDaysFromEvent: -90 },
      { label: "Final Payment (50%)", pctOfTotal: 50, offsetDaysFromEvent: -30 },
    ],
  },
  {
    id: "thirds",
    label: "Three Equal Installments",
    description: "Three payments of ≈ 33%",
    items: [
      { label: "First Installment", pctOfTotal: 33.33, offsetDaysFromEvent: -180 },
      { label: "Second Installment", pctOfTotal: 33.33, offsetDaysFromEvent: -90 },
      { label: "Final Payment", pctOfTotal: 33.34, offsetDaysFromEvent: -30 },
    ],
  },
  {
    id: "deposit_30_70",
    label: "30% Deposit + 70% Final",
    description: "Smaller deposit, larger final",
    items: [
      { label: "Deposit (30%)", pctOfTotal: 30, offsetDaysFromEvent: -90 },
      { label: "Final Payment (70%)", pctOfTotal: 70, offsetDaysFromEvent: -30 },
    ],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start with a blank schedule",
    items: [],
  },
];
