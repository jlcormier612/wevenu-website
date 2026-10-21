/**
 * Setup Profile honesty — which Included steps are missing the configuration
 * they need to prepare event artifacts.
 *
 * Not every Included step requires a template:
 * - Preferred Vendors uses the Vendor Network by default; recommendations are optional.
 *
 * Hard gaps (block save / surface as incomplete on the profile):
 * - Planning Included → client checklist AND venue/internal checklist ids required
 * - Timeline Included → default timeline template id required
 * - Floor plans Included → at least one floor-plan template (preferred or list)
 * - Questionnaires Included → at least one questionnaire template id
 * - Inventory Included → starting inventory offering id required
 * - Event Order Included → starting Event Order package id required
 *
 * A saved profile with these refs is the complete standard starting setup.
 * Booking instantiates event-level content from the selected templates.
 */

import { setupStepLabel, type SetupDecisions, type SetupStepKey } from "@/lib/event-setup/state";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";

export type ProfileConfigGap = {
  step: SetupStepKey;
  severity: "hard" | "soft";
  message: string;
};

function hasId(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasIds(values: string[] | null | undefined): boolean {
  return (values ?? []).some((id) => hasId(id));
}

/**
 * Soft gaps are reserved for non-blocking guidance.
 * Inventory and Event Order incomplete refs are hard gaps (Phase 4).
 */
export function profileSoftConfigGaps(
  _decisions: SetupDecisions,
  _refs: SetupTemplateRefs,
): ProfileConfigGap[] {
  return [];
}

/** Hard gaps — Included claim without the template the profile needs. */
export function profileHardConfigGaps(
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
  applicable?: readonly SetupStepKey[],
): ProfileConfigGap[] {
  const offered = applicable ? new Set(applicable) : null;
  const include = (step: SetupStepKey) => !offered || offered.has(step);
  const gaps: ProfileConfigGap[] = [];
  if (include("planning") && decisions.planning === "set_up") {
    const missingClient = !hasId(refs.planningPlaybookTemplateId);
    const missingVenue = !hasId(refs.venuePlanningPlaybookTemplateId);
    if (missingClient && missingVenue) {
      gaps.push({
        step: "planning",
        severity: "hard",
        message:
          "Planning is Included but starting client and venue/internal checklists are not selected.",
      });
    } else if (missingClient) {
      gaps.push({
        step: "planning",
        severity: "hard",
        message: "Planning is Included but no starting client checklist is selected.",
      });
    } else if (missingVenue) {
      gaps.push({
        step: "planning",
        severity: "hard",
        message: "Planning is Included but no starting venue/internal checklist is selected.",
      });
    }
  }
  if (include("timeline") && decisions.timeline === "set_up" && !hasId(refs.timelineTemplateId)) {
    gaps.push({
      step: "timeline",
      severity: "hard",
      message: "Timeline is Included but no starting timeline template is selected.",
    });
  }
  if (
    include("floor_plans")
    && decisions.floor_plans === "set_up"
    && !hasId(refs.defaultFloorPlanTemplateId)
    && !hasIds(refs.floorPlanTemplateIds)
  ) {
    gaps.push({
      step: "floor_plans",
      severity: "hard",
      message: "Floor plans are Included but no layout template is selected to offer.",
    });
  }
  if (
    include("questionnaires")
    && decisions.questionnaires === "set_up"
    && !hasIds(refs.questionnaireTemplateIds)
  ) {
    gaps.push({
      step: "questionnaires",
      severity: "hard",
      message: "Questionnaires are Included but no questionnaire templates are selected to prepare as drafts.",
    });
  }
  if (include("inventory") && decisions.inventory === "set_up" && !hasId(refs.inventoryTemplateId)) {
    gaps.push({
      step: "inventory",
      severity: "hard",
      message:
        "Inventory is Included but no starting offering is selected. Choose a template, or mark Not included.",
    });
  }
  if (
    include("event_order")
    && decisions.event_order === "set_up"
    && !hasId(refs.eventOrderTemplateId)
  ) {
    gaps.push({
      step: "event_order",
      severity: "hard",
      message:
        "Event Order is Included but no starting package is selected. Choose a template, or mark Not included.",
    });
  }
  return gaps;
}

export function profileConfigGaps(
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
  applicable?: readonly SetupStepKey[],
): ProfileConfigGap[] {
  return [
    ...profileHardConfigGaps(decisions, refs, applicable),
    ...profileSoftConfigGaps(decisions, refs),
  ];
}

export function profileHardGapSummary(gaps: ProfileConfigGap[]): string | null {
  const hard = gaps.filter((g) => g.severity === "hard");
  if (hard.length === 0) return null;
  if (hard.length === 1) return hard[0]!.message;
  const labels = hard.map((g) => setupStepLabel(g.step)).join(", ");
  return `Finish selecting templates for: ${labels}.`;
}

export function profileIsHonestlyConfigured(
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
  applicable?: readonly SetupStepKey[],
): boolean {
  return profileHardConfigGaps(decisions, refs, applicable).length === 0;
}

/** True when an Included Inventory/Event Order step still lacks its starting template. */
export function profileTemplateRefIncomplete(
  step: "inventory" | "event_order",
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
): boolean {
  if (step === "inventory") {
    return decisions.inventory === "set_up" && !hasId(refs.inventoryTemplateId);
  }
  return decisions.event_order === "set_up" && !hasId(refs.eventOrderTemplateId);
}
