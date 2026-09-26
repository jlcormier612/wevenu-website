/**
 * Booking Journey — derived presentation model.
 * Stages are projected from underlying records; not a manually editable status enum.
 *
 * Booked is NOT derived here. Canonical Booked = bookClient → events.booked_at.
 */

import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { remainingAmount } from "@/lib/commercial-selections/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import type { ContractStatus } from "@/lib/contracts/types";
import type { PaymentItemStatus, PaymentObligationKind } from "@/lib/payments/types";
import type { CommercialProposalStatus } from "@/lib/commercial-proposals/types";
import {
  collectsInitialPayment,
  DEFAULT_COMMERCIAL_BOOKING_PREFS,
  type VenueCommercialBookingPrefs,
} from "@/lib/booking-journey/venue-prefs";

export type JourneyStageKey = "package" | "agreement" | "deposit" | "ready" | "planning";

export type JourneyStageState = "complete" | "current" | "upcoming";

export type JourneyStage = {
  key: JourneyStageKey;
  label: string;
  state: JourneyStageState;
};

/** Minimal L1 proposal surface for journey facts (actual commercial_proposals row). */
export type JourneyProposal = {
  id: string;
  status: CommercialProposalStatus;
  offeredAt: string | null;
  acceptToken: string | null;
  selectionId: string | null;
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
  /** Actual L1 commercial_proposals row when present — never a fake from Path B L2. */
  proposal: JourneyProposal | null;
  contract: JourneyContract | null;
  /**
   * Agreement (+ optional deposit setup) complete for commercial workflow UI.
   * NOT Booked. Booked is only bookClient / events.booked_at.
   */
  commercialReady: boolean;
  packageSummary: string | null;
  depositSummary: string | null;
  remainingSummary: string | null;
  prefs: VenueCommercialBookingPrefs;
  paymentLines: JourneyPaymentLine[];
  brand: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    neutralColor: string;
  };
  venueName: string | null;
};

export type JourneyContract = {
  id: string;
  status: ContractStatus;
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
  proposal?: JourneyProposal | null;
  contract: JourneyContract | null;
  paymentLines: JourneyPaymentLine[];
  portalInvited: boolean;
  planningStarted: boolean;
  prefs?: VenueCommercialBookingPrefs | null;
  brand?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    neutralColor: string;
  } | null;
  venueName?: string | null;
};

/**
 * Agreement is complete when the venue's method is satisfied.
 * "contract" requires a signed contract — an accepted selection is not enough.
 * "offer" and "either" treat an accepted selection or a signed contract as agreement.
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
 * Initial payment condition for commercial workflow progress (not Booked).
 * Respects venue payment defaults and zero-deposit commitments.
 */
