/**
 * Commercial artifact states for the Lead and Client workspaces.
 * Independent of the sales pipeline and of events.booked_at.
 * A selected package is not a sent proposal. A share link is not an email.
 * A Proposal row requires an actual L1 commercial_proposals record.
 */

import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { deriveContractSigningUiState } from "@/lib/contracts/signers";
import { formatCurrency } from "@/lib/invoices/constants";

import type { JourneyContract, JourneyPaymentLine, JourneyProposal } from "@/lib/booking-journey/model";
import type { VenueCommercialBookingPrefs } from "@/lib/booking-journey/venue-prefs";

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
  // Provenance is commercial_selections.proposal_id — stamped only by
  // approve_commercial_proposal. Venue create/bump never sets it.
  // Do not infer couple choice from acceptToken or offered/accepted status.
  if (selection.proposalId) {
    return {
      key: "package",
      title: "Selected Package",
      state: price,
      detail: "Selected by the couple",
    };
  }
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
      title: "Booking Invoice",
      state: "Not created",
      detail: "Selecting a package does not create an invoice.",
    };
  }
  return {
    key: "invoice",
    title: "Booking Invoice",
    state: "On file",
    detail: "Open the invoice to preview it and to see whether it was issued or emailed. This list does not call it sent.",
  };
}

function formatInstallmentDue(dueDate: string | null | undefined, today?: string): string {
  if (!dueDate) return "date not set";
  if (today && dueDate === today) return "today";
  const date = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function paymentPlanFact(
  lines: JourneyPaymentLine[],
  today?: string,
): CommercialFact {
  const active = lines.filter((line) => line.status !== "cancelled");
  if (active.length === 0) {
    return {
      key: "payment_plan",
      title: "Payment plan",
      state: "Not configured",
      detail: null,
    };
  }
  const paidInstallments = active.filter((line) => line.status === "paid").length;
  const paidAmount = active.reduce((sum, line) => {
    if (line.status === "paid" || line.status === "partially_paid" || line.status === "partially_refunded" || line.status === "refunded") {
      return sum + (line.paidAmount ?? (line.status === "paid" ? line.amount : 0));
    }
    return sum;
  }, 0);
  const planTotal = active.reduce((sum, line) => sum + line.amount, 0);
  const remainingAmount = Math.max(0, planTotal - paidAmount);
  const nextOpen = active.find(
    (line) => line.status === "overdue" || line.status === "partially_paid" || line.status === "pending",
  );
  const installmentLines = active.map((line) => {
    const when = formatInstallmentDue(line.dueDate, today);
    const name = line.label?.trim() || (
      line.obligationKind === "deposit" ? "Initial payment"
        : line.obligationKind === "final" ? "Final payment"
          : "Installment"
    );
    if (line.status === "paid") return `${name} — Paid (${formatCurrency(line.amount)})`;
    if (line.status === "partially_paid") {
      const received = line.paidAmount ?? 0;
      return `${name} — ${formatCurrency(received)} paid · ${formatCurrency(Math.max(0, line.amount - received))} remaining · due ${when}`;
    }
    if (line.status === "overdue") return `${name} — ${formatCurrency(line.amount)} overdue · was due ${when}`;
    return `${name} — ${formatCurrency(line.amount)} due ${when}`;
  });
  const nextLine = nextOpen
    ? `Next payment — Due ${formatInstallmentDue(nextOpen.dueDate, today)}`
    : paidInstallments === active.length
      ? "Paid in full"
      : null;
  const detail = [
    `${formatCurrency(paidAmount)} paid · ${formatCurrency(remainingAmount)} remaining`,
    ...installmentLines,
    nextLine,
  ].filter(Boolean).join("\n");
  return {
    key: "payment_plan",
    title: "Payment plan",
    state: `${paidInstallments} of ${active.length} paid`,
    detail,
  };
}

export function depositFact(input: {
  selection: CommercialSelection | null;
  lines: JourneyPaymentLine[];
  prefs?: VenueCommercialBookingPrefs | null;
  paymentRequestSent?: boolean;
  today?: string;
}): CommercialFact | null {
  const line = input.lines.find(
    (item) => item.obligationKind === "deposit" && item.status !== "cancelled",
  );
  if (!line) return null;
  if (line.status === "paid") {
    return {
      key: "deposit",
      title: "Initial payment",
      state: "Paid",
      detail: formatCurrency(line.amount),
    };
  }
  const due = `${formatCurrency(line.amount)} due ${formatInstallmentDue(line.dueDate, input.today)}`;
  if (input.paymentRequestSent) {
    return {
      key: "deposit",
      title: "Initial payment",
      state: due,
      detail: null,
    };
  }
  return {
    key: "deposit",
    title: "Initial payment",
    state: due,
    detail: "Included when you send",
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
  paymentRequestSent?: boolean;
  today?: string;
}): CommercialFact[] {
  const rows: CommercialFact[] = [packageFact(input.selection)];

  // Proposal row only when an actual L1 record exists.
  if (input.proposal) {
    rows.push(proposalFactFromL1(input.proposal));
  }

  rows.push(contractFact(input.contract));
  rows.push(paymentPlanFact(input.paymentLines, input.today));

  const deposit = depositFact({
    selection: input.selection,
    lines: input.paymentLines,
    prefs: input.prefs,
    paymentRequestSent: input.paymentRequestSent,
    today: input.today,
  });
  if (deposit) rows.push(deposit);

  rows.push(bookedFact());
  return rows;
}
