import type { EventOrder, EventOrderDisplayStatus, EventOrderLine, EventOrderLineProvenance } from "@/lib/event-orders/types";

/**
 * Open -> Finalized -> Amended is a two-value stored status (open/finalized)
 * plus a revision counter, never a three-value enum — "Amended" is derived
 * here, not stored, so there is nothing for a raw status column and a
 * display label to ever disagree about (docs/booking-financial-
 * architecture-event-order-model.md §1).
 */
export function eventOrderDisplayStatus(order: Pick<EventOrder, "status" | "revision">): EventOrderDisplayStatus {
  if (order.status === "finalized") return "finalized";
  return order.revision > 0 ? "amended" : "open";
}

export const DISPLAY_STATUS_LABEL: Record<EventOrderDisplayStatus, string> = {
  open: "Open",
  finalized: "Finalized",
  amended: "Amended",
};

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}

export function sumLines(lines: Pick<EventOrderLine, "amount">[]): number {
  return lines.reduce((s, l) => s + l.amount, 0);
}

export const PROVENANCE_LABEL: Record<EventOrderLineProvenance, string> = {
  package: "Package",
  inventory: "Inventory",
  custom: "Custom",
};

/**
 * Booking Financial Architecture Phase 3b — a deterministic fingerprint of
 * an Event Order's current lines, used only to answer "has anything
 * changed since a coordinator last reviewed and dismissed drift." Not a
 * hash of anything cryptographically sensitive — a plain, sortable string
 * is enough, and keeping it human-inspectable makes debugging easier.
 */
export function eventOrderLinesFingerprint(lines: Pick<EventOrderLine, "id" | "quantity" | "unitPrice" | "description">[]): string {
  return lines
    .map((l) => `${l.id}:${l.quantity}:${l.unitPrice}:${l.description}`)
    .sort()
    .join("|");
}
