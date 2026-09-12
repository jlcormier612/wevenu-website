/**
 * Payment Plan Builder — schedule construction & validation.
 * Presets are builder starting points, not Library assets.
 */
import {
  SCHEDULE_PRESETS,
  type PaymentTiming,
} from "@/lib/payments/constants";
import {
  allocatePresetAmounts,
  resolveDueDateFromTiming,
} from "@/lib/payments/starters";
import type { PaymentObligationKind } from "@/lib/payments/types";

export type PlanBuilderStructure =
  | "equal"
  | "percentage"
  | "dollar"
  | "custom";

export type PlanBuilderQuickPresetId = "thirds" | "fifty_fifty" | "wedding_four";

export type PlanBuilderLineDraft = {
  id: string;
  label: string;
  /** Percentage of invoice total (0–100). Used when structure is percentage/equal/preset. */
  pctOfTotal: number;
  /** Dollar amount. Authoritative when structure is dollar/custom; derived otherwise. */
  amount: number;
  timing: PaymentTiming;
  /** Concrete due date override (YYYY-MM-DD). Empty = resolve from timing. */
  dueDate: string;
  obligationKind: PaymentObligationKind;
};

export type PlanBuilderValidation = {
  ok: boolean;
  scheduledTotal: number;
  remaining: number;
  overAllocated: number;
  errors: string[];
  lineErrors: Record<string, string>;
};

const MONEY_EPS = 0.005;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumAmounts(amounts: number[]): number {
  return roundMoney(amounts.reduce((s, a) => s + a, 0));
}

export function createLineId(): string {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultEqualLines(
  count: number,
  invoiceTotal: number,
): PlanBuilderLineDraft[] {
  const n = Math.max(1, Math.min(12, Math.floor(count)));
  const pct = 100 / n;
  const amounts = allocatePresetAmounts(
    invoiceTotal,
    Array.from({ length: n }, () => ({ pctOfTotal: pct })),
  );
  return amounts.map((amount, i) => {
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const obligationKind: PaymentObligationKind = isFirst
      ? "deposit"
      : isLast
        ? "final"
        : "installment";
    const timing: PaymentTiming = isFirst
      ? { type: "at_booking" }
      : { type: "before_event", days: isLast ? 30 : Math.max(14, 90 - i * 30) };
    return {
      id: createLineId(),
      label: isFirst
        ? "Initial Payment"
        : isLast
          ? "Final Payment"
          : `Payment ${i + 1}`,
      pctOfTotal: roundMoney((amount / invoiceTotal) * 100 || 0),
      amount,
      timing,
      dueDate: "",
      obligationKind,
    };
  });
}

export function linesFromPreset(
  presetId: PlanBuilderQuickPresetId,
  invoiceTotal: number,
): PlanBuilderLineDraft[] {
  const preset = SCHEDULE_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.items.length === 0) return defaultEqualLines(3, invoiceTotal);
  const amounts = allocatePresetAmounts(invoiceTotal, preset.items);
  return preset.items.map((item, i) => ({
    id: createLineId(),
    label: item.label,
    pctOfTotal: item.pctOfTotal,
    amount: amounts[i] ?? 0,
    timing: item.timing,
    dueDate: "",
    obligationKind: item.obligationKind,
  }));
}

/** Recompute dollar amounts from percentages; last line absorbs remainder. */
export function syncAmountsFromPercentages(
  lines: PlanBuilderLineDraft[],
  invoiceTotal: number,
): PlanBuilderLineDraft[] {
  if (lines.length === 0) return lines;
  const amounts = allocatePresetAmounts(
    invoiceTotal,
    lines.map((l) => ({ pctOfTotal: l.pctOfTotal })),
  );
  return lines.map((line, i) => ({
    ...line,
    amount: amounts[i] ?? 0,
    pctOfTotal:
      invoiceTotal > 0
        ? roundMoney(((amounts[i] ?? 0) / invoiceTotal) * 100)
        : 0,
  }));
}

/** Recompute percentages from dollar amounts (display only). */
export function syncPercentagesFromAmounts(
  lines: PlanBuilderLineDraft[],
  invoiceTotal: number,
): PlanBuilderLineDraft[] {
  return lines.map((line) => ({
    ...line,
    pctOfTotal:
      invoiceTotal > 0 ? roundMoney((line.amount / invoiceTotal) * 100) : 0,
  }));
}

