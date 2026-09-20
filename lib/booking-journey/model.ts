/**
 * Booking Journey — derived presentation model.
 * Stages are projected from underlying records; not a manually editable status enum.
 */

import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { remainingAmount, SELECTION_STATUS_LABEL } from "@/lib/commercial-selections/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import type { ContractStatus } from "@/lib/contracts/types";
import type { PaymentItemStatus, PaymentObligationKind } from "@/lib/payments/types";
import {
  DEFAULT_COMMERCIAL_BOOKING_PREFS,
  type VenueCommercialBookingPrefs,
} from "@/lib/booking-journey/venue-prefs";

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
  contract: JourneyContract | null;
  isCommerciallyBooked: boolean;
  packageSummary: string | null;
  depositSummary: string | null;
  remainingSummary: string | null;
  prefs: VenueCommercialBookingPrefs;
  paymentLines: JourneyPaymentLine[];
};

export type JourneyContract = {
  id: string;
  status: ContractStatus;
  /** Signer progress for display only. Booking still keys off status === "signed". */
  venueSigned?: boolean;
  requiredClientTotal?: number;
  requiredClientSigned?: number;
};

export type JourneyPaymentLine = {
  id?: string;
  scheduleId?: string;
  obligationKind: PaymentObligationKind | null;
  status: PaymentItemStatus;
  amount: number;
  dueDate?: string | null;
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
  /** Venue commercial booking preferences (defaults applied when omitted). */
  prefs?: VenueCommercialBookingPrefs | null;
};

/**
 * Agreement is complete when the venue's method is satisfied.
 * "contract" requires a signed contract — an accepted proposal is not enough.
 * "offer" and "either" still treat an accepted proposal or a signed contract as agreement.
 */
function agreementComplete(
  selection: CommercialSelection | null,
  contract: JourneyContract | null,
  prefs?: VenueCommercialBookingPrefs | null,
): boolean {
  const method = (prefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS).agreementMethod;
  const contractSigned = contract?.status === "signed";
  if (method === "contract") return contractSigned;
  if (selection?.status === "accepted") return true;
  return contractSigned;
}

function depositPaid(lines: JourneyPaymentLine[]): boolean {
  return lines.some((l) => l.obligationKind === "deposit" && l.status === "paid");
}

function depositExists(lines: JourneyPaymentLine[]): boolean {
  return lines.some((l) => l.obligationKind === "deposit" && l.status !== "cancelled");
}

function findDepositLine(lines: JourneyPaymentLine[]): JourneyPaymentLine | null {
  return lines.find((l) => l.obligationKind === "deposit" && l.status !== "cancelled") ?? null;
}

/**
 * Initial payment condition for commercial Booked.
 * Respects venue prefs and zero-deposit commitments.
 */
