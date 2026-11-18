/**
 * Luv Ask — Portal Context (Phase 2A).
 *
 * Customer-safe, presentation-ready facts about THIS couple's portal state.
 * Never dump raw DB rows. Never invent missing facts (omit instead).
 *
 * FACT → SOURCE OF TRUTH → CUSTOMER-FACING MAPPING
 * ------------------------------------------------
 * Payments plan totals / paid / remaining
 *   ← get_portal_payments schedules + computePortalScheduleTotals / selectCanonicalPaymentSchedules
 *   → currency amounts; remaining is balance, not automatically "due"
 *
 * Next scheduled payment (label, amount, due date, overdue)
 *   ← canonical schedule lineItems with dueDate, unpaid, not cancelled
 *   → formatPortalPaymentDate; overdue = dueDate < today
 *
 * Unscheduled invoice balance
 *   ← get_portal_payments invoices + invoicesWithoutPaymentPlan
 *   → "Balance: $X" + no schedule; due only if invoice.dueDate set
 *
 * Contract lifecycle
 *   ← get_couple_documents contracts + contract_signers + deriveContractSigningUiState
 *   → Draft | Sent to Client | Awaiting Venue Signature | Fully Executed
 *   → Fully Executed only when status === "signed" (venue countersigned)
 *
 * Document names / status labels
 *   ← get_couple_documents + coupleDocumentStatusBadge
 *   → type-specific labels (invoice "sent" = Issued, not awaiting signature)
 */

import type { ContractSigningUiState } from "@/lib/contracts/signers";

export type LuvAskPortalProvenance = "portal_context";

export type LuvAskNextScheduledPayment = {
  label: string;
  amount: number;
  /** YYYY-MM-DD */
  dueDate: string;
  dueDateLabel: string;
  isOverdue: boolean;
};

export type LuvAskUnscheduledBalance = {
  label: string;
  balance: number;
  /** Invoice due date when set — never invent. */
  invoiceDueDate: string | null;
  invoiceDueDateLabel: string | null;
};

export type LuvAskPaymentFacts = {
  hasPaymentPlan: boolean;
  planTotal: number | null;
  amountPaid: number | null;
  remainingBalance: number | null;
  nextScheduledPayment: LuvAskNextScheduledPayment | null;
  unscheduledBalances: LuvAskUnscheduledBalance[];
  /** True when venue Stripe is connected for online pay — omit when unknown. */
  onlinePaymentsReady: boolean | null;
};

export type LuvAskContractFact = {
  title: string;
  lifecycleState: ContractSigningUiState;
  /** Locked customer-facing label from deriveContractSigningUiState. */
  lifecycleLabel: string;
  signedByCouple: boolean;
  signedByVenue: boolean;
  fullyExecuted: boolean;
  /** Only when fully executed and signedAt known. */
  signedAtLabel: string | null;
};

export type LuvAskDocumentFact = {
  name: string;
  /** contract | invoice | other customer-visible category */
  docType: string;
  /** Customer-facing badge label; null when no badge applies. */
  statusLabel: string | null;
};

export type LuvAskTaskFact = {
  title: string;
  status: "open" | "overdue" | "blocked" | "completed";
  dueDate: string | null;
  dueDateLabel: string | null;
  isRequired: boolean;
};

export type LuvAskQuestionnaireFact = {
  title: string;
  kind: string | null;
  status: "open" | "in_progress" | "completed";
};

export type LuvAskTimelineEntryFact = {
  title: string;
  entryTime: string | null;
  endTime: string | null;
  dayOffset: number;
  owner: "venue" | "client";
};

/**
 * Couple-visible planning snapshot (tasks / questionnaires / published timeline).
 * Loaded only on Ask Luv POST — never invent missing items.
 */
export type LuvAskPlanningFacts = {
  openTaskCount: number;
  overdueTaskCount: number;
  completedTaskCount: number;
  openTasks: LuvAskTaskFact[];
  completedTasks: LuvAskTaskFact[];
  nextSuggestedTask: {
    title: string;
    dueDateLabel: string | null;
    status: LuvAskTaskFact["status"];
  } | null;
  questionnaires: LuvAskQuestionnaireFact[];
  openQuestionnaireCount: number;
  completedQuestionnaireCount: number;
  /** False when timeline payload could not be loaded. */
  timelineAvailable: boolean;
  timelineEntries: LuvAskTimelineEntryFact[];
};

/**
 * Typed portal snapshot for Ask Luv.
 * Absent arrays/null fields mean "not available" — never false guesses.
 */
export type LuvAskPortalContext = {
  source: LuvAskPortalProvenance;
  payments: LuvAskPaymentFacts | null;
  contracts: LuvAskContractFact[];
  documents: LuvAskDocumentFact[];
  /** Null when planning pack was not loaded for this turn. */
  planning: LuvAskPlanningFacts | null;
};

export function emptyLuvAskPlanningFacts(): LuvAskPlanningFacts {
  return {
    openTaskCount: 0,
    overdueTaskCount: 0,
    completedTaskCount: 0,
    openTasks: [],
    completedTasks: [],
    nextSuggestedTask: null,
    questionnaires: [],
    openQuestionnaireCount: 0,
    completedQuestionnaireCount: 0,
    timelineAvailable: false,
    timelineEntries: [],
  };
}

export function emptyLuvAskPortalContext(): LuvAskPortalContext {
  return {
    source: "portal_context",
    payments: null,
    contracts: [],
    documents: [],
    planning: null,
  };
}
