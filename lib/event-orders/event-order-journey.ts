/**
 * Event Order journey rows — same grammar as the lead card's Booking Details
 * (package → proposal → contract → invoice → payment plan): each row has a
 * status, one action, and the current row is the next step.
 * Presentation only; does not mutate commercial state.
 */
import {
  isClientChoicesNeedsVenueReview,
} from "@/lib/client-choices/constants";
import type { CommercialWorkflowStepId } from "@/lib/event-orders/commercial-workflow-step";
import type { CommercialNavTarget } from "@/lib/event-orders/commercial-status";

export type EventOrderJourneyRowKey = "event_order" | "approval" | "invoice" | "payment_plan";

export type EventOrderJourneyAction =
  | "build"
  | "send"
  | "resend"
  | "copy_link"
  | "review_choices"
  | "invoice_new_charges"
  | "open_invoice"
  | "create_payment_plan"
  | "open_payment_plan";

export type EventOrderJourneyRow = {
  key: EventOrderJourneyRowKey;
  title: string;
  state: string;
  detail: string;
  /** True for the one row that owns the next step. */
  isCurrent: boolean;
  /** Always a meaningful workflow label — never generic "View". */
  primaryLabel: string | null;
  action: EventOrderJourneyAction | null;
  /** Show the couple-view Preview beside this row's action. */
  preview: boolean;
  nav: CommercialNavTarget;
};