export function initialPaymentSatisfied(input: {
  selection: CommercialSelection | null;
  paymentLines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): boolean {
  const prefs = input.prefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
  if (!prefs.initialPaymentRequired) return true;

  const hasUnpaidDeposit = input.paymentLines.some(
    (l) => l.obligationKind === "deposit" && l.status !== "cancelled" && l.status !== "paid",
  );
  if (hasUnpaidDeposit) return false;
  if (depositPaid(input.paymentLines)) return true;

  // Commitment explicitly requires $0 deposit — nothing to collect.
  if (input.selection != null && input.selection.depositAmount <= 0) return true;

  // Payment required but deposit not paid (and either not set up, or selection unknown).
  return false;
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

function stageLabels(
  processOrder: VenueCommercialBookingPrefs["processOrder"],
  initialPaymentRequired: boolean,
): {
  key: JourneyStageKey;
  label: string;
}[] {
  if (!initialPaymentRequired) {
    return [
      { key: "package", label: "Package" },
      { key: "agreement", label: "Agreement" },
      { key: "booked", label: "Booked" },
      { key: "planning", label: "Planning" },
    ];
  }
  if (processOrder === "deposit_first") {
    return [
      { key: "package", label: "Package" },
      { key: "deposit", label: "Deposit" },
      { key: "agreement", label: "Agreement" },
      { key: "booked", label: "Booked" },
      { key: "planning", label: "Planning" },
    ];
  }
  return [
    { key: "package", label: "Package" },
    { key: "agreement", label: "Agreement" },
    { key: "deposit", label: "Deposit" },
    { key: "booked", label: "Booked" },
    { key: "planning", label: "Planning" },
  ];
}

/**
 * Venue-facing commercial Booked = agreement executed + initial payment satisfied
 * (per venue prefs). Independent of sales_stage / lifecycle / reporting labels.
 */
export function isCommerciallyBooked(input: {
  selection: CommercialSelection | null;
  contract: JourneyContract | null;
  paymentLines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): boolean {
  return (
    agreementComplete(input.selection, input.contract, input.prefs)
    && initialPaymentSatisfied({
      selection: input.selection,
      paymentLines: input.paymentLines,
      prefs: input.prefs,
    })
  );
}

export function buildBookingJourney(input: JourneyInputs): BookingJourneyModel {
  const prefs = input.prefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
  const selection = input.selection && input.selection.status !== "superseded" ? input.selection : null;
  const hasPackage = !!selection;
  const agreementDone = agreementComplete(selection, input.contract, prefs);
  const paymentDone = initialPaymentSatisfied({
    selection,
    paymentLines: input.paymentLines,
    prefs,
  });
  const commerciallyBooked = agreementDone && paymentDone;
  const planningDone = commerciallyBooked && input.planningStarted;
  const depositFirst = prefs.processOrder === "deposit_first";
  const depositLine = findDepositLine(input.paymentLines);
  const needsPaymentSetup = prefs.initialPaymentRequired
    && (selection?.depositAmount ?? 0) > 0
    && !depositExists(input.paymentLines);

  let currentKey: JourneyStageKey = "package";
  if (!hasPackage) {
    currentKey = "package";
  } else if (depositFirst) {
    if (!paymentDone) currentKey = "deposit";
    else if (!agreementDone) currentKey = "agreement";
    else if (!planningDone) currentKey = "booked";
    else currentKey = "planning";
  } else if (!agreementDone) {
    currentKey = "agreement";
  } else if (!paymentDone) {
    currentKey = "deposit";
  } else if (!planningDone) {
    currentKey = "booked";
  } else {
    currentKey = "planning";
  }

  const labels = stageLabels(prefs.processOrder, prefs.initialPaymentRequired);
  const stages: JourneyStage[] = labels.map(({ key, label }) => {
    let state: JourneyStageState = "upcoming";
    const complete =
      (key === "package" && hasPackage)
      || (key === "agreement" && agreementDone)
      || (key === "deposit" && paymentDone)
      || (key === "booked" && commerciallyBooked)
      || (key === "planning" && planningDone);
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

  const allowOffer = prefs.agreementMethod === "offer" || prefs.agreementMethod === "either";
  const allowContract = prefs.agreementMethod === "contract" || prefs.agreementMethod === "either";

  if (!hasPackage) {
    direction = "Choose what they bought.";
    primaryLabel = "Select package";
    primaryAction = "select_package";
  } else if (currentKey === "deposit" && !paymentDone) {
    if (depositExists(input.paymentLines) && depositLine?.status !== "paid") {
      const amt = selection!.depositAmount;
      direction = `Waiting for the ${formatCurrency(amt)} deposit. They are not Booked until it is paid${
        agreementDone ? "" : " and the agreement is complete"
      }. ${formatCurrency(remaining!)} will remain.`;
      primaryLabel = "Open invoice";
      primaryHref = selection?.invoiceId
        ? `/invoices/${selection.invoiceId}`
        : paymentsHref(input, selection);
      primaryAction = null;
      if (prefs.paymentCollection !== "online") {
        secondaryLabel = "Record deposit received";
        secondaryAction = "record_deposit";
      }
    } else if (needsPaymentSetup || !depositExists(input.paymentLines)) {
      const depositAmt = selection!.depositAmount;
      if (depositFirst && !agreementDone) {
        direction = `Collect the ${formatCurrency(depositAmt)} deposit for ${selection!.name} — ${formatCurrency(selection!.totalAmount)}. Agreement comes next.`;
      } else {
        const agreementLine = selection?.status === "accepted"
          ? `They accepted the proposal. Collect the ${formatCurrency(depositAmt)} deposit to confirm the booking.`
          : `The agreement is complete for ${selection!.name} — ${formatCurrency(selection!.totalAmount)}. Collect the ${formatCurrency(depositAmt)} deposit to confirm the booking.`;
        direction = `${agreementLine} ${formatCurrency(remaining!)} will remain on the payment plan.`;
      }
      primaryLabel = "Set up payments";
      primaryHref = paymentsHref(input, selection);
      primaryAction = "setup_payments";
    }
  } else if (currentKey === "agreement" && !agreementDone) {
    if (input.contract?.status === "sent") {
      direction = "Contract sent to the client — waiting for their signature. The venue signs after the client.";
      if (prefs.initialPaymentRequired && !paymentDone) {
        direction += " Collect the deposit after they sign to confirm the booking.";
      }
      primaryLabel = "Open contract";
      primaryHref = `/contracts/${input.contract.id}`;
      primaryAction = null;
    } else if (input.contract?.status === "draft") {
      direction = "Contract is a draft. It has not been sent. Open it to preview, then send to the client.";
      primaryLabel = "Open contract";
      primaryHref = `/contracts/${input.contract.id}`;
      primaryAction = null;
    } else if (selection!.status === "accepted" && prefs.agreementMethod === "contract") {
      direction = "They accepted the proposal. This venue still requires a signed contract. The proposal is not a contract, and they are not booked.";
      if (input.contract) {
        primaryLabel = "Open contract";
        primaryHref = `/contracts/${input.contract.id}`;
        primaryAction = null;
      } else {
        primaryLabel = "Create contract";
        primaryAction = "create_contract";
        primaryHref = contractNewHref(input, selection!);
      }
    } else if (selection!.status === "offered") {
      direction = "Share link created — not emailed. Waiting for them to accept.";
      if (prefs.initialPaymentRequired && !paymentDone) {
        direction += " After they accept, collect the deposit to confirm the booking.";
      }
      primaryLabel = "Copy share link";
      primaryAction = "copy_share_link";
      secondaryLabel = "Mark accepted";
      secondaryAction = "mark_accepted";
    } else {
      if (allowOffer && allowContract) {
        direction = depositFirst && paymentDone
          ? "Deposit is in. Create a share link or a contract. A share link is not an email."
          : "Create a share link so they can accept this package, or create a contract from this package. A share link is not an email.";
        primaryLabel = "Create share link";
        primaryAction = "send_offer";
        secondaryLabel = "Create contract";
        secondaryAction = "create_contract";
        secondaryHref = contractNewHref(input, selection!);
      } else if (allowContract) {
        direction = depositFirst && paymentDone
          ? "Deposit is in. Create and send the contract to finish the agreement."
          : "Create a contract from this package. After they sign, you'll finish booking.";
        primaryLabel = "Create contract";
        primaryAction = "create_contract";
        primaryHref = contractNewHref(input, selection!);
      } else {
        direction = depositFirst && paymentDone
          ? "Deposit is in. Create a share link so they can accept this package. The link is not an email."
          : "Create a share link so they can accept this package. Creating the link does not email it.";
        primaryLabel = "Create share link";
        primaryAction = "send_offer";
      }
      if (!prefs.initialPaymentRequired) {
        direction += " No deposit is required to book.";
      }
    }
  } else if (!planningDone) {
    const paidNote = prefs.initialPaymentRequired && (selection?.depositAmount ?? 0) > 0
      ? `${formatCurrency(selection!.depositAmount)} paid. `
      : "";
    const remainNote = prefs.initialPaymentRequired && remaining != null
      ? `${formatCurrency(remaining)} remains on the payment plan. `
      : "";
    direction = `They're Booked. ${paidNote}${remainNote}Invite them to the portal and start planning when you're ready — optional if they won't use planning.`;
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
    contract: input.contract,
    isCommerciallyBooked: commerciallyBooked,
    packageSummary: selection
      ? `${selection.name} · ${formatCurrency(selection.totalAmount)}`
      : null,
    depositSummary: prefs.initialPaymentRequired && selection
      ? formatCurrency(selection.depositAmount)
      : null,
    remainingSummary: prefs.initialPaymentRequired && remaining != null
      ? formatCurrency(remaining)
      : null,
    prefs,
    paymentLines: input.paymentLines,
  };
}

export function selectionStatusLabel(status: string): string {
  return SELECTION_STATUS_LABEL[status] ?? status;
}
