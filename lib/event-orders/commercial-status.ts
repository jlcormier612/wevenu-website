/**
 * C3/C4 — Event commercial status strip (pure derivation).
 * Chips + checklist + deep-links only. No Share/Finalize/Send/Create actions.
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

/** C4 checklist milestones — AUDIT: draft → shared/selections → finalized → invoiced */
export type CommercialProgressStepId =
  | "draft"
  | "engagement"
  | "finalized"
  | "invoiced";

export type CommercialProgressStepState = "complete" | "current" | "upcoming";

export type CommercialProgressStep = {
  id: CommercialProgressStepId;
  label: string;
  state: CommercialProgressStepState;
  detail: string;
  nav: CommercialNavTarget;
};

export type CommercialNextAction = {
  label: string;
  nav: CommercialNavTarget;
};

const INV_CLIENT_FACING: ReadonlySet<EventInventoryStatus> = new Set([
  "shared",
  "submitted",
  "changes_requested",
  "confirmed",
  "finalized",
]);

const CHOICES_CLIENT_FACING = new Set([
  "sent",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "finalized",
]);

function hasSelectionActivity(input: CommercialStatusInput): boolean {
  if (input.eventInventory && INV_CLIENT_FACING.has(input.eventInventory.status)) return true;
  if (input.clientChoices.some((c) => CHOICES_CLIENT_FACING.has(c.status))) return true;
  if (input.clientChoices.some((c) => c.status === "draft")) return true;
  return false;
}

function invNeedsVenueOrClient(input: CommercialStatusInput): boolean {
  const s = input.eventInventory?.status;
  return s === "shared" || s === "submitted" || s === "changes_requested" || s === "confirmed";
}

function choiceNeedsVenueOrClient(choice: string | null): boolean {
  return (
    choice === "draft"
    || choice === "sent"
    || choice === "in_progress"
    || choice === "submitted"
    || choice === "resubmitted"
    || choice === "changes_requested"
  );
}

/**
 * C4 — Sequential commercial progress from existing statuses only.
 * Steps complete independently (Path A may finalize before share; share ≠ invoice).
 */