export type EventOrderJourneyInput = {
  choices: ReadonlyArray<{ status: string }>;
  eventOrder: {
    status?: string | null;
    sharedAt?: string | Date | null;
    clientAgreedAt?: string | null;
    clientAgreedRevision?: number | null;
    revision?: number | null;
  } | null;
  hasEoInvoice: boolean;
  eoInvoiceStatus?: string | null;
  /** True when live EO lines differ from the last share snapshot (couple still sees older Order). */
  shareCommitmentStale?: boolean;
  /** Unbilled billable amount on the Event Order after prior EO invoices. */
  unbilledAmount?: number;
  /** A payment plan exists for the Event Order invoice. */
  hasPaymentPlan?: boolean;
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

function shortDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Couple approved the copy they are looking at (reopen clears approval). */
export function isEventOrderApprovedNow(eventOrder: EventOrderJourneyInput["eventOrder"], stale = false): boolean {
  if (!eventOrder?.clientAgreedAt || eventOrder.status !== "finalized" || stale) return false;
  if (eventOrder.clientAgreedRevision == null || eventOrder.revision == null) return true;
  return eventOrder.clientAgreedRevision === eventOrder.revision;
}

type RowFacts = Omit<EventOrderJourneyRow, "key" | "title" | "isCurrent" | "nav"> & { needsVenue: boolean };

const ORDER_NAV: CommercialNavTarget = { kind: "tab", tab: "event-order", anchor: "event-order-order" };
const CHOICES_NAV: CommercialNavTarget = { kind: "tab", tab: "event-order", anchor: "event-order-choices" };
const INVOICE_NAV: CommercialNavTarget = { kind: "tab", tab: "event-order", anchor: "event-order-invoice" };

function eventOrderRow(input: EventOrderJourneyInput): RowFacts {
  const eo = input.eventOrder;
  if (!eo) {
    return {
      state: "Not started",
      detail: "Pick a template or start blank below. The couple sees nothing until you send it.",
      primaryLabel: "Build Event Order",
      action: "build",
      preview: false,
      needsVenue: true,
    };
  }
  if (!eo.sharedAt) {
    return {
      state: "Draft — not sent yet",
      detail: "Preview exactly what the couple will see, then send. Sending locks this version and emails them one link.",
      primaryLabel: "Send to couple",
      action: "send",
      preview: true,
      needsVenue: true,
    };
  }
  if (eo.status !== "finalized" || input.shareCommitmentStale) {
    return {
      state: "Changed since you sent it",
      detail: `The couple still sees the copy from ${shortDate(eo.sharedAt)}. Sending the update asks them to approve again.`,
      primaryLabel: "Send updated copy",
      action: "resend",
      preview: true,
      needsVenue: true,
    };
  }
  return {
    state: `Sent ${shortDate(eo.sharedAt)}`,
    detail: "To change it, reopen the Event Order below, edit, then send the updated copy.",
    primaryLabel: "Copy couple link",
    action: "copy_link",
    preview: true,
    needsVenue: false,
  };
}

function approvalRow(input: EventOrderJourneyInput): RowFacts {
  const eo = input.eventOrder;
  const stale = Boolean(input.shareCommitmentStale);
  if (!eo?.sharedAt) {
    return {
      state: "Not sent yet",
      detail: "The couple makes their choices and approves on their Event Order link — no portal invite needed.",
      primaryLabel: null,
      action: null,
      preview: false,
      needsVenue: false,
    };
  }
  if (isEventOrderApprovedNow(eo, stale)) {
    return {
      state: `Approved ${shortDate(eo.clientAgreedAt)}`,
      detail: "Their choices are on the Event Order. It stays in their Documents.",
      primaryLabel: null,
      action: null,
      preview: false,
      needsVenue: false,
    };
  }
  if (eo.status !== "finalized" || stale) {
    return {
      state: "Approval needed again",
      detail: "You changed the Event Order. Send the updated copy and the couple approves again.",
      primaryLabel: null,
      action: null,
      preview: false,
      needsVenue: false,
    };
  }
  if (input.choices.some((c) => isClientChoicesNeedsVenueReview(c.status))) {
    return {
      state: "Choices submitted in the portal",
      detail: "Review and apply their choices below. They can then approve on their link.",
      primaryLabel: "Review choices",
      action: "review_choices",
      preview: false,
      needsVenue: true,
    };
  }
  return {
    state: "Waiting on couple",
    detail: "They choose in each section and approve on one page. Their picks save as they go.",
    primaryLabel: "Copy couple link",
    action: "copy_link",
    preview: false,
    needsVenue: false,
  };
}

function invoiceRow(input: EventOrderJourneyInput): RowFacts {
  const unbilledAmount = input.unbilledAmount ?? 0;
  if (unbilledAmount > 0) {
    return {
      state: `${money(unbilledAmount)} not invoiced yet`,
      detail: "Creates a draft for the new charges only. The signed contract and deposit stay as they are. Nothing is sent until you send it.",
      primaryLabel: "Invoice new charges",
      action: "invoice_new_charges",
      preview: false,
      needsVenue: true,
    };
  }
  if (input.hasEoInvoice) {
    return {
      state: `Invoiced · ${input.eoInvoiceStatus ?? "linked"}`,
      detail: "Earlier invoices and their payment plans stay as issued.",
      primaryLabel: "Open invoice",
      action: "open_invoice",
      preview: false,
      needsVenue: false,
    };
  }
  return {
    state: "No new charges",
    detail: "Extras the couple picks show here after they approve. Nothing is invoiced automatically.",
    primaryLabel: null,
    action: null,
    preview: false,
    needsVenue: false,
  };
}

function paymentPlanRow(input: EventOrderJourneyInput): RowFacts {
  if (input.hasPaymentPlan) {
    return {
      state: "Set up",
      detail: "Payments for the new charges invoice.",
      primaryLabel: "Open payment plan",
      action: "open_payment_plan",
      preview: false,
      needsVenue: false,
    };
  }
  if (input.hasEoInvoice) {
    return {
      state: "Not set up",
      detail: "Optional — split the new charges invoice into payments.",
      primaryLabel: "Create payment plan",
      action: "create_payment_plan",
      preview: false,
      needsVenue: false,
    };
  }
  return {
    state: "Not needed yet",
    detail: "Follows the new charges invoice. A second plan is never created automatically.",
    primaryLabel: null,
    action: null,
    preview: false,
    needsVenue: false,
  };
}

/**
 * Four persistent rows (lead card style). Exactly one isCurrent: the first row
 * that needs the venue, else the couple approval row.
 */
export function describeEventOrderJourney(input: EventOrderJourneyInput): {
  rows: EventOrderJourneyRow[];
  current: EventOrderJourneyRow;
} {
  const facts: Array<[EventOrderJourneyRowKey, string, RowFacts, CommercialNavTarget]> = [
    ["event_order", "Event Order", eventOrderRow(input), ORDER_NAV],
    ["approval", "Couple approval", approvalRow(input), CHOICES_NAV],
    ["invoice", "New charges invoice", invoiceRow(input), INVOICE_NAV],
    ["payment_plan", "Payment plan", paymentPlanRow(input), INVOICE_NAV],
  ];
  const currentKey = facts.find(([, , f]) => f.needsVenue)?.[0] ?? "approval";
  const rows = facts.map(([key, title, f, nav]) => ({
    key,
    title,
    state: f.state,
    detail: f.detail,
    isCurrent: key === currentKey,
    primaryLabel: f.primaryLabel,
    action: f.action,
    preview: f.preview,
    nav,
  }));
  return { rows, current: rows.find((r) => r.isCurrent)! };
}

/** One-line status for the Overview card (links into the Event Order tab). */
export function eventOrderOverviewSummary(input: EventOrderJourneyInput): string {
  const { current } = describeEventOrderJourney(input);
  return `${current.title}: ${current.state}`;
}
