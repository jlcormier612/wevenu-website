/**
 * Couple Home — Planning Progress presentation.
 *
 * Option A — dual-layer card:
 *   PRIMARY (the %): venue readiness only —
 *     required venue tasks + payment line items + contracts + questionnaire
 *   SECONDARY (card state / copy / Review): unfinished couple work —
 *     owned vendor requests needing couple action, personal to-dos,
 *     and waiting-on-vendor (acked vendor_confirm) as non-action waiting.
 *
 * Secondary signals never enter the primary equal-item denominator and
 * must not cap readiness below an honest 100% when venue work is done.
 */

export type PlanningProgressTask = { status: string; isRequired?: boolean };
export type PlanningProgressPaymentLine = { status: string };
export type PlanningProgressContract = { status: string | null };
export type PlanningProgressQuestionnaire = { status: string } | null;
export type PlanningProgressPersonalTodo = { completed: boolean };

export type PlanningProgressCategory = {
  label: string;
  detail: string;
};

/** Where “Review what’s left” should send the couple — or wait-only (no fake action). */
export type PlanningProgressReviewDestination = "tasks" | "todos" | "waiting";

export type PlanningProgressReady = {
  kind: "ready";
  /** Displayed percent — honest primary readiness (never artificially capped). */
  percent: number;
  /** Same as percent; retained for callers that distinguish primary vs display. */
  primaryPercent: number;
  completed: number;
  total: number;
  venueReady: boolean;
  /**
   * True only when venue readiness is complete, there are no actionable
   * owned vendor requests (waiting-on-vendor does not block), and there are
   * no incomplete personal to-dos.
   */
  meaningfulComplete: boolean;
  personalIncompleteCount: number;
  /** Owned pending vendor requests — secondary Home attention only. */
  vendorOpenRequestCount: number;
  /** Subset still needing couple action (not waiting on vendor). */
  vendorCoupleActionCount: number;
  /** Subset acknowledged vendor_confirm — waiting on vendor. */
  vendorWaitingOnVendorCount: number;
  categories: PlanningProgressCategory[];
  /** Warm, hospitality-first line — not SaaS / health / productivity language. */
  supportingStatement: string;
  /** Quiet attribution of the composite inputs. */
  sourceNote: string;
  accessibleLabel: string;
  reviewDestination: PlanningProgressReviewDestination;
};

export type PlanningProgressEmpty = {
  kind: "empty";
  /** Encouraging setup copy — never a misleading 0%. */
  supportingStatement: string;
  sourceNote: string;
  accessibleLabel: string;
  reviewDestination: PlanningProgressReviewDestination;
};

export type PlanningProgressResult = PlanningProgressReady | PlanningProgressEmpty;

export const PLANNING_PROGRESS_SOURCE_NOTE =
  "Based on what your venue needs, payments, contracts, and your questionnaire.";

export const PLANNING_PROGRESS_SOURCE_NOTE_WITH_TODOS =
  "Based on what your venue needs, payments, contracts, your questionnaire, and your personal to-dos.";

export const PLANNING_PROGRESS_SOURCE_NOTE_WITH_VENDOR_REQUESTS =
  "Based on what your venue needs, payments, contracts, your questionnaire, and vendor requests.";

export const PLANNING_PROGRESS_SOURCE_NOTE_WITH_TODOS_AND_VENDOR_REQUESTS =
  "Based on what your venue needs, payments, contracts, your questionnaire, your personal to-dos, and vendor requests.";

export const PLANNING_PROGRESS_SETUP_STATEMENT =
  "Your planning story is just beginning — when your venue shares what’s needed, it will gently gather here.";

export const PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT =
  "Everything with your venue is beautifully in place.";

/**
 * Warm supporting line from the canonical readiness percent only.
 * Presentation copy — does not change the underlying calculation.
 * Reserved for incomplete / mid venue readiness bands — not secondary leftovers.
 */
export function planningProgressSupportingStatement(percent: number): string {
  if (percent >= 100) return PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT;
  if (percent >= 76) return "So close — the finishing details are falling into place.";
  if (percent >= 51) return "Your planning is coming together beautifully.";
  if (percent >= 26) return "You’re making real headway.";
  if (percent > 0) return "You’re off to a lovely start.";
  return "Every wedding begins somewhere — you’ve started the path.";
}

function personalPlanningStatement(incompleteCount: number): string {
  const n = incompleteCount;
  const noun = n === 1 ? "item" : "items";
  return `Venue requirements complete. You still have ${n} personal planning ${noun} to finish.`;
}

function vendorRequestsStatement(
  vendorOpen: number,
  waitingOnVendorCount: number,
  coupleActionCount: number,
): string {
  const noun = vendorOpen === 1 ? "request" : "requests";
  // Acknowledged vendor_confirm rows still count as open, but the couple
  // must not be told they need to act again.
  if (coupleActionCount === 0 && waitingOnVendorCount > 0) {
    return vendorOpen === 1
      ? "Venue requirements complete. Waiting for your vendor."
      : `Venue requirements complete. Waiting for your vendor on ${vendorOpen} ${noun}.`;
  }
  if (waitingOnVendorCount > 0 && coupleActionCount > 0) {
    const aNoun = coupleActionCount === 1 ? "request" : "requests";
    return `Venue requirements complete. You still have ${coupleActionCount} vendor ${aNoun} waiting for your attention, and you’re waiting on your vendor for ${waitingOnVendorCount}.`;
  }
  return `Venue requirements complete. You still have ${vendorOpen} vendor ${noun} waiting for your attention.`;
}

