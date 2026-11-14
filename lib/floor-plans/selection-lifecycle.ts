/**
 * Floor Plans — layout selection (not furniture approval).
 *
 * Offering a layout is venue approval that the option is appropriate.
 * Couple selection establishes the working plan without Approve/Decline/Defer.
 * After a physical arrangement is approved, a different offer is a proposed
 * replacement that requires venue review — it must not silently replace the
 * approved operational arrangement.
 *
 * Seating Case A/B/C protections are preserved; assignment rows are never rewritten.
 */
import {
  classifyPreferenceApprovalCase,
  type PreferenceApprovalCase,
} from "@/lib/floor-plans/preference-lifecycle";
import { normalizeClientLayoutStatus } from "@/lib/floor-plans/client-layout-review";

export const SELECTION_STATUSES = [
  "applied",
  "proposed_replacement",
  // Legacy preference statuses retained for historical rows / setups.
  "pending",
  "approved",
  "declined",
  "deferred",
  "withdrawn",
  "superseded",
] as const;

export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export type LayoutSelectOutcome =
  | {
      mode: "establish_working";
      seatingCase: PreferenceApprovalCase;
      operationalFloorPlanId: string;
      seatingInUseFloorPlanId: string | null;
      selectionStatus: "applied";
      needsSeatingResolution: boolean;
    }
  | {
      mode: "proposed_replacement";
      selectionStatus: "proposed_replacement";
      proposedFloorPlanId: string;
      operationalFloorPlanId: string;
    }
  | { mode: "noop"; reason: "already_selected" };

/** True when the current working plan already has an approved physical arrangement. */
export function workingPlanHasApprovedArrangement(input: {
  operationalClientLayoutStatus: string | null | undefined;
  hasApprovedRevision: boolean;
}): boolean {
  if (input.hasApprovedRevision) return true;
  return normalizeClientLayoutStatus(input.operationalClientLayoutStatus) === "approved";
}

/**
 * Pure decision for couple offer selection.
 * Never mutates seating assignment rows; only returns pointer updates.
 */
export function nextStateAfterLayoutSelect(input: {
  selectedFloorPlanId: string;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  operationalClientLayoutStatus: string | null | undefined;
  hasApprovedRevisionOnOperational: boolean;
  currentHasSeats: boolean;
  selectedHasSeats: boolean;
  previousSelectedFloorPlanId: string | null;
}): LayoutSelectOutcome {
  if (
    input.previousSelectedFloorPlanId === input.selectedFloorPlanId
    && input.operationalFloorPlanId === input.selectedFloorPlanId
    && !workingPlanHasApprovedArrangement({
      operationalClientLayoutStatus: input.operationalClientLayoutStatus,
      hasApprovedRevision: input.hasApprovedRevisionOnOperational,
    })
  ) {
    return { mode: "noop", reason: "already_selected" };
  }

  const approvedLocked = workingPlanHasApprovedArrangement({
    operationalClientLayoutStatus: input.operationalClientLayoutStatus,
    hasApprovedRevision: input.hasApprovedRevisionOnOperational,
  });

  // After furniture approval: switching offers proposes a replacement.
  if (
    approvedLocked
    && input.operationalFloorPlanId
    && input.operationalFloorPlanId !== input.selectedFloorPlanId
  ) {
    return {
      mode: "proposed_replacement",
      selectionStatus: "proposed_replacement",
      proposedFloorPlanId: input.selectedFloorPlanId,
      operationalFloorPlanId: input.operationalFloorPlanId,
    };
  }

  const seatingCase = classifyPreferenceApprovalCase({
    currentOperationalId: input.operationalFloorPlanId,
    preferredId: input.selectedFloorPlanId,
    currentHasSeats: input.currentHasSeats,
    preferredHasSeats: input.selectedHasSeats,
  });

  let seatingInUse = input.seatingInUseFloorPlanId;

  if (seatingCase === "B" || seatingCase === "C") {
    // Do not silently change seating-in-use. Assignment rows stay on their plans.
    // Venue (or explicit seating-in-use control) must resolve deliberately.
    if (!seatingInUse && input.operationalFloorPlanId && input.currentHasSeats) {
      seatingInUse = input.operationalFloorPlanId;
    }
  } else if (!seatingInUse && input.selectedHasSeats) {
    seatingInUse = input.selectedFloorPlanId;
  }

  return {
    mode: "establish_working",
    seatingCase,
    operationalFloorPlanId: input.selectedFloorPlanId,
    seatingInUseFloorPlanId: seatingInUse,
    selectionStatus: "applied",
    needsSeatingResolution: seatingCase === "B" || seatingCase === "C",
  };
}

/** Venue accepts a proposed layout replacement after furniture was approved. */
export function nextStateAfterAcceptProposedReplacement(input: {
  proposedFloorPlanId: string;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  currentHasSeats: boolean;
  proposedHasSeats: boolean;
  seatingChoice?: "start_on_proposed";
  seatingInUseFloorPlanIdChoice?: string;
}):
  | {
      ok: true;
      operationalFloorPlanId: string;
      seatingInUseFloorPlanId: string | null;
      selectionStatus: "applied";
      seatingCase: PreferenceApprovalCase;
    }
  | { ok: false; message: string } {
  const proposed = input.proposedFloorPlanId;
  const seatingCase = classifyPreferenceApprovalCase({
    currentOperationalId: input.operationalFloorPlanId,
    preferredId: proposed,
    currentHasSeats: input.currentHasSeats,
    preferredHasSeats: input.proposedHasSeats,
  });

  if (seatingCase === "B" && input.seatingChoice !== "start_on_proposed") {
    return {
      ok: false,
      message:
        "The current working layout has seating. Confirm you want to start seating on the proposed layout (existing seats stay on the previous layout).",
    };
  }

  if (seatingCase === "C") {
    const choice = input.seatingInUseFloorPlanIdChoice?.trim() || null;
    if (
      !choice
      || (choice !== proposed && choice !== input.operationalFloorPlanId)
    ) {
      return {
        ok: false,
        message: "Both layouts have seating. Choose which seating arrangement stays in use.",
      };
    }
    return {
      ok: true,
      operationalFloorPlanId: proposed,
      seatingInUseFloorPlanId: choice,
      selectionStatus: "applied",
      seatingCase,
    };
  }

  return {
    ok: true,
    operationalFloorPlanId: proposed,
    seatingInUseFloorPlanId:
      seatingCase === "B" ? proposed : input.seatingInUseFloorPlanId,
    selectionStatus: "applied",
    seatingCase,
  };
}
