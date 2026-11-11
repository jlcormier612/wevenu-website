/**
 * Booked Client setup decisions and Overview exceptions.
 * Pure: does not read module tables and does not treat an empty module as late.
 */
import {
  isCapabilityEnabled,
  type PlanningCapabilityId,
  type VenuePlanningCapabilities,
} from "@/lib/playbooks/capabilities";
import type { ReadinessNavTarget, ReadinessSection } from "@/lib/readiness/types";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";

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

export type SetupDecisionSource = "profile" | "event" | "unset";

/**
 * When usesProfile is true, the event inherited a snapshot.
 * Effective decision = override, else inherited snapshot.
 * decisions is the no-profile path and is not a copy of the profile.
 */
export type EventSetupState = {
  decisions: SetupDecisions;
  collapsedAt: string | null;
  usesProfile?: boolean;
  profileId?: string | null;
  profileName?: string | null;
  inheritedDecisions?: SetupDecisions;
  /** Book-time profile template_refs. Immutable. Not applied artifacts. */
  inheritedTemplateRefs?: SetupTemplateRefs;
  overrides?: SetupDecisions;
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

/** How Overview presents one setup row. Derived only from the persisted decision. */
export type SetupStepPresentation = "needs_decision" | "included" | "skipped";

export function setupStepPresentation(
  decision: SetupDecision | null | undefined,
): SetupStepPresentation {
  if (decision === "set_up") return "included";
  if (decision === "skipped") return "skipped";
  return "needs_decision";
}

export const SETUP_PRESENTATION_LABEL: Record<SetupStepPresentation, string> = {
  needs_decision: "Needs a decision",
  included: "Included",
  skipped: "Not included",
};

export function setupDecisionCounts(
  applicable: readonly SetupStepKey[],
  decisions: SetupDecisions,
): { needsDecision: number; included: number; skipped: number } {
  let needsDecision = 0;
  let included = 0;
  let skipped = 0;
  for (const step of applicable) {
    const presentation = setupStepPresentation(decisions[step]);
    if (presentation === "included") included += 1;
    else if (presentation === "skipped") skipped += 1;
    else needsDecision += 1;
  }
  return { needsDecision, included, skipped };
}

export function emptyEventSetupState(): EventSetupState {
  return {
    decisions: {},
    collapsedAt: null,
    usesProfile: false,
    profileId: null,
    profileName: null,
    inheritedDecisions: {},
    inheritedTemplateRefs: {},
    overrides: {},
  };
}

export function effectiveDecisionMap(state: EventSetupState): SetupDecisions {
  if (!state.usesProfile) return state.decisions;
  const out: SetupDecisions = {};
  const inherited = state.inheritedDecisions ?? {};
  const overrides = state.overrides ?? {};
  const keys = new Set<string>([...Object.keys(inherited), ...Object.keys(overrides)]);
  for (const key of keys) {
    if (!isSetupStepKey(key)) continue;
    const chosen = overrides[key] ?? inherited[key];
    if (chosen === "set_up" || chosen === "skipped") out[key] = chosen;
  }
  return out;
}

export function setupStepSource(state: EventSetupState, step: SetupStepKey): SetupDecisionSource {
  if (!state.usesProfile) return state.decisions[step] ? "event" : "unset";
  if (state.overrides?.[step]) return "event";
  if (state.inheritedDecisions?.[step]) return "profile";
  return "unset";
}

export function effectiveSetupDecision(state: EventSetupState, step: SetupStepKey): SetupDecision | undefined {
  return effectiveDecisionMap(state)[step];
}

/** Map a Setup Profile / Event Setup step to its venue-wide capability. */
export function setupStepCapability(step: SetupStepKey): PlanningCapabilityId | null {
  switch (step) {
    case "planning":
      return "checklists";
    case "timeline":
      return "timeline";
    case "floor_plans":
      return "floor_plan";
    case "vendors":
      return "vendors";
    case "inventory":
      return "inventory";
    case "event_order":
      return "event_order";
    case "questionnaires":
      return "questionnaires";
    case "portal":
      return null;
  }
}

/**
 * Steps offered by Setup Profiles / Event Setup for the venue's enabled
 * capabilities. Commercial Inventory / Event Order capabilities remain
 * venue-wide for their own workspaces but are never Setup steps.
 */
export function applicableSetupSteps(caps: VenuePlanningCapabilities): SetupStepKey[] {
  return SETUP_STEP_ORDER.filter((step) => {
    if (step === "portal") return false;
    if (isCommercialSetupStep(step)) return false;
    const capability = setupStepCapability(step);
    if (!capability) return true;
    return isCapabilityEnabled(caps, capability);
  });
}

/**
 * Commercial steps that remain valid SetupStepKey values for historical
 * snapshots / parsing, but are never part of the Setup experience.
 * Inventory and Event Order run only from the event commercial workspace.
 */
export const COMMERCIAL_SETUP_STEPS = ["inventory", "event_order"] as const;

export function isCommercialSetupStep(step: SetupStepKey): boolean {
  return step === "inventory" || step === "event_order";
}

/**
 * Setup Profile + Event Setup experience — planning, timeline, floor plans,
 * vendors only. Questionnaires stay a separate authorized-send workspace.
 * Inventory / Event Order are commercial and must not appear here.
 */
export function setupExperienceSteps(applicable: readonly SetupStepKey[]): SetupStepKey[] {
  return applicable.filter(
    (step) => step !== "questionnaires" && !isCommercialSetupStep(step),
  );
}

/**
 * Overview Event Setup cards / settle decisions — same as setup experience
 * (no questionnaires, no commercial Inventory/Event Order rows).
 */
export function overviewSetupSteps(applicable: readonly SetupStepKey[]): SetupStepKey[] {
  return setupExperienceSteps(applicable);
}

export function isSetupStepKey(value: string): value is SetupStepKey {
  return (SETUP_STEP_ORDER as readonly string[]).includes(value);
}

export function undecidedSetupSteps(applicable: readonly SetupStepKey[], decisions: SetupDecisions): SetupStepKey[] {
  return applicable.filter((step) => decisions[step] !== "set_up" && decisions[step] !== "skipped");
}

export function setupDecisionsComplete(applicable: readonly SetupStepKey[], decisions: SetupDecisions): boolean {
  return undecidedSetupSteps(applicable, decisions).length === 0;
}

/**
 * Record one explicit decision. Collapse only on the transition into
 * "every applicable step has a decision". Reopening is a separate call.
 */
export function withSetupDecision(
  state: EventSetupState,
  applicable: readonly SetupStepKey[],
  step: SetupStepKey,
  decision: SetupDecision,
): EventSetupState {
  if (!applicable.includes(step)) return state;
  const wasComplete = setupDecisionsComplete(applicable, effectiveDecisionMap(state));
  const decisions: SetupDecisions = { ...state.decisions, [step]: decision };
  const nowComplete = setupDecisionsComplete(applicable, state.usesProfile
    ? effectiveDecisionMap({ ...state, decisions })
    : decisions);
  return {
    ...state,
    decisions,
    collapsedAt: !wasComplete && nowComplete ? new Date().toISOString() : state.collapsedAt,
  };
}

/** Event-only exception. Matching the inherited snapshot removes the override. */
export function withProfileOverride(
  state: EventSetupState,
  applicable: readonly SetupStepKey[],
  step: SetupStepKey,
  decision: SetupDecision,
): EventSetupState {
  if (!applicable.includes(step) || !state.usesProfile) return state;
  const wasComplete = setupDecisionsComplete(applicable, effectiveDecisionMap(state));
  const overrides: SetupDecisions = { ...(state.overrides ?? {}) };
  if (state.inheritedDecisions?.[step] === decision) delete overrides[step];
  else overrides[step] = decision;
  const next: EventSetupState = { ...state, overrides };
  const nowComplete = setupDecisionsComplete(applicable, effectiveDecisionMap(next));
  return {
    ...next,
    collapsedAt: !wasComplete && nowComplete ? new Date().toISOString() : state.collapsedAt,
  };
}

export function withSetupReopened(state: EventSetupState): EventSetupState {
  return { ...state, collapsedAt: null };
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