function vendorAndPersonalStatement(
  vendorOpen: number,
  personalIncomplete: number,
  waitingOnVendorCount: number,
  coupleActionCount: number,
): string {
  const pNoun = personalIncomplete === 1 ? "item" : "items";
  if (coupleActionCount === 0 && waitingOnVendorCount > 0) {
    const vNoun = vendorOpen === 1 ? "request" : "requests";
    return `Venue requirements complete. Waiting for your vendor on ${vendorOpen} vendor ${vNoun}, and you still have ${personalIncomplete} personal planning ${pNoun} to finish.`;
  }
  if (coupleActionCount > 0) {
    const aNoun = coupleActionCount === 1 ? "request" : "requests";
    return `Venue requirements complete. You still have ${coupleActionCount} vendor ${aNoun} and ${personalIncomplete} personal planning ${pNoun} to finish.`;
  }
  const vNoun = vendorOpen === 1 ? "request" : "requests";
  return `Venue requirements complete. You still have ${vendorOpen} vendor ${vNoun} and ${personalIncomplete} personal planning ${pNoun} to finish.`;
}

function planningProgressSourceNote(opts: {
  personalTotal: number;
  vendorOpenRequestCount: number;
}): string {
  const hasTodos = opts.personalTotal > 0;
  const hasVendor = opts.vendorOpenRequestCount > 0;
  if (hasTodos && hasVendor) return PLANNING_PROGRESS_SOURCE_NOTE_WITH_TODOS_AND_VENDOR_REQUESTS;
  if (hasVendor) return PLANNING_PROGRESS_SOURCE_NOTE_WITH_VENDOR_REQUESTS;
  if (hasTodos) return PLANNING_PROGRESS_SOURCE_NOTE_WITH_TODOS;
  return PLANNING_PROGRESS_SOURCE_NOTE;
}

function resolveReviewDestination(opts: {
  venueAttentionIncompleteCount: number;
  vendorCoupleActionCount: number;
  personalIncompleteCount: number;
  vendorWaitingOnVendorCount: number;
}): PlanningProgressReviewDestination {
  // venue attention → couple-action vendor → personal → waiting-only → tasks default
  if (opts.venueAttentionIncompleteCount > 0) return "tasks";
  if (opts.vendorCoupleActionCount > 0) return "tasks";
  if (opts.personalIncompleteCount > 0) return "todos";
  if (opts.vendorWaitingOnVendorCount > 0) return "waiting";
  return "tasks";
}

/**
 * Canonical Home operational progress.
 * Primary numerator/denominator matches Phase 1 WeddingPlanningProgressCard.
 * Vendor requests and personal to-dos are secondary signals only.
 */
