/**
 * Pure reconciliation for imported invoices.
 * Schedules describe what is owed. Movements describe each historical action.
 * This module does not write, charge, or notify.
 */

export const MOVEMENT_KINDS = [
  "payment",
  "refund",
  "reallocation_out",
  "reallocation_in",
  "credit",
  "adjustment",
  "write_off",
] as const;

export type MovementKind = (typeof MOVEMENT_KINDS)[number];
export type BalanceEffect = "reduces_balance" | "increases_balance";

export type MovementDraft = {
  kind: MovementKind;
  amount: number;
  effect: BalanceEffect;
  occurredOn?: string | null;
};

const CASH_IN: MovementKind[] = ["payment", "reallocation_in"];
const CASH_OUT: MovementKind[] = ["refund", "reallocation_out"];

export function effectForKind(
  kind: MovementKind,
  adjustmentEffect?: string | null,
): BalanceEffect | null {
  if (kind === "payment" || kind === "reallocation_in" || kind === "credit" || kind === "write_off") {
    return "reduces_balance";
  }
  if (kind === "refund" || kind === "reallocation_out") return "increases_balance";
  if (kind === "adjustment") {
    if (adjustmentEffect === "reduces_balance" || adjustmentEffect === "increases_balance") {
      return adjustmentEffect;
    }
    return null;
  }
  return null;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** How much these movements reduce the amount still owed. */
export function netObligationReduction(movements: readonly MovementDraft[]): number {
  return roundMoney(movements.reduce((sum, movement) => {
    return sum + (movement.effect === "reduces_balance" ? movement.amount : -movement.amount);
  }, 0));
}

/** Cash actually received, after refunds and reallocations. Credits are not cash. */
export function collectedCash(movements: readonly MovementDraft[]): number {
  return roundMoney(movements.reduce((sum, movement) => {
    if (CASH_IN.includes(movement.kind)) return sum + movement.amount;
    if (CASH_OUT.includes(movement.kind)) return sum - movement.amount;
    return sum;
  }, 0));
}

export function reconcileInvoiceBalance(input: {
  invoiceTotal: number;
  movements: readonly MovementDraft[];
  statedRemaining?: number | null;
}): { ok: true; remaining: number; collected: number } | { ok: false; reason: string } {
  if (!Number.isFinite(input.invoiceTotal) || input.invoiceTotal < 0) {
    return { ok: false, reason: "Invoice total must be zero or greater." };
  }
  for (const movement of input.movements) {
    if (!Number.isFinite(movement.amount) || movement.amount < 0) {
      return { ok: false, reason: "Each financial activity needs an amount of zero or greater." };
    }
  }
  const reduction = netObligationReduction(input.movements);
  const remaining = roundMoney(input.invoiceTotal - reduction);
  if (remaining < -0.009) {
    return {
      ok: false,
      reason: `Payments, credits, and adjustments reduce this invoice by ${reduction.toFixed(2)}, which is more than the invoice total ${input.invoiceTotal.toFixed(2)}. Hold this invoice for review instead of changing the amounts.`,
    };
  }
  if (input.statedRemaining != null && Number.isFinite(input.statedRemaining)) {
    if (Math.abs(roundMoney(input.statedRemaining) - Math.max(0, remaining)) > 0.01) {
      return {
        ok: false,
        reason: `Stated remaining balance ${roundMoney(input.statedRemaining).toFixed(2)} does not match invoice total minus the supplied activity (${Math.max(0, remaining).toFixed(2)}).`,
      };
    }
  }
  return { ok: true, remaining: Math.max(0, remaining), collected: collectedCash(input.movements) };
}

export function parseMoney(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return roundMoney(parsed);
}

export function isMovementKind(value: string): value is MovementKind {
  return (MOVEMENT_KINDS as readonly string[]).includes(value);
}
