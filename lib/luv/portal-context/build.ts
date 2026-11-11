/**
 * Pure builders — map authoritative portal payloads → LuvAskPortalContext.
 * No DB access. Safe for client chip eligibility and server prompt assembly.
 */

import {
  allRequiredClientsHaveSigned,
  deriveContractSigningUiState,
  type ContractSigner,
} from "@/lib/contracts/signers";
import { coupleDocumentStatusBadge } from "@/lib/portal/couple-document-status";
import { formatPortalPaymentDate } from "@/lib/portal/payment-display-date";
import {
  invoicesWithoutPaymentPlan,
  portalInvoiceLabel,
  type PortalInvoiceRef,
} from "@/lib/portal/payment-obligations";
import {
  remainingBalanceFromSchedules,
  selectCanonicalPaymentSchedules,
  type PortalPaymentScheduleLike,
} from "@/lib/portal/payment-schedules";
import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";
import {
  emptyLuvAskPortalContext,
  type LuvAskContractFact,
  type LuvAskDocumentFact,
  type LuvAskPaymentFacts,
  type LuvAskPortalContext,
} from "@/lib/luv/portal-context/types";

export type PortalContextScheduleInput = PortalPaymentScheduleLike & {
  displayName?: string | null;
  invoiceNumber?: string | null;
};

export type PortalContextDocumentInput = {
  name?: string | null;
  docType?: string | null;
  status?: string | null;
  signedAt?: string | null;
  /** Present on contracts from get_couple_documents — used only to load signers server-side. */
  id?: string | null;
  signToken?: string | null;
};

export type PortalContextContractSignerInput = Pick<
  ContractSigner,
  "signerType" | "signedAt" | "isRequired"
>;

function todayYmd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Exported for prompt formatting tests. */
export { formatMoney as formatLuvAskMoney };

