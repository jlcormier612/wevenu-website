/**
 * Invoice "Amount Due Now" — next open payment-schedule installment,
 * not the full outstanding balance (Balance Remaining).
 */

export type AmountDueNowLine = {
  amount: number;
  dueDate: string | null;
  status: string;
  label?: string;
  obligationKind?: string | null;
};

export type AmountDueNowResult =
  | {
      kind: "next_installment";
      amount: number;
      dueDate: string | null;
      label: string | null;
      obligationKind: string | null;
    }
  | { kind: "paid_in_full" }
  | { kind: "balance_only"; reason: "no_schedule" | "no_open_lines" };

const OPEN_STATUSES = new Set(["pending", "overdue", "processing"]);

/** Next open schedule line by due date (nulls last), then sort order if provided. */
export function pickNextOpenPaymentLine<T extends AmountDueNowLine & { sortOrder?: number }>(
  lines: T[],
): T | null {
  const open = lines.filter((l) => OPEN_STATUSES.has(l.status));
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    const ad = a.dueDate ?? "9999-99-99";
    const bd = b.dueDate ?? "9999-99-99";
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  })[0] ?? null;
}

/**
 * Resolve the customer-facing "Amount Due Now" figure.
 * When a linked schedule exists, use the next open line amount.
 * When there is no schedule (or no open lines) but balance remains, do not
 * mislabel the full balance as "due now" — callers should show an honest alt.
 */
export function resolveAmountDueNow(input: {
  balanceDue: number;
  scheduleLines: AmountDueNowLine[] | null;
}): AmountDueNowResult {
  if (!(input.balanceDue > 0)) return { kind: "paid_in_full" };

  if (input.scheduleLines == null) {
    return { kind: "balance_only", reason: "no_schedule" };
  }

  const next = pickNextOpenPaymentLine(input.scheduleLines);
  if (!next) {
    return { kind: "balance_only", reason: "no_open_lines" };
  }

  return {
    kind: "next_installment",
    amount: next.amount,
    dueDate: next.dueDate,
    label: next.label ?? null,
    obligationKind: next.obligationKind ?? null,
  };
}