export function initialPaymentSatisfied(input: {
  selection: CommercialSelection | null;
  paymentLines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): boolean {
  const prefs = input.prefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
  if (!collectsInitialPayment(prefs)) return true;

  const hasUnpaidDeposit = input.paymentLines.some(
    (l) => l.obligationKind === "deposit" && l.status !== "cancelled" && l.status !== "paid",
  );
  if (hasUnpaidDeposit) return false;
  if (depositPaid(input.paymentLines)) return true;

  if (input.selection != null && input.selection.depositAmount <= 0) return true;

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

function stageLabels(collectPayment: boolean): {
  key: JourneyStageKey;
  label: string;
}[] {
  if (!collectPayment) {
    return [
      { key: "package", label: "Package" },
      { key: "agreement", label: "Agreement" },
      { key: "ready", label: "Next steps" },
      { key: "planning", label: "Planning" },
    ];
  }
  return [
    { key: "package", label: "Package" },
    { key: "agreement", label: "Agreement" },
    { key: "deposit", label: "Deposit" },
    { key: "ready", label: "Next steps" },
    { key: "planning", label: "Planning" },
  ];
}

/**
 * Commercial workflow steps complete (agreement + deposit if collecting).
 * Informational only — NEVER means the relationship is Booked.
 */
export function commercialStepsComplete(input: {
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
  const brand = input.brand ?? {
    primaryColor: "#5D6F5D",
    secondaryColor: "#4F5F4F",
    accentColor: "#B8AEA1",
    neutralColor: "#F7F5F1",
  };
  const selection = input.selection && input.selection.status !== "superseded" ? input.selection : null;
  const proposal = input.proposal ?? null;
  const hasPackage = !!selection;
  // Withdrawn and replaced proposals stay on the record but do not block Path B.
  const hasProposal = !!proposal && proposal.status !== "withdrawn" && proposal.status !== "superseded";
  const collectPayment = collectsInitialPayment(prefs);
  const agreementDone = agreementComplete(selection, input.contract, prefs);
  const paymentDone = initialPaymentSatisfied({
    selection,
    paymentLines: input.paymentLines,
    prefs,
  });
  const ready = agreementDone && paymentDone;
  const planningDone = ready && input.planningStarted;
  const depositLine = findDepositLine(input.paymentLines);
  const needsPaymentSetup = collectPayment
    && (selection?.depositAmount ?? 0) > 0
    && !depositExists(input.paymentLines);

  let currentKey: JourneyStageKey = "package";
  if (!hasPackage && !hasProposal) {
    currentKey = "package";
  } else if (!agreementDone) {
    currentKey = "agreement";
  } else if (!paymentDone) {
    currentKey = "deposit";
  } else if (!planningDone) {
    currentKey = "ready";
  } else {
    currentKey = "planning";
  }

  const labels = stageLabels(collectPayment);
  const stages: JourneyStage[] = labels.map(({ key, label }) => {
    let state: JourneyStageState = "upcoming";
    const complete =
      (key === "package" && (hasPackage || hasProposal))
      || (key === "agreement" && agreementDone)
      || (key === "deposit" && paymentDone)
      || (key === "ready" && ready)
      || (key === "planning" && planningDone);
    if (complete && key !== currentKey) state = "complete";
    else if (key === currentKey) state = "current";
    else if (complete) state = "complete";
    return { key, label, state };
  });

  const remaining = selection
    ? remainingAmount(selection.totalAmount, selection.depositAmount)
    : null;

  let direction = "Choose how to sell this booking.";
  let primaryLabel = "Select package";
  let primaryHref: string | null = null;
  let primaryAction: string | null = "select_package";
  let secondaryLabel: string | undefined;
  let secondaryHref: string | undefined | null;
  let secondaryAction: string | undefined;

  const allowOffer = prefs.agreementMethod === "offer" || prefs.agreementMethod === "either";
  const allowContract = prefs.agreementMethod === "contract" || prefs.agreementMethod === "either";

  if (!hasPackage && proposal?.status === "withdrawn") {
    direction = "You continued manually. Select the package to keep booking.";
    primaryLabel = "Select package";
    primaryAction = "select_package";
    if (allowOffer) {
      secondaryLabel = "Create proposal";
      secondaryAction = "create_proposal";
    }
  } else if (!hasPackage && !hasProposal) {
    if (prefs.agreementMethod === "offer") {
      direction = "Create a proposal so the couple can choose between options.";
      primaryLabel = "Create proposal";
      primaryAction = "create_proposal";
    } else if (prefs.agreementMethod === "contract") {
      direction = "Select the package — you already know what they're buying.";
      primaryLabel = "Select package";
      primaryAction = "select_package";
    } else {
      direction = "Create a proposal so the couple can choose, or select the package yourself.";
      primaryLabel = "Create proposal";
      primaryAction = "create_proposal";
      secondaryLabel = "Select package";
      secondaryAction = "select_package";
    }
  } else if (hasProposal && !hasPackage && !agreementDone) {
    direction = proposal!.status === "sent" || proposal!.status === "selected"
      ? "Proposal sent — waiting for the couple to choose and approve."
      : "Proposal draft — preview and send when ready.";
    primaryLabel = proposal!.acceptToken ? "Copy proposal link" : "Open proposal";
    primaryAction = proposal!.acceptToken ? "copy_proposal_link" : "create_proposal";
  } else if (currentKey === "deposit" && !paymentDone) {
    if (depositExists(input.paymentLines) && depositLine?.status !== "paid") {
      const amt = selection!.depositAmount;
      direction = `Waiting for the ${formatCurrency(amt)} deposit. Payment does not mark them Booked — you do that when you're ready. ${formatCurrency(remaining!)} will remain.`;
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
      const agreementLine = selection?.status === "accepted"
        ? `They accepted. Collect the ${formatCurrency(depositAmt)} deposit.`
        : `The agreement is complete for ${selection!.name} — ${formatCurrency(selection!.totalAmount)}. Collect the ${formatCurrency(depositAmt)} deposit.`;
      direction = `${agreementLine} ${formatCurrency(remaining!)} will remain on the payment plan.`;
      primaryLabel = "Set up payments";
      primaryHref = paymentsHref(input, selection);
      primaryAction = "setup_payments";
    }
  } else if (currentKey === "agreement" && !agreementDone) {
    if (input.contract?.status === "sent") {
      direction = "Contract sent to the client — waiting for their signature. The venue signs after the client.";
      if (collectPayment && !paymentDone) {
        direction += " Collect the deposit after they sign.";
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
      direction = "They accepted. This venue still requires a signed contract. Acceptance is not a contract, and they are not Booked until you mark them Booked.";
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
      const isL1 = Boolean(selection!.proposalId);
      direction = isL1
        ? "Proposal share link created — not emailed. Waiting for them to choose and approve."
        : "Share link created — not emailed. Waiting for them to review and accept.";
      if (collectPayment && !paymentDone) {
        direction += " After they accept, collect the deposit.";
      }
      primaryLabel = "Copy share link";
      primaryAction = "copy_share_link";
      secondaryLabel = "Mark accepted";
      secondaryAction = "mark_accepted";
    } else {
      // Direct L2 selection without L1: share link / contract — not "proposal" language.
      const shareLabel = selection!.proposalId ? "Create share link" : "Create share link";
      if (allowOffer && allowContract) {
        direction = "Create a share link so they can review and accept, or create a contract from this package.";
        primaryLabel = shareLabel;
        primaryAction = "send_offer";
        secondaryLabel = "Create contract";
        secondaryAction = "create_contract";
        secondaryHref = contractNewHref(input, selection!);
      } else if (allowContract) {
        direction = "Create a contract from this package. After they sign, finish booking when you're ready.";
        primaryLabel = "Create contract";
        primaryAction = "create_contract";
        primaryHref = contractNewHref(input, selection!);
      } else {
        direction = "Create a share link so they can review and accept this package. Creating the link does not email it.";
        primaryLabel = shareLabel;
        primaryAction = "send_offer";
      }
      if (!collectPayment) {
        direction += " No initial payment is collected by default.";
      }
    }
  } else if (!planningDone) {
    const paidNote = collectPayment && (selection?.depositAmount ?? 0) > 0
      ? `${formatCurrency(selection!.depositAmount)} paid. `
      : "";
    const remainNote = collectPayment && remaining != null
      ? `${formatCurrency(remaining)} remains on the payment plan. `
      : "";
    direction = `Commercial steps are ready. ${paidNote}${remainNote}Mark them Booked when you're ready, then invite them to the portal and start planning — optional if they won't use planning.`;
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
    proposal,
    contract: input.contract,
    commercialReady: ready,
    packageSummary: selection
      ? `${selection.name} · ${formatCurrency(selection.totalAmount)}`
      : null,
    depositSummary: collectPayment && selection
      ? formatCurrency(selection.depositAmount)
      : null,
    remainingSummary: collectPayment && remaining != null
      ? formatCurrency(remaining)
      : null,
    prefs,
    paymentLines: input.paymentLines,
    brand,
    venueName: input.venueName ?? null,
  };
}
