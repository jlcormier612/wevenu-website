/**
 * Venue-default Custom payment schedule.
 *
 * Reuses PaymentTiming + obligation kinds from the existing schedule architecture.
 * Settings stores a DEFAULT template; per-booking setup still uses payment_schedules /
 * payment_line_items — never a parallel system.
 *
 * Percentage mode: reusable across bookings; amounts = % of commercial total.
 * Dollar mode: absolute amounts. Safe only when the booking total matches the
 * template sum — otherwise fail closed (never silently mis-apply).
 */
import type { PaymentTiming } from "@/lib/payments/constants";
import { allocatePresetAmounts } from "@/lib/payments/starters";
import type { PaymentObligationKind } from "@/lib/payments/types";

export type CustomScheduleAmountMode = "percentage" | "dollar";

export type CustomScheduleTemplateItem = {
  label: string;
  /** 0–100; authoritative in percentage mode. */
  pctOfTotal: number;
  /** Absolute dollars; authoritative in dollar mode. */
  amount: number;
  timing: PaymentTiming;
  obligationKind: PaymentObligationKind;
};

export type CustomScheduleTemplate = {
  mode: CustomScheduleAmountMode;
  items: CustomScheduleTemplateItem[];
};

export type CustomScheduleValidation = {
  ok: boolean;
  errors: string[];
};

const MONEY_EPS = 0.005;
const PCT_EPS = 0.05;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isTiming(v: unknown): v is PaymentTiming {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const t = v as Record<string, unknown>;
  if (t.type === "due_today" || t.type === "on_event" || t.type === "at_booking") return true;
  if (t.type === "before_event" && typeof t.days === "number" && t.days >= 0) return true;
  if (t.type === "after_execution" && typeof t.days === "number" && t.days >= 0) return true;
  if (t.type === "after_booking" && typeof t.days === "number" && t.days >= 0) return true;
  return false;
}

function isObligationKind(v: unknown): v is PaymentObligationKind {
  return v === "deposit" || v === "installment" || v === "final" || v === "other";
}

export function defaultCustomScheduleTemplate(
  mode: CustomScheduleAmountMode = "percentage",
): CustomScheduleTemplate {
  const items: CustomScheduleTemplateItem[] = [
    {
      label: "Initial payment",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "due_today" },
      obligationKind: "deposit",
    },
    {
      label: "Payment 2",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "before_event", days: 90 },
      obligationKind: "installment",
    },
    {
      label: "Payment 3",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "before_event", days: 60 },
      obligationKind: "installment",
    },
    {
      label: "Final payment",
      pctOfTotal: 25,
      amount: 0,
      timing: { type: "before_event", days: 30 },
      obligationKind: "final",
    },
  ];
  return { mode, items };
}