export function buildLuvAskPaymentFacts(input: {
  schedules: PortalContextScheduleInput[];
  invoices?: PortalInvoiceRef[];
  onlinePaymentsReady?: boolean | null;
  now?: Date;
}): LuvAskPaymentFacts {
  const now = input.now ?? new Date();
  const today = todayYmd(now);
  const canonical = selectCanonicalPaymentSchedules(input.schedules);
  const hasPaymentPlan = canonical.some((s) => s.lineItems.length > 0);

  let planTotal: number | null = null;
  let amountPaid: number | null = null;
  let remainingBalance: number | null = null;

  if (canonical.length > 0) {
    let total = 0;
    let paid = 0;
    for (const s of canonical) {
      const t = computePortalScheduleTotals(s.lineItems);
      total += t.planTotal;
      paid += t.paid;
    }
    planTotal = total;
    amountPaid = paid;
    remainingBalance = remainingBalanceFromSchedules(canonical);
  }

  const outstanding = canonical
    .flatMap((s) => s.lineItems)
    .filter((li) => li.status !== "paid" && li.status !== "cancelled" && li.dueDate);
  outstanding.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
  const nextLi = outstanding[0] ?? null;

  const nextScheduledPayment = nextLi?.dueDate
    ? {
        label: nextLi.label,
        amount: nextLi.amount,
        dueDate: nextLi.dueDate,
        dueDateLabel: formatPortalPaymentDate(nextLi.dueDate),
        isOverdue: nextLi.dueDate < today,
      }
    : null;

  const invoices = input.invoices ?? [];
  const bare = invoicesWithoutPaymentPlan(invoices, canonical);
  const unscheduledBalances = bare
    .map((inv) => {
      const balance = inv.balanceDue ?? inv.total ?? 0;
      if (!(balance > 0)) return null;
      return {
        label: portalInvoiceLabel(inv),
        balance,
        invoiceDueDate: inv.dueDate ?? null,
        invoiceDueDateLabel: inv.dueDate ? formatPortalPaymentDate(inv.dueDate) : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return {
    hasPaymentPlan,
    planTotal,
    amountPaid,
    remainingBalance,
    nextScheduledPayment,
    unscheduledBalances,
    onlinePaymentsReady:
      typeof input.onlinePaymentsReady === "boolean" ? input.onlinePaymentsReady : null,
  };
}

export function buildLuvAskContractFact(
  doc: PortalContextDocumentInput,
  signers: PortalContextContractSignerInput[] | null | undefined,
): LuvAskContractFact | null {
  if (doc.docType !== "contract") return null;
  const title = (doc.name ?? "").trim() || "Venue Contract";
  const status = doc.status ?? "draft";

  const clients = (signers ?? []).filter((s) => s.signerType === "client");
  const venue = (signers ?? []).find((s) => s.signerType === "venue");
  const venueSigned = Boolean(venue?.signedAt);
  const requiredClients = clients.filter((s) => s.isRequired);
  const requiredClientTotal =
    requiredClients.length > 0 ? requiredClients.length : Math.max(clients.length, 1);
  const requiredClientSigned =
    requiredClients.length > 0
      ? requiredClients.filter((s) => s.signedAt != null).length
      : clients.filter((s) => s.signedAt != null).length;

  // When signer rows are missing, fall back to document status only —
  // never invent Awaiting Venue Signature or Fully Executed from guesses.
  const hasSignerEvidence = (signers ?? []).length > 0;
  const derived = hasSignerEvidence
    ? deriveContractSigningUiState({
        status,
        venueSigned,
        requiredClientTotal,
        requiredClientSigned,
        expiresAt: null,
      })
    : status === "signed"
      ? { state: "fully_signed" as const, label: "Fully Executed" }
      : status === "sent"
        ? { state: "sent_to_client" as const, label: "Sent to Client" }
        : status === "cancelled"
          ? { state: "cancelled" as const, label: "Cancelled" }
          : status === "expired"
            ? { state: "expired" as const, label: "Expired" }
            : { state: "draft" as const, label: "Draft" };

  const signedByCouple = hasSignerEvidence
    ? allRequiredClientsHaveSigned(signers ?? [])
    : status === "signed";
  const signedByVenue = hasSignerEvidence ? venueSigned : status === "signed";
  const fullyExecuted = derived.state === "fully_signed";

  let signedAtLabel: string | null = null;
  if (fullyExecuted && doc.signedAt) {
    const label = formatPortalPaymentDate(doc.signedAt);
    signedAtLabel = label !== "—" ? label : null;
  }

  return {
    title,
    lifecycleState: derived.state,
    lifecycleLabel: derived.label,
    signedByCouple,
    signedByVenue,
    fullyExecuted,
    signedAtLabel,
  };
}

export function buildLuvAskDocumentFact(doc: PortalContextDocumentInput): LuvAskDocumentFact | null {
  const name = (doc.name ?? "").trim();
  if (!name) return null;
  const docType = (doc.docType ?? "other").trim() || "other";
  const badge = coupleDocumentStatusBadge(docType, doc.status);
  return {
    name,
    docType,
    statusLabel: badge?.label ?? null,
  };
}

export function buildLuvAskPortalContext(input: {
  schedules?: PortalContextScheduleInput[];
  invoices?: PortalInvoiceRef[];
  onlinePaymentsReady?: boolean | null;
  documents?: PortalContextDocumentInput[];
  /** contractId → signers; omit entries when not loaded */
  contractSignersById?: Record<string, PortalContextContractSignerInput[]>;
  now?: Date;
}): LuvAskPortalContext {
  const ctx = emptyLuvAskPortalContext();

  if (input.schedules || input.invoices) {
    ctx.payments = buildLuvAskPaymentFacts({
      schedules: input.schedules ?? [],
      invoices: input.invoices ?? [],
      onlinePaymentsReady: input.onlinePaymentsReady,
      now: input.now,
    });
  }

  const docs = input.documents ?? [];
  const contractFacts: LuvAskContractFact[] = [];
  const documentFacts: LuvAskDocumentFact[] = [];

  for (const doc of docs) {
    if (doc.docType === "contract") {
      const signers =
        doc.id && input.contractSignersById
          ? input.contractSignersById[doc.id]
          : undefined;
      const fact = buildLuvAskContractFact(doc, signers);
      if (fact) contractFacts.push(fact);
    }
    const docFact = buildLuvAskDocumentFact(doc);
    if (docFact) documentFacts.push(docFact);
  }

  ctx.contracts = contractFacts;
  ctx.documents = documentFacts;
  return ctx;
}

/** True when Ask Luv can authoritatively answer a next-payment-due question. */
export function hasAuthoritativeNextPayment(ctx: LuvAskPortalContext | null | undefined): boolean {
  return Boolean(ctx?.payments?.nextScheduledPayment?.dueDate);
}
