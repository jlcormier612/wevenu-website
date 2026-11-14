/**
 * Compact, state-aware guidance for the couple Floor Plan portal.
 * Matches actual permissions and lifecycle — exact CX copy from the
 * Floor Plans prescriptive UX brief (not generic tutorial copy).
 */
import {
  clientMayEditLayout,
  normalizeClientLayoutStatus,
  type ClientLayoutStatus,
} from "@/lib/floor-plans/client-layout-review";

export type PortalFloorPlanGuidance = {
  /** Single short contextual instruction under the header. */
  instruction: string;
  /**
   * Short status-oriented phrase retained for callers/tests that still read
   * `headline` — mirrors the instruction’s state without duplicating a second card.
   */
  headline: string;
  /** Alias of `instruction` for older call sites. */
  detail: string;
  /** When false, hide the submit CTA (view-only / seating-only / locked). */
  showSubmitPrompt: boolean;
  /** Collapsed “How to edit your layout” — omit when the couple cannot edit. */
  showEditingHelp: boolean;
  /** Clear route to Guest Seating when furniture is locked but seating is open. */
  showGuestSeatingRoute: boolean;
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
  const base = (
    instruction: string,
    opts: {
      showSubmitPrompt?: boolean;
      showEditingHelp?: boolean;
      showGuestSeatingRoute?: boolean;
      headline?: string;
    } = {},
  ): PortalFloorPlanGuidance => ({
    instruction,
    headline: opts.headline ?? instruction,
    detail: instruction,
    showSubmitPrompt: opts.showSubmitPrompt ?? false,
    showEditingHelp: opts.showEditingHelp ?? false,
    showGuestSeatingRoute: opts.showGuestSeatingRoute ?? false,
  });

  // Review / Ready / pending replacement outrank the initial chooser so an
  // in-flight or finalized arrangement never shows "choose your starting layout".
  if (input.proposedReplacementPending) {
    return base(
      "Your venue is reviewing your request. Your current approved floor plan remains unchanged.",
      { headline: "Replacement requested" },
    );
  }

  if (input.isReady) {
    if (input.seatingEnabled) {
      return base(
        "Your floor plan is ready! You can still manage guest seating if your venue has enabled it.",
        {
          headline: "Ready",
          showGuestSeatingRoute: true,
        },
      );
    }
    return base("Your floor plan is ready!", { headline: "Ready" });
  }

  const status = normalizeClientLayoutStatus(input.clientLayoutStatus);

  if (status === "submitted") {
    return base(
      "Your layout is with your venue for review. We'll let you know when it's ready.",
      { headline: "Submitted for review" },
    );
  }

  if (status === "changes_requested") {
    const mayEdit =
      clientMayEditLayout({
        clientLayoutStatus: status,
        isReady: input.isReady,
      }) && input.furnitureEditingAllowed;
    return base(
      "Your venue has requested a few changes. Update your layout and send it back for review.",
      {
        headline: "Changes requested",
        showSubmitPrompt: mayEdit,
        showEditingHelp: mayEdit,
      },
    );
  }

  if (status === "approved") {
    if (input.seatingEnabled) {
      return base("Your venue has approved this arrangement.", {
        headline: "Approved arrangement",
        showGuestSeatingRoute: true,
      });
    }
    return base("Your venue has approved this arrangement.", {
      headline: "Approved arrangement",
    });
  }

  if (input.needsChooser && !input.hasSelectedWorking) {
    return base(
      "Your venue has prepared a few options for your celebration. Select the one that works best for you.",
      { headline: "Choose your starting layout" },
    );
  }

  // working
  if (!input.hasWorkingShared) {
    return base(
      "Your venue hasn't shared a floor plan yet. Once one is available, you'll find it here.",
      { headline: "Your Floor Plan" },
    );
  }

  const mayEdit =
    clientMayEditLayout({
      clientLayoutStatus: status,
      isReady: input.isReady,
    }) && input.furnitureEditingAllowed;

  if (mayEdit) {
    return base(
      "Arrange your layout, save your changes, and send it to your venue when you're ready.",
      {
        headline: "Working",
        showSubmitPrompt: true,
        showEditingHelp: true,
      },
    );
  }

  if (input.seatingEnabled) {
    return base(
      "Your layout is set. You can arrange your guests in Guest Seating.",
      {
        headline: "Layout set",
        showGuestSeatingRoute: true,
      },
    );
  }

  return base("Here's the layout your venue has shared with you.", {
    headline: "Shared layout",
  });
}

/** Editing-help bullets that match effective permissions only. */
export function portalFloorPlanEditingHelpItems(input: {
  furnitureEditingAllowed: boolean;
  coupleMayAddTables: boolean;
  canSubmit: boolean;
}): string[] {
  if (!input.furnitureEditingAllowed) return [];
  const items: string[] = [
    "Drag unlocked furniture to rearrange your layout. Locked items stay where your venue placed them.",
  ];
  if (input.coupleMayAddTables) {
    items.push("Add tables from the catalog when your venue permits it.");
  }
  items.push("Your changes save as you go.");
  if (input.canSubmit) {
    items.push("When you're happy with the arrangement, send it to your venue for review.");
  }
  return items;
}