export function buildCommercialProgressSteps(
  input: CommercialStatusInput,
): CommercialProgressStep[] {
  const linked = pickEoLinkedInvoice(
    input.invoices,
    input.eventOrderId,
    input.bookingCommitmentInvoiceIds ?? [],
  );
  const hasDraftArtifact = Boolean(
    input.eventOrder || input.eventInventory || input.clientChoices.length > 0,
  );
  const sharedOrSelections = Boolean(
    input.eventOrder?.sharedAt
      || (input.eventInventory && INV_CLIENT_FACING.has(input.eventInventory.status))
      || input.clientChoices.some((c) => CHOICES_CLIENT_FACING.has(c.status)),
  );
  const eoFinalized = input.eventOrder?.status === "finalized";
  const invoiced = Boolean(linked);

  const draftComplete = hasDraftArtifact;
  const sharedComplete = sharedOrSelections;
  const finalizedComplete = Boolean(eoFinalized);
  const invoicedComplete = invoiced;

  // Current mirrors the next authoritative step (deep-link only) — not a gate.
  const choice = pickPrimaryChoicesStatus(input.clientChoices);
  let cursor: CommercialProgressStepId | null = null;
  if (!draftComplete) {
    cursor = "draft";
  } else if (
    invNeedsVenueOrClient(input)
    || choiceNeedsVenueOrClient(choice)
  ) {
    cursor = "engagement";
  } else if (input.eventOrder?.status === "open") {
    cursor = "finalized";
  } else if (input.eventOrder?.status === "finalized" && !input.eventOrder.sharedAt) {
    cursor = "engagement";
  } else if (!invoicedComplete) {
    cursor = "invoiced";
  }

  function stateFor(
    id: CommercialProgressStepId,
    complete: boolean,
  ): CommercialProgressStepState {
    if (complete) return "complete";
    return id === cursor ? "current" : "upcoming";
  }

  const selectionNote = hasSelectionActivity(input)
    ? "Selections (Inventory and/or Choices) are in play — keep those runtimes separate."
    : "Fixed Event Order path: no client selection required.";

  return [
    {
      id: "draft",
      label: "Draft",
      state: stateFor("draft", draftComplete),
      detail: draftComplete
        ? "Working commercial records exist on this event."
        : "Apply a template or start blank on Event Order / Inventory.",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    },
    {
      id: "engagement",
      label: "Shared / selections",
      state: stateFor("engagement", sharedComplete),
      detail: sharedComplete
        ? `Client engagement started. ${selectionNote}`
        : `Not shared and no client selection in flight. ${selectionNote}`,
      nav: hasSelectionActivity(input) && input.eventInventory && INV_CLIENT_FACING.has(input.eventInventory.status)
        ? { kind: "tab", tab: "inventory" }
        : input.clientChoices.some((c) => CHOICES_CLIENT_FACING.has(c.status) || c.status === "draft")
          ? { kind: "tab", tab: "event-order", anchor: "event-order-choices" }
          : { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    },
    {
      id: "finalized",
      label: "Finalized",
      state: stateFor("finalized", finalizedComplete),
      detail: finalizedComplete
        ? "Event Order is finalized (sharing is separate)."
        : "Finalize the Event Order when deliverables are agreed — not implied by template apply or client submit.",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    },
    {
      id: "invoiced",
      label: "Invoiced",
      state: stateFor("invoiced", invoicedComplete),
      detail: invoicedComplete
        ? `Invoice ${INVOICE_STATUS_LABEL[linked!.status] ?? linked!.status} (payment plan is a later step on the invoice).`
        : "Invoice is not created by sharing an Event Order — create or link from the Event Order below.",
      nav: linked
        ? { kind: "href", href: `/invoices/${linked.id}` }
        : { kind: "tab", tab: "event-order", anchor: "event-order-invoice" },
    },
  ];
}

/**
 * C4 — Next deep-link only (never a second Share/Finalize/Send control).
 * Points staff to the existing authoritative panel.
 */
export function buildCommercialNextAction(
  input: CommercialStatusInput,
): CommercialNextAction | null {
  const linked = pickEoLinkedInvoice(
    input.invoices,
    input.eventOrderId,
    input.bookingCommitmentInvoiceIds ?? [],
  );
  const inv = input.eventInventory?.status;
  const choice = pickPrimaryChoicesStatus(input.clientChoices);

  if (inv === "submitted") {
    return {
      label: "Review inventory submission on Inventory (confirm is not automatic)",
      nav: { kind: "tab", tab: "inventory" },
    };
  }
  if (inv === "shared" || inv === "changes_requested") {
    return {
      label: "Open Inventory — awaiting client selection",
      nav: { kind: "tab", tab: "inventory" },
    };
  }
  if (inv === "confirmed") {
    return {
      label: "Finalize inventory on Inventory, then Add to Event Order",
      nav: { kind: "tab", tab: "inventory" },
    };
  }
  if (choice === "submitted" || choice === "resubmitted") {
    return {
      label: "Review client choices below (finalize is a venue step)",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-choices" },
    };
  }
  if (choice === "sent" || choice === "in_progress" || choice === "changes_requested") {
    return {
      label: "Open Choices — awaiting client",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-choices" },
    };
  }
  if (choice === "draft") {
    return {
      label: "Send choices from Client selections below (not from Inventory)",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-choices" },
    };
  }
  if (!input.eventOrder) {
    return {
      label: "Start or apply an Event Order below (Library Use for fixed templates)",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    };
  }
  if (input.eventOrder.status === "open") {
    return {
      label: "Finalize Event Order below when agreed (Share stays separate)",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    };
  }
  if (input.eventOrder.status === "finalized" && !input.eventOrder.sharedAt) {
    return {
      label: "Share Event Order below — finalizing alone does not share",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    };
  }
  if (!linked) {
    return {
      label: "Create or link invoice from Event Order (not created by Share)",
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-invoice" },
    };
  }
  if (linked.status === "draft") {
    return {
      label: "Open invoice — send freezes billable lines",
      nav: { kind: "href", href: `/invoices/${linked.id}` },
    };
  }
  if (!input.linkedScheduleId) {
    return {
      label: "Payment plan attaches to the invoice (open invoice)",
      nav: { kind: "href", href: `/invoices/${linked.id}` },
    };
  }
  return null;
}
