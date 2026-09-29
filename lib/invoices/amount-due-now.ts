/**
 * Invoice "Amount Due Now" — next open payment-schedule installment that is
 * actually payable now, not the full outstanding balance (Balance Remaining)
 * and not a future installment.
 */

export type AmountDueNowLine = {
  amount: number;
  dueDate: string | null;
  status: string;
  label?: string;
  obligationKind?: string | null;
};

type NextInstallmentFields = {
  amount: number;
  dueDate: string | null;
  label: string | null;
  obligationKind: string | null;
};

export type AmountDueNowResult =
  | ({ kind: "next_installment" } & NextInstallmentFields)
  | ({ kind: "scheduled_future" } & NextInstallmentFields)
  | { kind: "paid_in_full" }
  | { kind: "balance_only"; reason: "no_schedule" | "no_open_lines" };

const OPEN_STATUSES = new Set(["pending", "overdue", "processing"]);

/** Date-only YYYY-MM-DD: missing date is treated as due now. */
export function isInstallmentCurrentlyDue(dueDate: string | null, today: string): boolean {
  if (!dueDate) return true;
  return dueDate <= today;
}

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

function installmentFields(next: AmountDueNowLine): NextInstallmentFields {
  return {
    amount: next.amount,
    dueDate: next.dueDate,
    label: next.label ?? null,
    obligationKind: next.obligationKind ?? null,
  };
}

/**
 * Resolve the customer-facing "Amount Due Now" figure.
 * When a linked schedule exists, use the next open line amount.
 * When that line's due date is after `today`, it is scheduled — not payable now.
 * When there is no schedule (or no open lines) but balance remains, do not
 * mislabel the full balance as "due now" — callers should show an honest alt.
 */
export function resolveAmountDueNow(input: {
  balanceDue: number;
  scheduleLines: AmountDueNowLine[] | null;
  /** Venue-local calendar date (YYYY-MM-DD). Required to distinguish due-now vs future. */
  today?: string;
}): AmountDueNowResult {
  if (!(input.balanceDue > 0)) return { kind: "paid_in_full" };

  if (input.scheduleLines == null) {
    return { kind: "balance_only", reason: "no_schedule" };
  }

  const next = pickNextOpenPaymentLine(input.scheduleLines);
  if (!next) {
    return { kind: "balance_only", reason: "no_open_lines" };
  }

  if (input.today && !isInstallmentCurrentlyDue(next.dueDate, input.today)) {
    return { kind: "scheduled_future", ...installmentFields(next) };
  }

  return { kind: "next_installment", ...installmentFields(next) };
}