export function computePlanningProgress(input: {
  /** Already filtered to required venue tasks (same as Phase 1 card). */
  requiredTasks: PlanningProgressTask[];
  paymentLineItems: PlanningProgressPaymentLine[];
  contracts: PlanningProgressContract[];
  questionnaire: PlanningProgressQuestionnaire;
  /** Couple personal checklist — durable couple_todos completion only. */
  personalTodos?: PlanningProgressPersonalTodo[];
  /**
   * Incomplete unified venue attention count (Your Next Steps / Tasks).
   * Used only to route “Review what’s left”, not for the percent.
   */
  venueAttentionIncompleteCount?: number;
  /**
   * Owned pending vendor_tasks (portal-eligible). Secondary chip + routing only —
   * never enters the primary denominator.
   */
  vendorOpenRequestCount?: number;
  /**
   * Subset of open vendor requests awaiting vendor confirmation
   * (owned + vendor_confirm + couple acknowledged). Used for copy + waiting route.
   */
  vendorWaitingOnVendorCount?: number;
}): PlanningProgressResult {
  const required = input.requiredTasks;
  const paymentItems = input.paymentLineItems;
  const contracts = input.contracts;
  const questionnaire = input.questionnaire;
  const personalTodos = input.personalTodos ?? [];
  const venueAttentionIncompleteCount = input.venueAttentionIncompleteCount ?? 0;
  const vendorOpenRequestCount = Math.max(0, input.vendorOpenRequestCount ?? 0);
  const vendorWaitingOnVendorCount = Math.min(
    vendorOpenRequestCount,
    Math.max(0, input.vendorWaitingOnVendorCount ?? 0),
  );
  const vendorCoupleActionCount = Math.max(
    0,
    vendorOpenRequestCount - vendorWaitingOnVendorCount,
  );

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

  const personalDone = personalTodos.filter((t) => t.completed).length;
  const personalTotal = personalTodos.length;
  const personalIncompleteCount = personalTotal - personalDone;
  const hasPersonalIncomplete = personalIncompleteCount > 0;
  const hasVendorOpen = vendorOpenRequestCount > 0;
  const hasVendorCoupleAction = vendorCoupleActionCount > 0;

  const reviewDestination = resolveReviewDestination({
    venueAttentionIncompleteCount,
    vendorCoupleActionCount,
    personalIncompleteCount,
    vendorWaitingOnVendorCount,
  });

  const sourceNote = planningProgressSourceNote({
    personalTotal,
    vendorOpenRequestCount,
  });

  if (total === 0) {
    return {
      kind: "empty",
      supportingStatement: PLANNING_PROGRESS_SETUP_STATEMENT,
      sourceNote,
      accessibleLabel:
        "Your Planning Progress. Not enough venue planning data yet to show a completion percentage.",
      reviewDestination,
    };
  }

  const primaryPercent = Math.round((completed / total) * 100);
  const venueReady = completed === total;
  // Option A: display honest primary readiness — never fake-cap below 100.
  const percent = primaryPercent;
  // Waiting-on-vendor is secondary/non-actionable — does not block meaningfulComplete.
  const meaningfulComplete =
    venueReady && !hasVendorCoupleAction && !hasPersonalIncomplete;

  const categories: PlanningProgressCategory[] = [];
  if (required.length > 0) {
    categories.push({ label: "Venue tasks", detail: `${reqDone}/${required.length}` });
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
  if (hasVendorOpen) {
    const vendorDetail =
      vendorCoupleActionCount === 0 && vendorWaitingOnVendorCount > 0
        ? `${vendorOpenRequestCount} waiting`
        : `${vendorOpenRequestCount} open`;
    categories.push({
      label: "Vendor requests",
      detail: vendorDetail,
    });
  }
  if (personalTotal > 0) {
    categories.push({
      label: "Your to-dos",
      detail: `${personalDone}/${personalTotal}`,
    });
  }

  let supportingStatement: string;
  if (meaningfulComplete) {
    // True completion-state language — venue ready, no couple action left
    // (waiting-on-vendor may still appear as a quiet secondary note in UI).
    supportingStatement = PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT;
  } else if (venueReady && hasVendorCoupleAction && hasPersonalIncomplete) {
    supportingStatement = vendorAndPersonalStatement(
      vendorOpenRequestCount,
      personalIncompleteCount,
      vendorWaitingOnVendorCount,
      vendorCoupleActionCount,
    );
  } else if (venueReady && hasVendorCoupleAction) {
    supportingStatement = vendorRequestsStatement(
      vendorOpenRequestCount,
      vendorWaitingOnVendorCount,
      vendorCoupleActionCount,
    );
  } else if (venueReady && hasPersonalIncomplete) {
    // Waiting-only + personal incomplete also lands here (no couple-action vendor).
    if (vendorWaitingOnVendorCount > 0 && !hasVendorCoupleAction) {
      supportingStatement = vendorAndPersonalStatement(
        vendorOpenRequestCount,
        personalIncompleteCount,
        vendorWaitingOnVendorCount,
        vendorCoupleActionCount,
      );
    } else {
      supportingStatement = personalPlanningStatement(personalIncompleteCount);
    }
  } else {
    supportingStatement = planningProgressSupportingStatement(percent);
  }

  return {
    kind: "ready",
    percent,
    primaryPercent,
    completed,
    total,
    venueReady,
    meaningfulComplete,
    personalIncompleteCount,
    vendorOpenRequestCount,
    vendorCoupleActionCount,
    vendorWaitingOnVendorCount,
    categories,
    supportingStatement,
    sourceNote,
    accessibleLabel: `Your Planning Progress ${percent} percent readiness. ${supportingStatement}`,
    reviewDestination,
  };
}

/** Count portal-eligible owned pending vendor requests for Home attention. */
export function countOwnedPendingVendorRequests(
  vendorTasks: Array<{ coupleVisibility: string; status: string }>,
): number {
  return vendorTasks.filter(
    (t) => t.coupleVisibility === "owned" && t.status !== "complete",
  ).length;
}

/** Owned vendor_confirm rows the couple already acknowledged (still open). */
export function countVendorRequestsWaitingOnVendor(
  vendorTasks: Array<{
    coupleVisibility: string;
    status: string;
    completionAuthority?: string | null;
    coupleAcknowledgedAt?: string | null;
  }>,
): number {
  return vendorTasks.filter(
    (t) =>
      t.coupleVisibility === "owned"
      && t.status !== "complete"
      && t.completionAuthority === "vendor_confirm"
      && Boolean(t.coupleAcknowledgedAt),
  ).length;
}

/**
 * Owned pending vendor requests that still need couple action
 * (excludes acknowledged vendor_confirm waiting on the vendor).
 */
export function countVendorRequestsNeedingCoupleAction(
  vendorTasks: Array<{
    coupleVisibility: string;
    status: string;
    completionAuthority?: string | null;
    coupleAcknowledgedAt?: string | null;
  }>,
): number {
  return Math.max(
    0,
    countOwnedPendingVendorRequests(vendorTasks)
      - countVendorRequestsWaitingOnVendor(vendorTasks),
  );
}
