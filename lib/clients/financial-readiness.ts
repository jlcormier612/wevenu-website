/**
 * Phase 4 financial readiness — presentation only.
 *
 * Reads existing Contract and Payment Schedule / line records.
 * Does not require a contract, payment plan, or initial payment.
 * Does not infer a deposit from sort order, labels, or “any paid line.”
 * Initial payment is shown only when a line is stamped obligationKind "deposit".
 */

import { CONTRACT_STATUS_LABEL, pickContract } from "@/lib/clients/booking-handoff";
import { STATUS_LABEL } from "@/lib/payments/constants";
import type { PaymentItemStatus, PaymentObligationKind } from "@/lib/payments/types";
import type { ContractStatus } from "@/lib/contracts/types";

export type FinancialReadinessContract = {
  id: string;
  status: ContractStatus;
};

export type FinancialReadinessSchedule = {
  id: string;
  title?: string;
};

export type FinancialReadinessLine = {
  scheduleId: string;
  obligationKind: PaymentObligationKind | null;
  status: PaymentItemStatus;
  sortOrder: number;
};

export type FinancialReadinessRow = {
  key: "contract" | "payment_plan" | "initial_payment";
  label: string;
  detail: string;
  onFile: boolean;
  href: string;
  actionLabel: string;
};

export type FinancialReadinessModel = {
  heading: string;
  summary: string;
  optionalNote: string;
  rows: FinancialReadinessRow[];
};

export const FINANCIAL_OPTIONAL_NOTE =
  "Contract and payment plan are optional. You can skip them if your process does not use them — this does not block planning or the client invitation.";

function contractRow(contracts: FinancialReadinessContract[]): FinancialReadinessRow {
  const contract = pickContract(contracts);
  if (!contract) {
    return {
      key: "contract",
      label: "Contract",
      detail: "Not set up",
      onFile: false,
      href: "/contracts/new",
      actionLabel: "Open Contracts",
    };
  }
  const active = contract.status === "draft" || contract.status === "sent" || contract.status === "signed";
  const detail =
    contract.status === "signed"
      ? "Signed"
      : contract.status === "sent"
        ? "Sent — awaiting signature"
        : contract.status === "draft"
          ? "Draft — not yet sent"
          : CONTRACT_STATUS_LABEL[contract.status];
  return {
    key: "contract",
    label: "Contract",
    detail,
    onFile: active,
    href: `/contracts/${contract.id}`,
    actionLabel: "View Contract",
  };
}

function paymentPlanRow(schedules: FinancialReadinessSchedule[]): FinancialReadinessRow {
  const schedule = schedules[0] ?? null;
  if (!schedule) {
    return {
      key: "payment_plan",
      label: "Payment plan",
      detail: "Not set up",
      onFile: false,
      href: "/payments",
      actionLabel: "Open Payments",
    };
  }
  return {
    key: "payment_plan",
    label: "Payment plan",
    detail: schedule.title?.trim() ? `On file — ${schedule.title}` : "On file",
    onFile: true,
    href: `/payments/${schedule.id}`,
    actionLabel: "View Payments",
  };
}

/** Only obligationKind "deposit" is authoritative. Never infer from the first line. */
function initialPaymentRow(
  schedules: FinancialReadinessSchedule[],
  lines: FinancialReadinessLine[],
): FinancialReadinessRow {
  const scheduleIds = new Set(schedules.map((s) => s.id));
  const depositLines = lines
    .filter((l) => scheduleIds.has(l.scheduleId) && l.obligationKind === "deposit")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const deposit = depositLines[0] ?? null;
  const href = deposit ? `/payments/${deposit.scheduleId}` : schedules[0] ? `/payments/${schedules[0].id}` : "/payments";

  if (schedules.length === 0) {
    return {
      key: "initial_payment",
      label: "Initial payment",
      detail: "Not available — no payment plan on file",
      onFile: false,
      href: "/payments",
      actionLabel: "Open Payments",
    };
  }
  if (!deposit) {
    return {
      key: "initial_payment",
      label: "Initial payment",
      detail: "Not available — no initial payment recorded on this payment plan",
      onFile: false,
      href,
      actionLabel: "View Payments",
    };
  }
  return {
    key: "initial_payment",
    label: "Initial payment",
    detail: STATUS_LABEL[deposit.status],
    onFile: deposit.status === "paid" || deposit.status === "processing",
    href,
    actionLabel: "View Payments",
  };
}

function summarize(rows: FinancialReadinessRow[]): string {
  const contract = rows.find((r) => r.key === "contract");
  const plan = rows.find((r) => r.key === "payment_plan");
  const initial = rows.find((r) => r.key === "initial_payment");
  const facts: string[] = [];
  if (contract?.onFile) facts.push(`Contract: ${contract.detail}`);
  else facts.push("Contract not set up");
  if (plan?.onFile) facts.push("Payment plan on file");
  else facts.push("Payment plan not set up");
  if (initial && !initial.detail.startsWith("Not available")) {
    facts.push(`Initial payment: ${initial.detail}`);
  }
  if (!contract?.onFile && !plan?.onFile) {
    return "Nothing on file yet. Contract and payment plan are optional.";
  }
  return facts.join(". ") + ".";
}

export function buildFinancialReadiness(input: {
  contracts: FinancialReadinessContract[];
  paymentSchedules: FinancialReadinessSchedule[];
  paymentLines: FinancialReadinessLine[];
}): FinancialReadinessModel {
  const rows = [
    contractRow(input.contracts),
    paymentPlanRow(input.paymentSchedules),
    initialPaymentRow(input.paymentSchedules, input.paymentLines),
  ];
  return {
    heading: "Financial readiness",
    summary: summarize(rows),
    optionalNote: FINANCIAL_OPTIONAL_NOTE,
    rows,
  };
}
