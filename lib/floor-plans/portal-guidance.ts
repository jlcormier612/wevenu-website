/**
 * Compact, state-aware guidance for the couple Floor Plan portal.
 * Matches actual permissions and lifecycle — not generic tutorial copy.
 */
import {
  clientMayEditLayout,
  normalizeClientLayoutStatus,
  type ClientLayoutStatus,
} from "@/lib/floor-plans/client-layout-review";

export type PortalFloorPlanGuidance = {
  headline: string;
  detail: string;
  /** When false, hide the submit CTA (view-only / seating-only / locked). */
  showSubmitPrompt: boolean;
};

export function portalFloorPlanGuidance(input: {
  needsChooser: boolean;
  hasWorkingShared: boolean;
  hasSelectedWorking: boolean;
  clientLayoutStatus: ClientLayoutStatus | string | null | undefined;
  isReady: boolean;
  /** True when any unlocked object can be moved (shared plan + edit status). */
  furnitureEditingAllowed: boolean;
  coupleMayAddTables: boolean;
  seatingEnabled: boolean;
  proposedReplacementPending?: boolean;
}): PortalFloorPlanGuidance {
  if (input.needsChooser && !input.hasSelectedWorking) {
    return {
      headline: "Choose your starting layout",
      detail:
        "Your venue has prepared a few options for your celebration. Select the one that works best for you.",
      showSubmitPrompt: false,
    };
  }

  if (input.proposedReplacementPending) {
    return {
      headline: "Layout change requested",
      detail:
        "You asked to switch to another offered layout. Your venue will review that request. Your current approved arrangement stays in place until they accept a change.",
      showSubmitPrompt: false,
    };
  }

  if (input.isReady) {
    return {
      headline: "Layout is ready for your event",
      detail: input.seatingEnabled
        ? "Furniture placement is locked. You can still assign guests to tables while seating is open."
        : "Your venue marked this layout ready. Furniture placement is locked.",
      showSubmitPrompt: false,
    };
  }

  const status = normalizeClientLayoutStatus(input.clientLayoutStatus);

  if (status === "submitted") {
    return {
      headline: "Your layout is with your venue for review",
      detail:
        "We'll let you know when it's approved or if any adjustments are needed.",
      showSubmitPrompt: false,
    };
  }

  if (status === "changes_requested") {
    return {
      headline: "Your venue has requested a few adjustments",
      detail:
        "Review their notes, make your changes, and submit the updated layout.",
      showSubmitPrompt: input.furnitureEditingAllowed,
    };
  }

  if (status === "approved") {
    return {
      headline: "Your venue has approved this arrangement",
      detail: input.seatingEnabled
        ? "You can continue managing guest seating if your venue has enabled it."
        : "Furniture placement is locked. Seating opens when your venue enables it.",
      showSubmitPrompt: false,
    };
  }

  // working
  if (!input.hasWorkingShared) {
    return {
      headline: "Waiting on a layout from your venue",
      detail:
        "When your venue shares a floor plan for this event, it will appear here.",
      showSubmitPrompt: false,
    };
  }

  const mayEdit = clientMayEditLayout({
    clientLayoutStatus: status,
    isReady: input.isReady,
  }) && input.furnitureEditingAllowed;

  if (mayEdit) {
    const addBit = input.coupleMayAddTables
      ? " and add tables where permitted"
      : "";
    return {
      headline: "Make it yours",
      detail: `Move the unlocked tables and furniture${addBit}. Your changes save as you go. When you're happy with the arrangement, submit it to your venue for review.`,
      showSubmitPrompt: true,
    };
  }

  if (input.seatingEnabled) {
    return {
      headline: "Find a seat for everyone",
      detail:
        "Your venue has prepared the layout, and you can assign guests to tables as your plans come together.",
      showSubmitPrompt: false,
    };
  }

  return {
    headline: "Take a look around",
    detail:
      "Your venue has shared this layout so you can explore your event space. Furniture changes are managed by your venue.",
    showSubmitPrompt: false,
  };
}
