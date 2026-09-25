/**
 * Payment plan vs booking commitment reconciliation.
 *
 * When the invoice/commitment total changes, the schedule must not look
 * valid if it still totals the old amount. Preset/equal structures can be
 * rebuilt safely when no payment has been requested or collected.
 * Customized dollar schedules require venue review — never auto-redistribute.
 */
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import { allocatePresetAmounts } from "@/lib/payments/starters";
import type { PaymentItemStatus } from "@/lib/payments/types";

const MONEY_EPS = 0.02;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CommitmentReconcileKind =
  | "current"
  | "auto_recalc"
  | "needs_review"
  | "locked";

export type CommitmentReconcileDecision = {
  kind: CommitmentReconcileKind;
  previousTotal: number;
  nextTotal: number;
  reason:
    | "matched"
    | "equal_installments"
    | "known_preset"
    | "customized"
    | "has_activity";
};

const ACTIVE_STATUSES: PaymentItemStatus[] = [
  "processing",
  "overdue",
  "paid",
  "partially_refunded",
  "refunded",
];

export function scheduleHasPaymentActivity(
  lines: {
    status: string;
    paidAmount?: number | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  }[],
  invoiceStatus?: string | null,
): boolean {
  if (invoiceStatus && invoiceStatus !== "draft") return true;
  return lines.some((l) => {
    if (ACTIVE_STATUSES.includes(l.status as PaymentItemStatus)) return true;
    if ((l.paidAmount ?? 0) > 0) return true;
    if (l.stripeCheckoutSessionId || l.stripePaymentIntentId) return true;
    return false;
  });
}

function amountsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((n, i) => Math.abs(n - (b[i] ?? 0)) <= MONEY_EPS);
}

export function looksLikeEqualInstallments(amounts: number[]): boolean {
  const active = amounts.filter((n) => n > 0);
  if (active.length < 2) return true;
  const max = Math.max(...active);
  const min = Math.min(...active);
  return max - min <= MONEY_EPS;
}

export function matchingPresetId(
  amounts: number[],
  scheduleTotal: number,
): string | null {
  if (!(scheduleTotal > 0) || amounts.length === 0) return null;
  for (const preset of SCHEDULE_PRESETS) {
    if (preset.items.length === 0 || preset.items.length !== amounts.length) continue;
    const expected = allocatePresetAmounts(scheduleTotal, preset.items);
    if (amountsEqual(amounts, expected)) return preset.id;
  }
  return null;
}

export function classifyCommitmentReconcile(input: {
  scheduleTotal: number;
  commitmentTotal: number;
  lineAmounts: number[];
  hasActivity: boolean;
}): CommitmentReconcileDecision {
  const previousTotal = roundMoney(input.scheduleTotal);
  const nextTotal = roundMoney(input.commitmentTotal);
  if (Math.abs(previousTotal - nextTotal) <= MONEY_EPS) {
    return { kind: "current", previousTotal, nextTotal, reason: "matched" };
  }
  if (input.hasActivity) {
    return { kind: "locked", previousTotal, nextTotal, reason: "has_activity" };
  }
  if (looksLikeEqualInstallments(input.lineAmounts)) {
    return { kind: "auto_recalc", previousTotal, nextTotal, reason: "equal_installments" };
  }
  if (matchingPresetId(input.lineAmounts, previousTotal)) {
    return { kind: "auto_recalc", previousTotal, nextTotal, reason: "known_preset" };
  }
  return { kind: "needs_review", previousTotal, nextTotal, reason: "customized" };
}

export function recalculateLineAmounts(input: {
  previousAmounts: number[];
  previousTotal: number;
  nextTotal: number;
}): number[] {
  const next = roundMoney(input.nextTotal);
  const prev = roundMoney(input.previousTotal);
  if (!(next > 0) || input.previousAmounts.length === 0) return input.previousAmounts.map(() => 0);
  if (looksLikeEqualInstallments(input.previousAmounts)) {
    return allocatePresetAmounts(
      next,
      input.previousAmounts.map(() => ({
        pctOfTotal: 100 / input.previousAmounts.length,
      })),
    );
  }
  const presetId = matchingPresetId(input.previousAmounts, prev);
  const preset = presetId ? SCHEDULE_PRESETS.find((p) => p.id === presetId) : null;
  if (preset) return allocatePresetAmounts(next, preset.items);
  const pcts = input.previousAmounts.map((amt) =>
    prev > 0 ? (amt / prev) * 100 : 0,
  );
  return allocatePresetAmounts(next, pcts.map((pctOfTotal) => ({ pctOfTotal })));
}

export function planTotalsReconcile(scheduleTotal: number, commitmentTotal: number): boolean {
  return Math.abs(roundMoney(scheduleTotal) - roundMoney(commitmentTotal)) <= MONEY_EPS;
}

export function scheduledPlanTotal(
  lines: { amount: number; status?: string }[],
): number {
  return roundMoney(
    lines
      .filter((l) => l.status !== "cancelled")
      .reduce((s, l) => s + (Number(l.amount) || 0), 0),
  );
}

export function assertRequestablePaymentPlan(input: {
  commitmentTotal: number;
  lines: { amount: number; status?: string }[];
}): { ok: true } | { ok: false; title: string; body: string } {
  if (!input.lines.some((l) => l.status !== "cancelled")) {
    return {
      ok: false,
      title: "Payment plan needs review",
      body: "Create a payment plan that equals the current booking commitment before requesting payment.",
    };
  }
  const scheduled = scheduledPlanTotal(input.lines);
  if (planTotalsReconcile(scheduled, input.commitmentTotal)) return { ok: true };
  return { ok: false, ...commitmentMismatchCopy(scheduled, input.commitmentTotal) };
}

export function commitmentMismatchCopy(previousTotal: number, nextTotal: number): {
  title: string;
  body: string;
} {
  const prev = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(previousTotal);
  const next = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(nextTotal);
  return {
    title: "Payment plan needs review",
    body: `The booking total changed from ${prev} to ${next}. The current payment schedule still totals ${prev}. Review the payment plan before requesting payment.`,
  };
}
