/**
 * Booking Journey — derived presentation model.
 * Stages are projected from underlying records; not a manually editable status enum.
 */

import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { remainingAmount, SELECTION_STATUS_LABEL } from "@/lib/commercial-selections/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import type { ContractStatus } from "@/lib/contracts/types";
import type { PaymentItemStatus, PaymentObligationKind } from "@/lib/payments/types";

export type JourneyStageKey = "package" | "agreement" | "deposit" | "booked" | "planning";

export type JourneyStageState = "complete" | "current" | "upcoming";

export type JourneyStage = {
  key: JourneyStageKey;
  label: string;
  state: JourneyStageState;
};

export type BookingJourneyModel = {
  stages: JourneyStage[];
  currentKey: JourneyStageKey;
  direction: string;
  primaryLabel: string;
  primaryHref: string | null;
  primaryAction: string | null;
  secondaryLabel?: string;
  secondaryHref?: string | null;
  secondaryAction?: string | null;
  selection: CommercialSelection | null;
  isCommerciallyBooked: boolean;
  packageSummary: string | null;
  depositSummary: string | null;
  remainingSummary: string | null;
};

export type JourneyContract = {
  id: string;
  status: ContractStatus;
};

export type JourneyPaymentLine = {
  obligationKind: PaymentObligationKind | null;
  status: PaymentItemStatus;
  amount: number;
};

export type JourneyInputs = {
  leadId?: string | null;
  clientId?: string | null;
  eventId?: string | null;
  selection: CommercialSelection | null;
  /** Best contract for this client (prefer signed > sent > draft). */
  contract: JourneyContract | null;
  /** Payment lines on schedules for this client/event. */
  paymentLines: JourneyPaymentLine[];
  /** True when a portal invitation has been sent. */
  portalInvited: boolean;
  /** True when a planning playbook has been applied or released. */
  planningStarted: boolean;
};

const STAGE_LABELS: { key: JourneyStageKey; label: string }[] = [
  { key: "package", label: "Package" },
  { key: "agreement", label: "Agreement" },
  { key: "deposit", label: "Deposit" },
  { key: "booked", label: "Booked" },
  { key: "planning", label: "Planning" },
];

function agreementComplete(selection: CommercialSelection | null, contract: JourneyContract | null): boolean {
  if (selection?.status === "accepted") return true;
  if (contract?.status === "signed") return true;
  return false;
}

function depositPaid(lines: JourneyPaymentLine[]): boolean {
  return lines.some((l) => l.obligationKind === "deposit" && l.status === "paid");
}

function depositExists(lines: JourneyPaymentLine[]): boolean {
  return lines.some((l) => l.obligationKind === "deposit" && l.status !== "cancelled");
}

function bookingWorkspaceHref(input: JourneyInputs): string {
  if (input.clientId) return `/clients/${input.clientId}`;
  if (input.leadId) return `/leads/${input.leadId}`;
  return "/leads";
}

function paymentsHref(input: JourneyInputs, selection: CommercialSelection | null): string {
  const base = input.eventId
    ? `/events/${input.eventId}?tab=invoice`
    : input.clientId
      ? `/clients/${input.clientId}`
      : bookingWorkspaceHref(input);
  if (selection) return `${base}${base.includes("?") ? "&" : "?"}setupPayments=1&selectionId=${selection.id}`;
  return base;
}

function contractNewHref(input: JourneyInputs, selection: CommercialSelection): string {
  const params = new URLSearchParams();
  params.set("selectionId", selection.id);
  if (input.clientId) params.set("clientId", input.clientId);
  if (input.eventId) params.set("eventId", input.eventId);
  if (input.leadId) params.set("leadId", input.leadId);
  return `/contracts/new?${params.toString()}`;
}

/**
 * Venue-facing commercial Booked = agreement executed + deposit paid.
 * Independent of sales_stage / lifecycle / reporting labels.
 */
export function isCommerciallyBooked(input: {
  selection: CommercialSelection | null;
  contract: JourneyContract | null;
  paymentLines: JourneyPaymentLine[];
}): boolean {
  return agreementComplete(input.selection, input.contract) && depositPaid(input.paymentLines);
}

