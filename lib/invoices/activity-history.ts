/**
 * Read-only labels and balance display for imported financial movements.
 * The rows already live in financial_movements. Loading them is separate
 * so this module can be used by the invoice page's client components.
 */
import { collectedCash, type MovementDraft, type MovementKind } from "@/lib/migration/financial-activity";

export type InvoiceActivity = {
  id: string;
  occurredOn: string | null;
  kind: MovementKind;
  amount: number;
  effect: "reduces_balance" | "increases_balance";
  method: string | null;
  reference: string | null;
  notes: string | null;
  sourceId: string | null;
  relatedReference: string | null;
  counterInvoiceNumber: string | null;
  installmentLabel: string | null;
  createdAt: string;
};

const KIND_LABELS: Record<MovementKind, string> = {
  payment: "Payment",
  refund: "Refund",
  reallocation_in: "Reallocation in",
  reallocation_out: "Reallocation out",
  credit: "Credit",
  adjustment: "Adjustment",
  write_off: "Write-off",
};

export function activityKindLabel(kind: MovementKind): string {
  return KIND_LABELS[kind];
}

export function activityEffectLabel(effect: InvoiceActivity["effect"]): string {
  return effect === "reduces_balance" ? "Reduces what is owed" : "Increases what is owed";
}

/** Credits, write-offs, and adjustments change the balance and are not collected cash. */
export function activityIsCollectedCash(kind: MovementKind): boolean {
  return kind === "payment" || kind === "refund" || kind === "reallocation_in" || kind === "reallocation_out";
}

export function sortInvoiceActivity(rows: readonly InvoiceActivity[]): InvoiceActivity[] {
  return rows.slice().sort((a, b) => {
    if (a.occurredOn && b.occurredOn && a.occurredOn !== b.occurredOn) {
      return a.occurredOn < b.occurredOn ? -1 : 1;
    }
    if (a.occurredOn && !b.occurredOn) return -1;
    if (!a.occurredOn && b.occurredOn) return 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

export function collectedFromActivity(rows: readonly InvoiceActivity[]): number {
  const drafts: MovementDraft[] = rows.map((row) => ({
    kind: row.kind,
    amount: row.amount,
    effect: row.effect,
    occurredOn: row.occurredOn,
  }));
  return collectedCash(drafts);
}

/**
 * Native invoices keep the schedule-line balance. Imported history uses the
 * stored balance, which already counts movements once.
 */
export function invoiceDisplayBalance(input: {
  storedBalance: number;
  scheduleBalance: number | null;
  hasImportActivity: boolean;
}): number {
  if (input.hasImportActivity || input.scheduleBalance == null) return input.storedBalance;
  return input.scheduleBalance;
}

