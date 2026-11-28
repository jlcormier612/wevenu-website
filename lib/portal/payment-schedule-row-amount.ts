/**
 * Client portal Payment Schedule row — primary money figure.
 *
 * The row is an installment on the plan. Its primary figure is the
 * **scheduled installment amount** (`amount`), matching:
 * - Summary "Next Payment" (`next.amount`)
 * - Plan total aggregation (`sum(line.amount)`)
 * - Venue staff schedule primary amount
 *
 * Do **not** substitute `paidAmount` here. Unpaid lines commonly persist
 * `paid_amount = 0`; `paidAmount ?? amount` then incorrectly renders `$0`.
 * Collections belong in Paid / Remaining summary cards (and status copy),
 * not in place of the scheduled installment.
 */
export type ScheduleRowAmountLine = {
  amount: number;
  paidAmount?: number | null;
  status?: string;
};

/**
 * Primary amount shown on a portal Payment Schedule row.
 * Always the scheduled installment; ignores paidAmount for display.
 */
export function scheduleRowPrimaryAmount(line: ScheduleRowAmountLine): number {
  return Number(line.amount) || 0;
}
