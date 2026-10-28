/**
 * Stage 0 — Event Order journey facts (presentation only).
 * Mirrors Booking Details / CommercialFacts grammar: status + meaningful next action.
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
  /** Always a meaningful workflow label — never generic "View". */
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
  /** True when live EO lines differ from the last share snapshot (couple still sees older Order). */
  shareCommitmentStale?: boolean;
  /** Unbilled billable amount on the Event Order after prior EO invoices. */
  unbilledAmount?: number;
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

/**
 * Prefer EO invoice strip over Choices FinancialImpact when an EO-linked invoice
 * exists — unless unbilled billable charges need "Invoice new charges".
 */
export function shouldShowChoicesFinancialImpact(
  hasEoInvoice: boolean,
  unbilledAmount = 0,
): boolean {
  if (unbilledAmount > 0) return true;
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
        "Choose an Event Order template, review the full offering in the preview, then send a selection request.",
      primaryLabel: "Build selections",
    };
  }
  if (choices.some((c) => isClientChoicesNeedsVenueReview(c.status))) {
    return {
      state: "Couple submitted — venue to review",
      detail:
        "Review their selections, then apply them to the Event Order. Fixed and included offerings stay as authored.",
      primaryLabel: "Review selections",
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
        "Waiting on the couple. Resend the selection request, or open selections below to remind in the portal only.",
      primaryLabel: "Resend selection request",
    };
  }
  const draft = choices.find((c) => c.status === "draft");
  if (draft) {
    return {
      state: "Draft — not sent yet",
      detail:
        "Preview the complete client-facing request, then send a secure portal link. Sending does not finalize the Event Order or create an invoice.",
      primaryLabel: "Send selection request",
    };
  }
  if (choices.every((c) => c.status === "finalized")) {
    return {
      state: "Applied to Event Order",
      detail: "Selections are locked into the Event Order. Continue with review and finalization below.",
      primaryLabel: "Open selections",
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
        "After the couple submits, review selections and create the Event Order. You can also author fixed lines on the Event Order panel.",
      primaryLabel: "Review Event Order",
    };
  }
  const status = input.eventOrder.status ?? "draft";
  const stale = Boolean(input.shareCommitmentStale && input.eventOrder.sharedAt);
  const unbilled = input.unbilledAmount ?? 0;

  if (stale) {
    return {
      state: status === "finalized" ? "Finalized · shared copy is outdated" : "Open · shared copy is outdated",
      detail:
        "The couple still sees the last shared Event Order, which no longer matches these lines. Re-share so their view matches before they accept or before you issue the original invoice.",
      primaryLabel: "Re-share Event Order",
    };
  }

  if (status === "finalized") {
    return {
      state: input.eventOrder.sharedAt ? "Finalized · shared with couple" : "Finalized",
      detail:
        "Agreed billable lines are the authoritative record. Sharing with the couple is optional and separate from invoicing — Accept on the portal is acknowledgment of this delivery list, not a legal e-signature or Contracts module signing.",
      primaryLabel: "Review Event Order",
    };
  }

  // Reopened after invoice: do not present initial finalize as the unfinished next step.
  if (input.hasEoInvoice) {
    if (unbilled > 0) {
      return {
        state: "Open for additional charges",
        detail:
          "An Event Order invoice was already issued. Review new billable lines, then Invoice new charges. Re-finalize and re-share only if the couple should see an updated delivery list.",
        primaryLabel: "Review Event Order",
      };
    }
    return {
      state: "Open · invoice already issued",
      detail:
        "This Event Order was reopened after invoicing. Finalize again only when you intend a new shared snapshot for the couple — payment lives on the invoice(s).",
      primaryLabel: "Review Event Order",
    };
  }

  return {
    state: status === "draft" ? "Draft — needs review" : status === "open" ? "Open — needs finalize" : status,
    detail:
      "Review selected options, quantities, included lines, and totals, then finalize. Finalizing does not change booking status.",
    primaryLabel: "Review Event Order",
  };
}

function invoiceState(input: EventOrderJourneyInput): {
  state: string;
  detail: string;
  primaryLabel: string | null;
} {
  const unbilled = input.unbilledAmount ?? 0;
  if (input.hasEoInvoice) {
    const status = input.eoInvoiceStatus ?? "linked";
    if (unbilled > 0) {
      return {
        state: `Invoice · ${status} · new charges`,
        detail:
          "Earlier invoices and their payment plans stay as issued. Invoice new charges for unbilled Event Order lines only — a second plan is not created automatically.",
        primaryLabel: "Invoice new charges",
      };
    }
    return {
      state: `Invoice · ${status}`,
      detail:
        "Amount due lives on each Event Order–linked invoice and its own payment plan (if any). Incremental invoices do not inherit the original plan.",
      primaryLabel: "Open invoice & payment plan",
    };
  }
  if (input.shareCommitmentStale && input.eventOrder?.sharedAt) {
    return {
      state: "Re-share before invoicing",
      detail:
        "Create the invoice only after the shared Event Order matches the lines you intend to bill — or the couple will see a different Order than the invoice.",
      primaryLabel: "Re-share Event Order",
    };
  }
  if (input.eventOrder?.status === "finalized" || input.eventOrder?.sharedAt) {
    return {
      state: "Ready to invoice",
      detail:
        "Create the invoice and payment plan from the finalized Event Order’s billable lines. Portal Accept and Contracts signing are separate and not required for this invoice step.",
      primaryLabel: "Create invoice & payment plan",
    };
  }
  return {
    state: "Waiting on Event Order",
    detail:
      "Invoice and payment plan follow the finalized Event Order — not Inventory and not automatic on selection submit.",
    primaryLabel: "Invoice & payments",
  };
}

/**
 * Three persistent journey rows (Booking Details style). Exactly one isCurrent.
 * Every row keeps a meaningful action label (CommercialFacts pattern) — never "View".
 */
export function describeEventOrderJourney(input: EventOrderJourneyInput): {
  currentStep: CommercialWorkflowStepId;
  rows: EventOrderJourneyRow[];
} {
  const currentStep = resolveCommercialWorkflowStep({
    choices: [...input.choices],
    eventOrder: input.eventOrder,
    hasEoInvoice: input.hasEoInvoice,
    shareCommitmentStale: input.shareCommitmentStale,
    unbilledAmount: input.unbilledAmount,
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
      primaryLabel: sel.primaryLabel,
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-choices" },
    },
    {
      key: "event_order",
      title: "Event Order",
      state: eo.state,
      detail: eo.detail,
      isCurrent: currentKey === "event_order",
      primaryLabel: eo.primaryLabel,
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-order" },
    },
    {
      key: "invoice",
      title: "Invoice & payments",
      state: inv.state,
      detail: inv.detail,
      isCurrent: currentKey === "invoice",
      primaryLabel: inv.primaryLabel,
      nav: { kind: "tab", tab: "event-order", anchor: "event-order-invoice" },
    },
  ];

  return { currentStep, rows };
}
