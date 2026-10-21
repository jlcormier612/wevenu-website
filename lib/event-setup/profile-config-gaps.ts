/**
 * Setup Profile honesty — which Included steps are missing the configuration
 * they need to prepare event artifacts.
 *
 * Not every Included step requires a template:
 * - Preferred Vendors uses the Vendor Network by default; recommendations are optional.
 * - Inventory / Event Order are references only (never auto-created on book); a
 *   missing starting offering is a soft gap (manual start on the event), not a
 *   hard block unless the venue claims a specific offering id that is absent.
 *
 * Hard gaps (block save / surface as incomplete on the profile):
 * - Planning Included → client planning checklist id required
 * - Timeline Included → default timeline template id required
 * - Floor plans Included → at least one floor-plan template (preferred or list)
 * - Questionnaires Included → at least one questionnaire template id
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

/** Soft gaps for inventory/EO: Included without a starting offering reference. */
export function profileSoftConfigGaps(
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
): ProfileConfigGap[] {
  const gaps: ProfileConfigGap[] = [];
  if (decisions.inventory === "set_up" && !hasId(refs.inventoryTemplateId)) {
    gaps.push({
      step: "inventory",
      severity: "soft",
      message:
        "Inventory is Included without a starting offering. Booking will not create inventory — start it on the event when ready.",
    });
  }
  if (decisions.event_order === "set_up" && !hasId(refs.eventOrderTemplateId)) {
    gaps.push({
      step: "event_order",
      severity: "soft",
      message:
        "Event Order is Included without a starting package. Booking will not create an Event Order — apply one on the event when ready.",
    });
  }
  return gaps;
}

/** Hard gaps — Included claim without the template the auto-prepare path needs. */
export function profileHardConfigGaps(
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
): ProfileConfigGap[] {
  const gaps: ProfileConfigGap[] = [];
  if (decisions.planning === "set_up" && !hasId(refs.planningPlaybookTemplateId)) {
    gaps.push({
      step: "planning",
      severity: "hard",
      message: "Client Planning is Included but no starting client checklist is selected.",
    });
  }
  if (decisions.timeline === "set_up" && !hasId(refs.timelineTemplateId)) {
    gaps.push({
      step: "timeline",
      severity: "hard",
      message: "Timeline is Included but no starting timeline template is selected.",
    });
  }
  if (
    decisions.floor_plans === "set_up"
    && !hasId(refs.defaultFloorPlanTemplateId)
    && !hasIds(refs.floorPlanTemplateIds)
  ) {
    gaps.push({
      step: "floor_plans",
      severity: "hard",
      message: "Floor plans are Included but no layout template is selected to offer.",
    });
  }
  if (decisions.questionnaires === "set_up" && !hasIds(refs.questionnaireTemplateIds)) {
    gaps.push({
      step: "questionnaires",
      severity: "hard",
      message: "Questionnaires are Included but no questionnaire templates are selected to prepare as drafts.",
    });
  }
  return gaps;
}

export function profileConfigGaps(
  decisions: SetupDecisions,
  refs: SetupTemplateRefs,
): ProfileConfigGap[] {
  return [...profileHardConfigGaps(decisions, refs), ...profileSoftConfigGaps(decisions, refs)];
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
): boolean {
  return profileHardConfigGaps(decisions, refs).length === 0;
}
