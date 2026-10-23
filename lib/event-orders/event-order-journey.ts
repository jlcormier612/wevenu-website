/**
 * Stage 0 — Event Order journey facts (presentation only).
 * Mirrors Booking Details / CommercialFacts grammar: status + primary next step.
 * Does not mutate commercial state or invent parallel workflows.
 */
import {
  clientChoicesDisplayLabel,
  isClientChoicesNeedsVenueReview,
  toClientChoicesDisplayStatus,
} from "@/lib/client-choices/constants";
import {
  resolveCommercialWorkflowStep,
  type CommercialWorkflowStepId,
} from "@/lib/event-orders/commercial-workflow-step";
import type { CommercialNavTarget } from "@/lib/event-orders/commercial-status";

export type EventOrderJourneyRowKey = "selections" | "event_order" | "invoice";

export type EventOrderJourneyRow = {
  key: EventOrderJourneyRowKey;
  title: string;
  state: string;
  detail: string;
  /** True when this row owns the current stage primary action. */
  isCurrent: boolean;
  primaryLabel: string | null;
  nav: CommercialNavTarget;
};

export type EventOrderJourneyInput = {
  choices: ReadonlyArray<{ status: string }>;
  eventOrder: {
    status?: string | null;
    sharedAt?: string | Date | null;
    clientAgreedAt?: string | null;
  } | null;
  hasEoInvoice: boolean;
  eoInvoiceStatus?: string | null;
};

export function panelEmphasisForStep(step: CommercialWorkflowStepId): {
  emphasizeChoices: boolean;
  emphasizeOrder: boolean;
} {
  if (step === "build" || step === "awaiting" || step === "review") {
    return { emphasizeChoices: true, emphasizeOrder: false };
  }
  return { emphasizeChoices: false, emphasizeOrder: true };
}

/** Prefer EO invoice strip over Choices FinancialImpact when an EO-linked invoice exists. */
export function shouldShowChoicesFinancialImpact(hasEoInvoice: boolean): boolean {
  return !hasEoInvoice;
}

function selectionsState(choices: EventOrderJourneyInput["choices"]): {
  state: string;
  detail: string;
  primaryLabel: string | null;
} {
  if (choices.length === 0) {
    return {
      state: "Not started",
      detail:
        "Start a selectable packet when the couple should choose options, or add fixed lines on the Event Order.",
      primaryLabel: "Build selections",
    };
  }
  if (choices.some((c) => isClientChoicesNeedsVenueReview(c.status))) {
    return {
      state: "Couple submitted — venue to review",
      detail:
        "Review their selections, then Create or Update the Event Order from those picks. Fixed/included lines stay as authored.",
      primaryLabel: "Review submission",
    };
  }
  const awaiting = choices.find((c) => {
    const d = toClientChoicesDisplayStatus(c.status);
    return d === "awaiting_client" || d === "changes_requested";
  });
  if (awaiting) {
    return {
      state: clientChoicesDisplayLabel(awaiting.status),
      detail:
        "Waiting on the couple. Resend the selection request email, or open selections below to remind in the portal only.",
      primaryLabel: "Resend selection request",
    };
  }
  const draft = choices.find((c) => c.status === "draft");
  if (draft) {
    return {
      state: "Draft — not sent yet",
      detail:
        "Send a selection request to email a secure portal link. Make available in portal opens the task without email.",
      primaryLabel: "Send selection request",
    };
  }
  if (choices.every((c) => c.status === "finalized")) {
    return {
      state: "Applied to Event Order",
      detail: "Selections are locked into the Event Order. Continue with the document below.",
      primaryLabel: null,
    };
  }
  const first = choices[0]!;
  return {
    state: clientChoicesDisplayLabel(first.status),
    detail: "Continue with client selections for this event.",
    primaryLabel: "Open selections",
  };
}

function eventOrderState(input: EventOrderJourneyInput): {
  state: string;
  detail: string;
  primaryLabel: string | null;
} {
  if (!input.eventOrder) {
    return {
      state: "Not created yet",
      detail:
        "Create the Event Order from submitted selections, or author fixed lines on the Event Order panel.",
      primaryLabel: "Open Event Order",
    };
  }
  const status = input.eventOrder.status ?? "draft";
  if (input.eventOrder.sharedAt) {
    return {
      state: status === "finalized" ? "Shared with couple" : `Shared · ${status}`,
      detail:
        "Final Event Order was shared. Acceptance is optional per your venue rules and does not change booking status. Invoice lives on the Event Order–linked invoice.",
      primaryLabel: input.hasEoInvoice ? null : "Open Event Order",
    };
  }
  if (status === "finalized") {
    return {
      state: "Finalized — not shared yet",
      detail: "Share the final Event Order with the couple when ready. Sharing is separate from Create/Update from selections.",
      primaryLabel: "Share Event Order",
    };
  }
  return {
    state: status === "draft" ? "Draft" : status,
    detail:
      "Review lines, finalize the document if required, then share. Create/Update from selections, finalize, and share stay distinct.",
    primaryLabel: "Open Event Order",
  };
}

function invoiceState(input: EventOrderJourneyInput): {
  state: string;
  detail: string;
  primaryLabel: string | null;
} {
  if (input.hasEoInvoice) {
    return {
      state: input.eoInvoiceStatus ? `Invoice · ${input.eoInvoiceStatus}` : "Invoice linked",
      detail:
        "Amount due lives on the Event Order–linked invoice and its payment plan. Do not create a second invoice from selections alone.",
      primaryLabel: "Open invoice handoff",
    };
  }
  if (input.eventOrder?.sharedAt || input.eventOrder?.status === "finalized") {
    return {
      state: "Not invoiced yet",
      detail: "Create or open the Event Order–linked invoice from the Event Order panel when ready.",
      primaryLabel: "Open invoice handoff",
    };
  }
  return {
    state: "Waiting on Event Order",
    detail: "Invoice and payment plan follow the agreed Event Order — not Inventory and not automatic on selection apply.",
    primaryLabel: null,
  };
}

/**
 * Three persistent journey rows (Booking Details style). Exactly one isCurrent.
 */
export function describeEventOrderJourney(input: EventOrderJourneyInput): {
  currentStep: CommercialWorkflowStepId;
  rows: EventOrderJourneyRow[];
} {
  const currentStep = resolveCommercialWorkflowStep({
    choices: [...input.choices],
    eventOrder: input.eventOrder,
    hasEoInvoice: input.hasEoInvoice,
  });
  const sel = selectionsState(input.choices);
  const eo = eventOrderState(input);
  const inv = invoiceState(input);

  const currentKey: EventOrderJourneyRowKey =
    currentStep === "invoice"
      ? "invoice"
      : currentStep === "order"
        ? "event_order"
        : "selections";

  const rows: EventOrderJourneyRow[] = [
    {
      key: "selections",
      title: "Client selections",
      state: sel.state,
      detail: sel.detail,
      isCurrent: currentKey === "selections",
      primaryLabel: currentKey === "selections" ? sel.primaryLabel : null,
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-choices" },
    },
    {
      key: "event_order",
      title: "Event Order",
      state: eo.state,
      detail: eo.detail,
      isCurrent: currentKey === "event_order",
      primaryLabel: currentKey === "event_order" ? eo.primaryLabel : null,
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    },
    {
      key: "invoice",
      title: "Invoice & payments",
      state: inv.state,
      detail: inv.detail,
      isCurrent: currentKey === "invoice",
      primaryLabel: currentKey === "invoice" ? inv.primaryLabel : null,
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-invoice" },
    },
  ];

  return { currentStep, rows };
}
