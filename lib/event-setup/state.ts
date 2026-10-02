/**
 * Booked Client setup decisions and Overview exceptions.
 * Pure: does not read module tables and does not treat an empty module as late.
 */
import type { VenuePlanningCapabilities } from "@/lib/playbooks/capabilities";
import type { ReadinessNavTarget, ReadinessSection } from "@/lib/readiness/types";

export const SETUP_STEP_ORDER = [
  "planning",
  "timeline",
  "floor_plans",
  "vendors",
  "questionnaires",
  "inventory",
  "event_order",
  "portal",
] as const;

export type SetupStepKey = (typeof SETUP_STEP_ORDER)[number];
export type SetupDecision = "set_up" | "skipped";
export type SetupDecisions = Partial<Record<SetupStepKey, SetupDecision>>;

export type EventSetupState = {
  decisions: SetupDecisions;
  collapsedAt: string | null;
};

export type OverviewException = {
  key: string;
  label: string;
  detail: string;
  nav: ReadinessNavTarget;
};

const STEP_LABEL: Record<SetupStepKey, string> = {
  planning: "Planning",
  timeline: "Timeline",
  floor_plans: "Floor plans",
  vendors: "Vendors",
  questionnaires: "Questionnaires",
  inventory: "Inventory",
  event_order: "Event order",
  portal: "Client portal",
};

const EXCEPTION_KEYS = new Set([
  "planning",
  "payments",
  "requests",
  "documents",
  "communication",
  "seating",
  "floorplans",
]);

export function setupStepLabel(step: SetupStepKey): string {
  return STEP_LABEL[step];
}

export function emptyEventSetupState(): EventSetupState {
  return { decisions: {}, collapsedAt: null };
}

/** Venue capability off means the step is not offered. On does not mean this event must use it. */
export function applicableSetupSteps(caps: VenuePlanningCapabilities): SetupStepKey[] {
  return SETUP_STEP_ORDER.filter((step) => {
    if (step === "timeline") return caps.timeline;
    if (step === "floor_plans") return caps.floorPlan;
    if (step === "vendors") return caps.vendors;
    return true;
  });
}

export function isSetupStepKey(value: string): value is SetupStepKey {
  return (SETUP_STEP_ORDER as readonly string[]).includes(value);
}

export function undecidedSetupSteps(applicable: SetupStepKey[], decisions: SetupDecisions): SetupStepKey[] {
  return applicable.filter((step) => decisions[step] !== "set_up" && decisions[step] !== "skipped");
}

export function setupDecisionsComplete(applicable: SetupStepKey[], decisions: SetupDecisions): boolean {
  return undecidedSetupSteps(applicable, decisions).length === 0;
}

/**
 * Record one explicit decision. Collapse only on the transition into
 * "every applicable step has a decision". Reopening is a separate call.
 */
export function withSetupDecision(
  state: EventSetupState,
  applicable: SetupStepKey[],
  step: SetupStepKey,
  decision: SetupDecision,
): EventSetupState {
  if (!applicable.includes(step)) return state;
  const wasComplete = setupDecisionsComplete(applicable, state.decisions);
  const decisions: SetupDecisions = { ...state.decisions, [step]: decision };
  const nowComplete = setupDecisionsComplete(applicable, decisions);
  return {
    decisions,
    collapsedAt: !wasComplete && nowComplete ? new Date().toISOString() : state.collapsedAt,
  };
}

export function withSetupReopened(state: EventSetupState): EventSetupState {
  return { decisions: state.decisions, collapsedAt: null };
}

export function withSetupCollapsed(state: EventSetupState): EventSetupState {
  if (state.collapsedAt) return state;
  return { ...state, collapsedAt: new Date().toISOString() };
}

type QuestionnaireExceptionInput = {
  id: string;
  kind: string;
  status: string;
};

const QUESTIONNAIRE_KIND_LABEL: Record<string, string> = {
  client_planning: "Client Planning Questionnaire",
  final_details: "Final Details",
  post_event_feedback: "Post-Event Feedback",
};

/**
 * Client Overview exceptions only. Does not change buildEventReadiness.
 * Empty modules (not started / complete / generic waiting) stay off the list.
 * Documents waiting means an authoritative expiry inside 30 days.
 */
export function selectOverviewExceptions(
  sections: ReadinessSection[],
  questionnaires: QuestionnaireExceptionInput[] = [],
): OverviewException[] {
  const fromReadiness: OverviewException[] = [];
  for (const section of sections) {
    if (!EXCEPTION_KEYS.has(section.key)) continue;
    const actionable = section.status === "needs_attention"
      || (section.key === "documents" && section.status === "waiting");
    if (!actionable) continue;
    const nav = section.key === "requests"
      ? { kind: "link" as const, href: "/requests" }
      : section.nav;
    fromReadiness.push({
      key: section.key,
      label: section.label,
      detail: section.detail,
      nav,
    });
  }

  const reviews: OverviewException[] = questionnaires
    .filter((q) => q.status === "submitted" || q.status === "resubmitted")
    .map((q) => ({
      key: `questionnaire:${q.id}`,
      label: QUESTIONNAIRE_KIND_LABEL[q.kind] ?? "Questionnaire",
      detail: q.status === "resubmitted" ? "Resubmitted · waiting on you" : "Submitted · waiting on you",
      nav: { kind: "tab" as const, tab: "questionnaires" },
    }));

  return [...fromReadiness, ...reviews];
}
