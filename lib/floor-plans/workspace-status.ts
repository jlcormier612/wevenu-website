/**
 * Floor Plans tab presentation helpers. Read-only — no lifecycle decisions.
 */
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";
import { normalizeClientLayoutStatus } from "@/lib/floor-plans/client-layout-review";
import type { FloorPlan } from "@/lib/floor-plans/types";

/** Compact venue workspace next-step sentence (B2 vocabulary). */
export function venueFloorPlanNextStep(input: {
  couplePreferenceStatus: string | null | undefined;
  workingPlan: Pick<FloorPlan, "clientLayoutStatus" | "finalizedAt" | "name"> | null;
}): { badge: string; nextStep: string } {
  if (input.couplePreferenceStatus === "proposed_replacement") {
    return {
      badge: "Replacement requested",
      nextStep: "Your couple has requested a different layout.",
    };
  }
  const working = input.workingPlan;
  if (working?.finalizedAt) {
    return {
      badge: "Ready",
      nextStep: "This arrangement is finalized. Choose Make Changes to reopen editing.",
    };
  }
  const status = working
    ? normalizeClientLayoutStatus(working.clientLayoutStatus)
    : "working";
  if (status === "submitted") {
    return {
      badge: "Awaiting Review",
      nextStep: "Your couple has submitted a layout for your review.",
    };
  }
  if (status === "approved") {
    return {
      badge: "Approved",
      nextStep: "You've approved this arrangement. Mark it Ready when everything is finalized.",
    };
  }
  if (status === "changes_requested") {
    return {
      badge: "Changes requested",
      nextStep: "Waiting for your couple to update their layout and send it back.",
    };
  }
  return {
    badge: "Working",
    nextStep: "Your layout is ready to edit and share.",
  };
}

/**
 * Venue action card appears for proposed replacements, seating-in-use conflicts,
 * or errors — not for ordinary applied selections that need no follow-up.
 */
export function preferenceReviewIsActionable(input: {
  status: string | null;
  hasPreferred: boolean;
  multipleSeated: boolean;
  hasError: boolean;
  needsSeatingResolution?: boolean;
}): boolean {
  return (
    input.hasError
    || input.multipleSeated
    || input.needsSeatingResolution === true
    || (input.status === "proposed_replacement" && input.hasPreferred)
  );
}

/** Case B: working plan changed but seats (and seating-in-use) remain on a prior plan. */
export function needsSeatingHostResolution(input: {
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  operationalSeatCount: number;
  seatingInUseSeatCount: number;
}): boolean {
  if (!input.operationalFloorPlanId || !input.seatingInUseFloorPlanId) return false;
  if (input.operationalFloorPlanId === input.seatingInUseFloorPlanId) return false;
  return input.seatingInUseSeatCount > 0 && input.operationalSeatCount === 0;
}

export type OfferedLayoutView = { id: string; label: string; isCouplePick: boolean };

/** Offered Library layouts, marking the one the couple picked (matched by source template). */
export function offeredLayoutsView(
  offers: EventFloorPlanOfferWithTemplate[],
  floorPlans: Pick<FloorPlan, "id" | "sourceTemplateId">[],
  coupleSelectedFloorPlanId: string | null,
): OfferedLayoutView[] {
  const pickTemplateId = coupleSelectedFloorPlanId
    ? floorPlans.find((p) => p.id === coupleSelectedFloorPlanId)?.sourceTemplateId ?? null
    : null;
  return offers
    .filter((o) => o.isOffered)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      id: o.id,
      label: o.coupleLabel?.trim() || o.templateName,
      isCouplePick: pickTemplateId !== null && o.floorPlanTemplateId === pickTemplateId,
    }));
}
