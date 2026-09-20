/**
 * Commercial artifact states for the Lead and Client workspaces.
 * Independent of the sales pipeline and of events.booked_at.
 * A selected package is not a sent proposal. A share link is not an email.
 */

import { SELECTION_STATUS_LABEL } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { deriveContractSigningUiState } from "@/lib/contracts/signers";
import { formatCurrency } from "@/lib/invoices/constants";
import { STATUS_LABEL } from "@/lib/payments/constants";

import { isCommerciallyBooked } from "@/lib/booking-journey/model";
import type { JourneyContract, JourneyPaymentLine } from "@/lib/booking-journey/model";
import type { VenueCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";

export type CommercialFactKey =
  | "package"
  | "proposal"
  | "contract"
  | "invoice"
  | "payment_plan"
  | "deposit"
  | "booked";

export type CommercialFact = {
  key: CommercialFactKey;
  title: string;
  /** What is true now. Must not call a link "sent" or a selection "accepted". */
  state: string;
  detail: string | null;
};

function stamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function packageFact(selection: CommercialSelection | null): CommercialFact {
  if (!selection) {
    return {
      key: "package",
      title: "Selected Package",
      state: "Not selected",
      detail: "Choosing a package freezes it for this opportunity. It does not send anything.",
    };
  }
  const price = `${selection.name} · ${formatCurrency(selection.totalAmount)}`;
  const shared = selection.status === "offered" || selection.status === "accepted" || Boolean(selection.acceptToken);
  return {
    key: "package",
    title: "Selected Package",
    state: price,
    detail: shared ? "Selected internally" : "Selected internally · Not yet shared",
  };
}

export function proposalFact(selection: CommercialSelection | null): CommercialFact {
  if (!selection) {
    return {
      key: "proposal",
      title: "Proposal",
      state: "Not started",
      detail: "A package selection is not a proposal.",
    };
  }
  if (selection.status === "draft") {
    return {
      key: "proposal",
      title: "Proposal",
      state: "Draft",
      detail: "Not shared. Preview does not send it. A share link is not an email.",
    };
  }
  if (selection.status === "offered") {
    const when = stamp(selection.offeredAt);
    return {
      key: "proposal",
      title: "Proposal",
      state: "Share link created",
      detail: when
        ? `Link created ${when}. Link exists · Not emailed.`
        : "Link exists · Not emailed.",
    };
  }
  if (selection.status === "accepted") {
    const when = stamp(selection.acceptedAt);
    return {
      key: "proposal",
      title: "Proposal",
      state: "Accepted",
      detail: when
        ? `Accepted ${when}. This is not a signed contract.`
        : "Accepted. This is not a signed contract.",
    };
  }
  return {
    key: "proposal",
    title: "Proposal",
    state: SELECTION_STATUS_LABEL[selection.status] ?? selection.status,
    detail: null,
  };
}

export function contractFact(contract: JourneyContract | null): CommercialFact {
  if (!contract) {
    return {
      key: "contract",
      title: "Contract",
      state: "Not created",
      detail: "A proposal acceptance does not execute a contract.",
    };
  }
  const ui = deriveContractSigningUiState({
    status: contract.status,
    venueSigned: contract.venueSigned ?? false,
    requiredClientTotal: contract.requiredClientTotal ?? 0,
    requiredClientSigned: contract.requiredClientSigned ?? 0,
    expiresAt: null,
  });
  const detail =
    contract.status === "draft"
      ? "Draft. Not sent."
      : contract.status === "sent"
        ? "The client signs first. The venue signs second."
        : contract.status === "signed"
          ? "Fully executed. Client signature alone does not reach this state."
          : null;
  return { key: "contract", title: "Contract", state: ui.label, detail };
}

export function invoiceFact(invoiceId: string | null | undefined): CommercialFact {
  if (!invoiceId) {
    return {
      key: "invoice",
      title: "Invoice",
      state: "Not created",
      detail: "Selecting a package does not create an invoice.",
    };
  }
  return {
    key: "invoice",
    title: "Invoice",
    state: "On file",
    detail: "Open the invoice to preview it and to see whether it was issued or emailed. This list does not call it sent.",
  };
}

export function paymentPlanFact(lines: JourneyPaymentLine[]): CommercialFact {
  const active = lines.filter((line) => line.status !== "cancelled");
  if (active.length === 0) {
    return {
      key: "payment_plan",
      title: "Payment Plan",
      state: "Not configured",
      detail: "An invoice or a package does not create installments.",
    };
  }
  return {
    key: "payment_plan",
    title: "Payment Plan",
    state: "Configured",
    detail: `${active.length} installment${active.length === 1 ? "" : "s"} on file. Configured is not the same as paid.`,
  };
}

export function depositFact(input: {
  selection: CommercialSelection | null;
  lines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): CommercialFact {
  const prefs = input.prefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
  if (!prefs.initialPaymentRequired) {
    return {
      key: "deposit",
      title: "Deposit",
      state: "Not required",
      detail: "This venue's booking rule does not require an initial payment.",
    };
  }
  const line = input.lines.find(
    (item) => item.obligationKind === "deposit" && item.status !== "cancelled",
  );
  if (!line) {
    const configured = input.selection && input.selection.depositAmount > 0
      ? ` ${formatCurrency(input.selection.depositAmount)} is configured on the package and has not been requested as a payment.`
      : "";
    return {
      key: "deposit",
      title: "Deposit",
      state: "Not set up",
      detail: `No deposit payment exists.${configured}`,
    };
  }
  if (line.status === "paid") {
    return {
      key: "deposit",
      title: "Deposit",
      state: "Paid",
      detail: formatCurrency(line.amount),
    };
  }
  return {
    key: "deposit",
    title: "Deposit",
    state: STATUS_LABEL[line.status] ?? line.status,
    detail: `${formatCurrency(line.amount)} is due. Not paid.`,
  };
}

export function bookedFact(input: {
  selection: CommercialSelection | null;
  contract: JourneyContract | null;
  lines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): CommercialFact {
  const prefs = input.prefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
  if (isCommerciallyBooked({
    selection: input.selection,
    contract: input.contract,
    paymentLines: input.lines,
    prefs,
  })) {
    return {
      key: "booked",
      title: "Booked",
      state: "Booked",
      detail: "The venue booking rule is satisfied. This is not the event date.",
    };
  }
  if (prefs.agreementMethod === "contract" && input.selection?.status === "accepted" && input.contract?.status !== "signed") {
    return {
      key: "booked",
      title: "Booked",
      state: "Not booked",
      detail: "The proposal is accepted. A signed contract is still required.",
    };
  }
  if (prefs.initialPaymentRequired && input.selection?.status === "accepted") {
    const line = input.lines.find((item) => item.obligationKind === "deposit" && item.status !== "cancelled");
    if (!line || line.status !== "paid") {
      const amount = input.selection.depositAmount > 0 ? formatCurrency(input.selection.depositAmount) : "The deposit";
      return {
        key: "booked",
        title: "Booked",
        state: "Not booked",
        detail: `${amount} is still required. Accepting the proposal did not book this.`,
      };
    }
  }
  return {
    key: "booked",
    title: "Booked",
    state: "Not booked",
    detail: "Booking follows the venue booking rule. A selected package or a share link is not a booking.",
  };
}

export function describeCommercialFacts(input: {
  selection: CommercialSelection | null;
  contract: JourneyContract | null;
  paymentLines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): CommercialFact[] {
  return [
    packageFact(input.selection),
    proposalFact(input.selection),
    contractFact(input.contract),
    invoiceFact(input.selection?.invoiceId),
    paymentPlanFact(input.paymentLines),
    depositFact({
      selection: input.selection,
      lines: input.paymentLines,
      prefs: input.prefs,
    }),
    bookedFact({
      selection: input.selection,
      contract: input.contract,
      lines: input.paymentLines,
      prefs: input.prefs,
    }),
  ];
}
