/**
 * Couple Home — Planning Progress presentation.
 *
 * Preserves the Phase 1 `WeddingPlanningProgressCard` composite as the sole
 * Home operational % (required venue tasks + payment line items + contracts +
 * questionnaire). No alternate formula, health score, or destination metrics.
 */

export type PlanningProgressTask = { status: string; isRequired?: boolean };
export type PlanningProgressPaymentLine = { status: string };
export type PlanningProgressContract = { status: string | null };
export type PlanningProgressQuestionnaire = { status: string } | null;

export type PlanningProgressCategory = {
  label: string;
  detail: string;
};

export type PlanningProgressReady = {
  kind: "ready";
  percent: number;
  completed: number;
  total: number;
  categories: PlanningProgressCategory[];
  /** Warm, hospitality-first line — not SaaS / health / productivity language. */
  supportingStatement: string;
  /** Quiet attribution of the composite inputs (same formula as Phase 1). */
  sourceNote: string;
  accessibleLabel: string;
};

export type PlanningProgressEmpty = {
  kind: "empty";
  /** Encouraging setup copy — never a misleading 0%. */
  supportingStatement: string;
  sourceNote: string;
  accessibleLabel: string;
};

export type PlanningProgressResult = PlanningProgressReady | PlanningProgressEmpty;

export const PLANNING_PROGRESS_SOURCE_NOTE =
  "Based on required venue tasks, payments, contracts, and your questionnaire.";

export const PLANNING_PROGRESS_SETUP_STATEMENT =
  "Your planning story is just beginning — when your venue shares what’s needed, it will gently gather here.";

/**
 * Warm supporting line from the canonical percent only.
 * Presentation copy — does not change the underlying calculation.
 */
export function planningProgressSupportingStatement(percent: number): string {
  if (percent >= 100) return "Everything with your venue is beautifully in place.";
  if (percent >= 76) return "So close — the finishing details are falling into place.";
  if (percent >= 51) return "Your planning is coming together beautifully.";
  if (percent >= 26) return "You’re making real headway.";
  if (percent > 0) return "You’re off to a lovely start.";
  return "Every wedding begins somewhere — you’ve started the path.";
}

/**
 * Canonical Home operational progress.
 * Identical numerator/denominator rules as Phase 1 WeddingPlanningProgressCard.
 */
export function computePlanningProgress(input: {
  /** Already filtered to required venue tasks (same as Phase 1 card). */
  requiredTasks: PlanningProgressTask[];
  paymentLineItems: PlanningProgressPaymentLine[];
  contracts: PlanningProgressContract[];
  questionnaire: PlanningProgressQuestionnaire;
}): PlanningProgressResult {
  const required = input.requiredTasks;
  const paymentItems = input.paymentLineItems;
  const contracts = input.contracts;
  const questionnaire = input.questionnaire;

  const reqDone = required.filter((t) => t.status === "complete").length;
  const payDone = paymentItems.filter((li) => li.status === "paid").length;
  const contractDone = contracts.filter((c) => c.status === "signed").length;
  const qInScope = Boolean(questionnaire);
  const qDone =
    questionnaire &&
    (questionnaire.status === "submitted" || questionnaire.status === "completed")
      ? 1
      : 0;

  const completed = reqDone + payDone + contractDone + (qInScope ? qDone : 0);
  const total =
    required.length + paymentItems.length + contracts.length + (qInScope ? 1 : 0);

  if (total === 0) {
    return {
      kind: "empty",
      supportingStatement: PLANNING_PROGRESS_SETUP_STATEMENT,
      sourceNote: PLANNING_PROGRESS_SOURCE_NOTE,
      accessibleLabel:
        "Planning Progress. Not enough venue planning data yet to show a completion percentage.",
    };
  }

  const percent = Math.round((completed / total) * 100);
  const categories: PlanningProgressCategory[] = [];
  if (required.length > 0) {
    categories.push({ label: "Required tasks", detail: `${reqDone}/${required.length}` });
  }
  if (paymentItems.length > 0) {
    categories.push({ label: "Payments", detail: `${payDone}/${paymentItems.length}` });
  }
  if (contracts.length > 0) {
    categories.push({ label: "Contracts", detail: `${contractDone}/${contracts.length}` });
  }
  if (qInScope) {
    categories.push({ label: "Questionnaire", detail: qDone ? "Done" : "Open" });
  }

  const supportingStatement = planningProgressSupportingStatement(percent);

  return {
    kind: "ready",
    percent,
    completed,
    total,
    categories,
    supportingStatement,
    sourceNote: PLANNING_PROGRESS_SOURCE_NOTE,
    accessibleLabel: `Planning Progress ${percent} percent complete. ${supportingStatement}`,
  };
}
