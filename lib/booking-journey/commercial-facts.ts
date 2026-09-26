/**
 * Commercial artifact states for the Lead and Client workspaces.
 * Independent of the sales pipeline and of events.booked_at.
 * A selected package is not a sent proposal. A share link is not an email.
 * A Proposal row requires an actual L1 commercial_proposals record.
 */

import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { deriveContractSigningUiState } from "@/lib/contracts/signers";
import { formatCurrency } from "@/lib/invoices/constants";
import { STATUS_LABEL } from "@/lib/payments/constants";

import type { JourneyContract, JourneyPaymentLine, JourneyProposal } from "@/lib/booking-journey/model";
import {
  collectsInitialPayment,
  DEFAULT_COMMERCIAL_BOOKING_PREFS,
  type VenueCommercialBookingPrefs,
} from "@/lib/booking-journey/venue-prefs";

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
      detail: "Choosing a package saves it for this opportunity. It does not send anything.",
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

/**
 * Proposal fact — only for an actual L1 commercial_proposals row.
 * Direct Path B selections (proposal_id null) must not invent a Proposal row.
 */
export function proposalFactFromL1(proposal: JourneyProposal): CommercialFact {
  if (proposal.status === "draft") {
    return {
      key: "proposal",
      title: "Proposal",
      state: "Draft",
      detail: "Not shared. Preview does not send it.",
    };
  }
  if (proposal.status === "sent") {
    const when = stamp(proposal.offeredAt);
    return {
      key: "proposal",
      title: "Proposal",
      state: "Sent",
      detail: when
        ? `Sent ${when}. Waiting for the couple to choose.`
        : "Waiting for the couple to choose.",
    };
  }
  if (proposal.status === "selected") {
    return {
      key: "proposal",
      title: "Proposal",
      state: "Option chosen",
      detail: "Waiting for the couple to approve their selection.",
    };
  }
  if (proposal.status === "approved") {
    const when = stamp(proposal.offeredAt);
    return {
      key: "proposal",
      title: "Proposal",
      state: "Approved",
      detail: when
        ? `Approved. One package selection was created from their choice.`
        : "Approved. One package selection was created from their choice.",
    };
  }
  if (proposal.status === "withdrawn") {
    return {
      key: "proposal",
      title: "Proposal",
      state: "Withdrawn",
      detail: "You continued manually. The proposal link is no longer an approval path.",
    };
  }
  if (proposal.status === "superseded") {
    return {
      key: "proposal",
      title: "Proposal",
      state: "Replaced",
      detail: null,
    };
  }
  return {
    key: "proposal",
    title: "Proposal",
    state: proposal.status,
    detail: null,
  };
}

export function contractFact(contract: JourneyContract | null): CommercialFact {
  if (!contract) {
    return {
      key: "contract",
      title: "Contract",
      state: "Not created",
      detail: "Accepting a package does not execute the contract.",
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
  if (!collectsInitialPayment(prefs)) {
    return {
      key: "deposit",
      title: "Initial payment",
      state: "Not collecting",
      detail: "This venue's default is not to collect an initial payment. You can still set one up on a booking.",
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
      title: "Initial payment",
      state: "Not set up",
      detail: `No initial payment exists.${configured}`,
    };
  }
  if (line.status === "paid") {
    return {
      key: "deposit",
      title: "Initial payment",
      state: "Paid",
      detail: formatCurrency(line.amount),
    };
  }
  return {
    key: "deposit",
    title: "Initial payment",
    state: STATUS_LABEL[line.status] ?? line.status,
    detail: `${formatCurrency(line.amount)} is due. Not paid.`,
  };
}

/**
 * Booked fact — informational only. Never derives Booked from payment/agreement.
 * Canonical Booked is bookClient / events.booked_at.
 */
export function bookedFact(): CommercialFact {
  return {
    key: "booked",
    title: "Booked",
    state: "Venue decision",
    detail: "You mark a relationship Booked when you're ready. Payment and agreements do not decide Booked for you.",
  };
}

export function describeCommercialFacts(input: {
  selection: CommercialSelection | null;
  proposal?: JourneyProposal | null;
  contract: JourneyContract | null;
  paymentLines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
}): CommercialFact[] {
  const rows: CommercialFact[] = [packageFact(input.selection)];

  // Proposal row only when an actual L1 record exists.
  if (input.proposal) {
    rows.push(proposalFactFromL1(input.proposal));
  }

  rows.push(
    contractFact(input.contract),
    invoiceFact(input.selection?.invoiceId),
    paymentPlanFact(input.paymentLines),
    depositFact({
      selection: input.selection,
      lines: input.paymentLines,
      prefs: input.prefs,
    }),
    bookedFact(),
  );

  return rows;
}