export function validateCustomScheduleTemplate(
  template: CustomScheduleTemplate | null | undefined,
): CustomScheduleValidation {
  if (!template || !Array.isArray(template.items) || template.items.length === 0) {
    return { ok: false, errors: ["Add at least one installment."] };
  }
  if (template.mode !== "percentage" && template.mode !== "dollar") {
    return { ok: false, errors: ["Choose percentages or dollar amounts."] };
  }

  const errors: string[] = [];
  for (let i = 0; i < template.items.length; i++) {
    const item = template.items[i]!;
    const name = item.label?.trim() || `Installment ${i + 1}`;
    if (!item.label?.trim()) {
      errors.push(`${name}: enter a name.`);
    }
    if (!isTiming(item.timing)) {
      errors.push(`${name}: choose when this payment is due.`);
    }
    if (!isObligationKind(item.obligationKind)) {
      errors.push(`${name}: choose a payment type.`);
    }
    if (template.mode === "percentage") {
      if (!(typeof item.pctOfTotal === "number") || Number.isNaN(item.pctOfTotal)) {
        errors.push(`${name}: enter a percentage.`);
      } else if (item.pctOfTotal < 0) {
        errors.push(`${name}: percentage cannot be negative.`);
      } else if (item.pctOfTotal === 0) {
        errors.push(`${name}: percentage must be greater than zero.`);
      }
    } else {
      if (!(typeof item.amount === "number") || Number.isNaN(item.amount)) {
        errors.push(`${name}: enter a dollar amount.`);
      } else if (item.amount < 0) {
        errors.push(`${name}: amount cannot be negative.`);
      } else if (!(item.amount > 0)) {
        errors.push(`${name}: amount must be greater than zero.`);
      }
    }
  }

  if (template.mode === "percentage" && errors.length === 0) {
    const sum = template.items.reduce((s, it) => s + (it.pctOfTotal || 0), 0);
    if (Math.abs(sum - 100) > PCT_EPS) {
      errors.push(
        `Percentages must total exactly 100% (currently ${roundMoney(sum)}%).`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Parse/normalize stored JSON; returns null when invalid or empty. */
export function normalizeCustomScheduleTemplate(
  raw: unknown,
): CustomScheduleTemplate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const mode = src.mode === "dollar" ? "dollar" : src.mode === "percentage" ? "percentage" : null;
  if (!mode) return null;
  if (!Array.isArray(src.items) || src.items.length === 0) return null;

  const items: CustomScheduleTemplateItem[] = [];
  for (const row of src.items) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const pct =
      typeof r.pctOfTotal === "number" && Number.isFinite(r.pctOfTotal) ? r.pctOfTotal : 0;
    const amount =
      typeof r.amount === "number" && Number.isFinite(r.amount) ? roundMoney(r.amount) : 0;
    const timing = isTiming(r.timing) ? r.timing : ({ type: "before_event", days: 30 } as PaymentTiming);
    const obligationKind = isObligationKind(r.obligationKind)
      ? r.obligationKind
      : ("installment" as PaymentObligationKind);
    items.push({ label, pctOfTotal: pct, amount, timing, obligationKind });
  }
  if (items.length === 0) return null;

  const template: CustomScheduleTemplate = { mode, items };
  return validateCustomScheduleTemplate(template).ok ? template : null;
}

export type AppliedCustomLine = {
  label: string;
  amount: number;
  dueDate: string;
  obligationKind: PaymentObligationKind;
};

/**
 * Materialize a venue-default Custom template against a known commercial total.
 * Dollar mode requires an exact total match (fail closed).
 */
export function applyCustomScheduleToTotal(input: {
  template: CustomScheduleTemplate;
  total: number;
  today: string;
  eventDate?: string | null;
  remainingDueDate?: string | null;
  bookingDate?: string | null;
  /** YYYY-MM-DD — Fully Executed contract date for after_execution timing. */
  executedAt?: string | null;
}): { ok: true; lines: AppliedCustomLine[] } | { ok: false; message: string } {
  const validation = validateCustomScheduleTemplate(input.template);
  if (!validation.ok) {
    return { ok: false, message: validation.errors[0] ?? "Custom payment schedule is invalid." };
  }

  const total = roundMoney(input.total);
  if (!(total > 0)) {
    return { ok: false, message: "Package total must be greater than zero." };
  }

  let amounts: number[];
  if (input.template.mode === "percentage") {
    amounts = allocatePresetAmounts(
      total,
      input.template.items.map((it) => ({ pctOfTotal: it.pctOfTotal })),
    );
  } else {
    amounts = input.template.items.map((it) => roundMoney(it.amount));
    const sum = roundMoney(amounts.reduce((s, a) => s + a, 0));
    if (Math.abs(sum - total) > MONEY_EPS) {
      return {
        ok: false,
        message:
          `This dollar schedule totals $${sum.toLocaleString()} but the booking is $${total.toLocaleString()}. ` +
          `Dollar defaults only apply when the amounts match the booking total. ` +
          `Edit the payment plan for this booking, or switch the venue default to percentages.`,
      };
    }
  }

  const today = input.today.trim().slice(0, 10);
  const bookingDate = (input.bookingDate ?? input.today).trim().slice(0, 10);
  const eventDate = input.eventDate?.trim().slice(0, 10) || null;
  const executedAt = input.executedAt?.trim().slice(0, 10) || null;
  const fallbackRemaining = input.remainingDueDate?.trim().slice(0, 10) || eventDate;

  const lines: AppliedCustomLine[] = [];
  for (let i = 0; i < input.template.items.length; i++) {
    const item = input.template.items[i]!;
    const amount = amounts[i] ?? 0;
    if (!(amount > 0)) continue;

    let dueDate: string | null = null;
    if (item.timing.type === "due_today") {
      dueDate = today;
    } else if (item.timing.type === "at_booking") {
      dueDate = bookingDate;
    } else if (item.timing.type === "after_booking") {
      const d = new Date(`${bookingDate}T12:00:00`);
      d.setDate(d.getDate() + item.timing.days);
      dueDate = d.toISOString().slice(0, 10);
    } else if (item.timing.type === "after_execution") {
      if (!executedAt) {
        return {
          ok: false,
          message:
            "A fully executed contract date is needed for installments due after the agreement is signed.",
        };
      }
      const d = new Date(`${executedAt}T12:00:00`);
      d.setDate(d.getDate() + item.timing.days);
      dueDate = d.toISOString().slice(0, 10);
    } else if (item.timing.type === "on_event") {
      if (!eventDate && !fallbackRemaining) {
        return {
          ok: false,
          message:
            "Set an event date (or a remaining due date) before applying this payment schedule.",
        };
      }
      dueDate = (eventDate ?? fallbackRemaining)!;
    } else if (item.timing.type === "before_event") {
      if (!eventDate && !fallbackRemaining) {
        return {
          ok: false,
          message:
            "Set an event date (or a remaining due date) before applying this payment schedule.",
        };
      }
      const anchor = eventDate ?? fallbackRemaining!;
      const d = new Date(`${anchor}T12:00:00`);
      d.setDate(d.getDate() - item.timing.days);
      dueDate = d.toISOString().slice(0, 10);
    }

    if (!dueDate) {
      return { ok: false, message: "Could not resolve a due date for every installment." };
    }

    lines.push({
      label: item.label.trim() || `Payment ${i + 1}`,
      amount,
      dueDate,
      obligationKind: item.obligationKind,
    });
  }

  if (lines.length === 0) {
    return { ok: false, message: "Custom payment schedule produced no installments." };
  }

  const sum = roundMoney(lines.reduce((s, l) => s + l.amount, 0));
  if (Math.abs(sum - total) > MONEY_EPS) {
    return { ok: false, message: "Payment schedule must reconcile to the commitment total." };
  }

  return { ok: true, lines };
}