export function validatePlanBuilderLines(
  lines: PlanBuilderLineDraft[],
  invoiceTotal: number,
  ctx: { eventDate: string | null; bookingDate: string | null },
): PlanBuilderValidation {
  const errors: string[] = [];
  const lineErrors: Record<string, string> = {};

  if (lines.length === 0) {
    errors.push("Add at least one payment.");
  }

  for (const line of lines) {
    if (!line.label.trim()) {
      lineErrors[line.id] = "Enter a payment name.";
    } else if (!(line.amount > 0)) {
      lineErrors[line.id] = "Amount must be greater than zero.";
    } else if (!Number.isFinite(line.amount)) {
      lineErrors[line.id] = "Enter a valid amount.";
    }

    const needsBooking =
      line.timing.type === "at_booking" || line.timing.type === "after_booking";
    if (needsBooking && !ctx.bookingDate && !line.dueDate.trim()) {
      lineErrors[line.id] =
        lineErrors[line.id] ??
        "Booking date needed for this due-date rule (or set a specific date).";
    }
    if (line.timing.type === "before_event" && !ctx.eventDate && !line.dueDate.trim()) {
      lineErrors[line.id] =
        lineErrors[line.id] ??
        "Event date needed for this due-date rule (or set a specific date).";
    }
  }

  const scheduledTotal = sumAmounts(lines.map((l) => l.amount));
  const remaining = roundMoney(invoiceTotal - scheduledTotal);
  const overAllocated = remaining < -MONEY_EPS ? Math.abs(remaining) : 0;

  if (lines.length > 0 && Math.abs(remaining) > MONEY_EPS) {
    if (remaining > 0) {
      errors.push(
        `Schedule is short by ${remaining.toFixed(2)}. Total scheduled must equal the invoice total.`,
      );
    } else {
      errors.push(
        `Schedule is over by ${overAllocated.toFixed(2)}. Total scheduled must equal the invoice total.`,
      );
    }
  }

  return {
    ok: errors.length === 0 && Object.keys(lineErrors).length === 0,
    scheduledTotal,
    remaining: Math.abs(remaining) <= MONEY_EPS ? 0 : remaining,
    overAllocated,
    errors,
    lineErrors,
  };
}

export function resolveBuilderLineDueDate(
  line: PlanBuilderLineDraft,
  ctx: { eventDate: string | null; bookingDate: string | null },
): string | null {
  if (line.dueDate.trim()) return line.dueDate.trim().slice(0, 10);
  return resolveDueDateFromTiming(line.timing, ctx);
}

export type CommitBuilderLine = {
  label: string;
  amount: string;
  dueDate: string;
  obligationKind: PaymentObligationKind;
};

export function toCommitLines(
  lines: PlanBuilderLineDraft[],
  ctx: { eventDate: string | null; bookingDate: string | null },
): CommitBuilderLine[] {
  return lines.map((line) => ({
    label: line.label.trim(),
    amount: String(roundMoney(line.amount)),
    dueDate: resolveBuilderLineDueDate(line, ctx) ?? "",
    obligationKind: line.obligationKind,
  }));
}

export const PLAN_BUILDER_STRUCTURES: {
  id: PlanBuilderStructure;
  label: string;
  description: string;
}[] = [
  {
    id: "equal",
    label: "Equal payments",
    description: "Split the invoice into equal installments.",
  },
  {
    id: "percentage",
    label: "Percentage-based",
    description: "Set each payment as a percent of the invoice total.",
  },
  {
    id: "dollar",
    label: "Dollar amount-based",
    description: "Enter exact dollar amounts for each payment.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Build the schedule line by line.",
  },
];

export const PLAN_BUILDER_QUICK_PRESETS: {
  id: PlanBuilderQuickPresetId;
  label: string;
  description: string;
}[] = [
  { id: "thirds", label: "1/3", description: "Three payments — booking, planning, final." },
  { id: "fifty_fifty", label: "50/50", description: "Half at booking, half before the event." },
  { id: "wedding_four", label: "Four payments", description: "Equal quarters across booking and planning." },
];