export function buildBookingJourney(input: JourneyInputs): BookingJourneyModel {
  const selection = input.selection && input.selection.status !== "superseded" ? input.selection : null;
  const hasPackage = !!selection;
  const agreementDone = agreementComplete(selection, input.contract);
  const depositDone = depositPaid(input.paymentLines);
  const commerciallyBooked = agreementDone && depositDone;
  const planningDone = commerciallyBooked && input.planningStarted;

  let currentKey: JourneyStageKey = "package";
  if (!hasPackage) currentKey = "package";
  else if (!agreementDone) currentKey = "agreement";
  else if (!depositDone) currentKey = "deposit";
  else if (!planningDone) currentKey = "booked";
  else currentKey = "planning";

  // When booked but planning not started, highlight Booked as current with planning CTAs.
  // When planning started, Booked is complete and Planning is current.
  const stages: JourneyStage[] = STAGE_LABELS.map(({ key, label }) => {
    let state: JourneyStageState = "upcoming";
    const complete =
      (key === "package" && hasPackage) ||
      (key === "agreement" && agreementDone) ||
      (key === "deposit" && depositDone) ||
      (key === "booked" && commerciallyBooked) ||
      (key === "planning" && planningDone);
    if (complete && key !== currentKey) state = "complete";
    else if (key === currentKey) state = "current";
    else if (complete) state = "complete";
    return { key, label, state };
  });

  const remaining = selection
    ? remainingAmount(selection.totalAmount, selection.depositAmount)
    : null;

  let direction = "Choose what they bought.";
  let primaryLabel = "Select package";
  let primaryHref: string | null = null;
  let primaryAction: string | null = "select_package";
  let secondaryLabel: string | undefined;
  let secondaryHref: string | undefined | null;
  let secondaryAction: string | undefined;

  if (!hasPackage) {
    direction = "Choose what they bought.";
    primaryLabel = "Select package";
    primaryAction = "select_package";
  } else if (!agreementDone) {
    if (input.contract?.status === "sent") {
      direction = "Contract sent — waiting for their signature. Collect the deposit after they sign to confirm the booking.";
      primaryLabel = "Open contract";
      primaryHref = `/contracts/${input.contract.id}`;
      primaryAction = null;
    } else if (input.contract?.status === "draft") {
      direction = "Create and send the contract. Sign as the venue, then release it to the couple.";
      primaryLabel = "Open contract";
      primaryHref = `/contracts/${input.contract.id}`;
      primaryAction = null;
    } else if (selection!.status === "offered") {
      direction = "Offer sent — waiting for them to accept. After they accept, collect the deposit to confirm the booking.";
      primaryLabel = "Remind couple";
      primaryAction = "remind_offer";
      secondaryLabel = "Mark accepted";
      secondaryAction = "mark_accepted";
    } else {
      direction =
        "Send an offer so they can accept this package, or create a contract from this package. After they accept or sign, you'll collect the deposit.";
      primaryLabel = "Send offer";
      primaryAction = "send_offer";
      secondaryLabel = "Create contract";
      secondaryAction = "create_contract";
      secondaryHref = contractNewHref(input, selection!);
    }
  } else if (!depositDone) {
    if (depositExists(input.paymentLines)) {
      direction = `The payment request is ready. Waiting for the ${formatCurrency(selection!.depositAmount)} deposit. They are not Booked until it is paid. ${formatCurrency(remaining!)} will remain.`;
      primaryLabel = "Open invoice";
      primaryHref = selection?.invoiceId
        ? `/invoices/${selection.invoiceId}`
        : paymentsHref(input, selection);
      primaryAction = null;
      secondaryLabel = "Record deposit paid";
      secondaryHref = selection?.invoiceId ? `/invoices/${selection.invoiceId}` : paymentsHref(input, selection);
    } else {
      const agreementLine = selection?.status === "accepted"
        ? `They accepted the offer. Collect the ${formatCurrency(selection!.depositAmount)} deposit to confirm the booking.`
        : `The agreement is complete for ${selection!.name} — ${formatCurrency(selection!.totalAmount)}. Collect the ${formatCurrency(selection!.depositAmount)} deposit to confirm the booking.`;
      direction = `${agreementLine} ${formatCurrency(remaining!)} will remain on the payment plan.`;
      primaryLabel = "Set up payments";
      primaryHref = paymentsHref(input, selection);
      primaryAction = "setup_payments";
    }
  } else if (!planningDone) {
    direction = `They're booked. ${formatCurrency(remaining ?? 0)} remains on the payment plan. Invite them to the portal and start planning when you're ready — optional if they won't use planning.`;
    primaryLabel = input.portalInvited ? "Start planning" : "Invite to portal";
    primaryHref = input.clientId
      ? input.portalInvited
        ? (input.eventId ? `/events/${input.eventId}` : `/clients/${input.clientId}`)
        : `/clients/${input.clientId}`
      : bookingWorkspaceHref(input);
    primaryAction = input.portalInvited ? "start_planning" : "invite_portal";
    secondaryLabel = "View payment plan";
    secondaryHref = paymentsHref(input, selection);
  } else {
    direction = "Planning is underway. Keep an eye on remaining payments.";
    primaryLabel = "Open booking";
    primaryHref = bookingWorkspaceHref(input);
    primaryAction = null;
  }

  return {
    stages,
    currentKey,
    direction,
    primaryLabel,
    primaryHref,
    primaryAction,
    secondaryLabel,
    secondaryHref,
    secondaryAction,
    selection,
    isCommerciallyBooked: commerciallyBooked,
    packageSummary: selection
      ? `${selection.name} · ${formatCurrency(selection.totalAmount)}`
      : null,
    depositSummary: selection ? formatCurrency(selection.depositAmount) : null,
    remainingSummary: remaining != null ? formatCurrency(remaining) : null,
  };
}

export function selectionStatusLabel(status: string): string {
  return SELECTION_STATUS_LABEL[status] ?? status;
}
