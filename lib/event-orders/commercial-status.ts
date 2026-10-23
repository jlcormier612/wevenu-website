/**
 * C3 — Event commercial status strip (pure derivation).
 * Chips + deep-links only. No Share/Finalize/Send/Create actions.
 * Uses only statuses supported by existing domain models.
 */

import {
  clientChoicesDisplayLabel,
  toClientChoicesDisplayStatus,
} from "@/lib/client-choices/constants";
import type { ClientChoices } from "@/lib/client-choices/types";
import type { EventInventoryStatus } from "@/lib/event-inventory/types";
import type { Invoice } from "@/lib/invoices/types";
import type { EventOrderStatus } from "@/lib/event-orders/types";

export type CommercialNavTarget =
  | { kind: "tab"; tab: "inventory" | "event-order" | "invoice"; anchor?: string }
  | { kind: "href"; href: string };

export type CommercialStatusChip = {
  id: "inventory" | "choices" | "event_order" | "invoice" | "payment_plan";
  label: string;
  /** Short status text — never invents completion */
  status: string;
  nav: CommercialNavTarget;
};

export type CommercialStatusInput = {
  /** When false, omit Inventory chip (tab may still exist elsewhere). */
  showInventory?: boolean;
  eventInventory: { status: EventInventoryStatus } | null;
  clientChoices: ReadonlyArray<Pick<ClientChoices, "status">>;
  eventOrder: {
    status: EventOrderStatus;
    sharedAt: string | null;
  } | null;
  /** All event invoices; EO-linked preferred for finance chips. */
  invoices: ReadonlyArray<Pick<Invoice, "id" | "status" | "eventOrderId">>;
  eventOrderId: string | null;
  linkedScheduleId: string | null;
  bookingCommitmentInvoiceIds?: ReadonlyArray<string>;
};

const INV_STATUS_LABEL: Record<EventInventoryStatus, string> = {
  draft: "Draft",
  shared: "Awaiting client",
  submitted: "Needs venue review",
  changes_requested: "Awaiting client",
  confirmed: "Confirmed",
  finalized: "Finalized",
};

function pickPrimaryChoicesStatus(
  rows: ReadonlyArray<Pick<ClientChoices, "status">>,
): string | null {
  if (rows.length === 0) return null;
  const priority = [
    "submitted",
    "resubmitted",
    "changes_requested",
    "sent",
    "in_progress",
    "draft",
    "finalized",
  ] as const;
  for (const s of priority) {
    if (rows.some((r) => r.status === s)) return s;
  }
  return rows[0]!.status;
}

function pickEoLinkedInvoice(
  invoices: CommercialStatusInput["invoices"],
  eventOrderId: string | null,
  commitmentIds: ReadonlyArray<string>,
): CommercialStatusInput["invoices"][number] | null {
  if (!eventOrderId) return null;
  const commitment = new Set(commitmentIds);
  const linked = invoices.filter(
    (inv) => inv.eventOrderId === eventOrderId && inv.status !== "void" && !commitment.has(inv.id),
  );
  if (linked.length === 0) return null;
  return (
    linked.find((i) => i.status === "draft")
    ?? linked.find((i) => i.status === "sent" || i.status === "partially_paid")
    ?? linked.find((i) => i.status === "paid")
    ?? linked[0]!
  );
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially paid",
  paid: "Paid",
  void: "Void",
};

/**
 * Build status chips from already-loaded event props.
 * Omits payment-plan chip when no schedule and no EO-linked invoice (cannot invent).
 */
export function buildCommercialStatusChips(input: CommercialStatusInput): CommercialStatusChip[] {
  const chips: CommercialStatusChip[] = [];
  const showInventory = input.showInventory !== false;

  if (showInventory) {
    chips.push({
      id: "inventory",
      label: "Inventory",
      status: input.eventInventory
        ? INV_STATUS_LABEL[input.eventInventory.status] ?? input.eventInventory.status
        : "Not started",
      nav: { kind: "tab", tab: "inventory" },
    });
  }

  const choiceStatus = pickPrimaryChoicesStatus(input.clientChoices);
  chips.push({
    id: "choices",
    label: "Choices",
    status: choiceStatus
      ? clientChoicesDisplayLabel(choiceStatus)
      : "Not started",
    nav: { kind: "tab", tab: "event-order", anchor: "event-order-choices" },
  });

  let eoStatus = "Not started";
  if (input.eventOrder) {
    // Share requires finalize in product — still distinguish sharedAt from finalize alone.
    if (input.eventOrder.sharedAt) {
      eoStatus = "Shared";
    } else if (input.eventOrder.status === "finalized") {
      eoStatus = "Finalized — not shared";
    } else {
      eoStatus = "Draft";
    }
  }
  chips.push({
    id: "event_order",
    label: "Event Order",
    status: eoStatus,
    nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
  });

  const linked = pickEoLinkedInvoice(
    input.invoices,
    input.eventOrderId,
    input.bookingCommitmentInvoiceIds ?? [],
  );
  chips.push({
    id: "invoice",
    label: "Invoice",
    status: linked
      ? (INVOICE_STATUS_LABEL[linked.status] ?? linked.status)
      : "Not created",
    nav: linked
      ? { kind: "href", href: `/invoices/${linked.id}` }
      : { kind: "tab", tab: "event-order", anchor: "event-order-invoice" },
  });

  if (input.linkedScheduleId) {
    chips.push({
      id: "payment_plan",
      label: "Payment plan",
      status: "Created",
      nav: { kind: "href", href: `/payments/${input.linkedScheduleId}` },
    });
  } else if (linked) {
    chips.push({
      id: "payment_plan",
      label: "Payment plan",
      status: "Not created",
      nav: { kind: "href", href: `/invoices/${linked.id}` },
    });
  }
  // If no EO-linked invoice, omit payment-plan chip (cannot invent a plan path).

  return chips;
}

/** Test helper — display status used for choices aggregation. */
export function commercialChoicesDisplayKey(
  rows: ReadonlyArray<Pick<ClientChoices, "status">>,
): ReturnType<typeof toClientChoicesDisplayStatus> | "none" {
  const s = pickPrimaryChoicesStatus(rows);
  if (!s) return "none";
  return toClientChoicesDisplayStatus(s);
}
