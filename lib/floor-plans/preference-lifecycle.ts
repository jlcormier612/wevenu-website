/**
 * Floor Plans Phase 2 — couple preference lifecycle (C2) and seating-transition
 * classification (F2 / Case A·B·C). Pure helpers; no DB I/O.
 *
 * Distinct from floor_plans.client_layout_status (furniture-layout review).
 */

export const COUPLE_PREFERENCE_STATUSES = [
  "pending",
  "approved",
  "declined",
  "deferred",
  "withdrawn",
  "superseded",
] as const;

export type CouplePreferenceStatus = (typeof COUPLE_PREFERENCE_STATUSES)[number];

export type PreferenceApprovalCase = "A" | "B" | "C";

export type PreferenceDecision =
  | { decision: "approve"; case: "A" }
  | { decision: "approve"; case: "B"; seatingChoice: "start_on_preferred" }
  | { decision: "approve"; case: "C"; seatingInUseFloorPlanId: string }
  | { decision: "decline" }
  | { decision: "defer" };

/** Normalize legacy null status when a preference pointer exists. */
export function normalizeCouplePreferenceStatus(
  status: string | null | undefined,
  coupleSelectedFloorPlanId: string | null | undefined,
): CouplePreferenceStatus | null {
  if (status && (COUPLE_PREFERENCE_STATUSES as readonly string[]).includes(status)) {
    return status as CouplePreferenceStatus;
  }
  if (coupleSelectedFloorPlanId) return "pending";
  return null;
}

export function classifyPreferenceApprovalCase(input: {
  currentOperationalId: string | null;
  preferredId: string;
  currentHasSeats: boolean;
  preferredHasSeats: boolean;
}): PreferenceApprovalCase {
  // Same layout or no current working layout — no seating-host transition.
  if (!input.currentOperationalId || input.currentOperationalId === input.preferredId) {
    return "A";
  }
  if (input.currentHasSeats && input.preferredHasSeats) return "C";
  if (input.currentHasSeats && !input.preferredHasSeats) return "B";
  return "A";
}

/** Apply a venue decision to preference pointers. Never mutates seating rows. */
export function nextPreferenceState(input: {
  coupleSelectedFloorPlanId: string | null;
  coupleApprovedFloorPlanId: string | null;
  couplePreferenceStatus: CouplePreferenceStatus | null;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
  decision: PreferenceDecision;
}): {
  ok: true;
  coupleSelectedFloorPlanId: string | null;
  coupleApprovedFloorPlanId: string | null;
  couplePreferenceStatus: CouplePreferenceStatus;
  operationalFloorPlanId: string | null;
  seatingInUseFloorPlanId: string | null;
} | { ok: false; message: string } {
  const preferred = input.coupleSelectedFloorPlanId;
  if (!preferred) {
    return { ok: false, message: "There is no couple preference to review." };
  }
  const status = input.couplePreferenceStatus ?? "pending";
  if (status !== "pending" && status !== "superseded") {
    return {
      ok: false,
      message: `This preference is already ${status}. Refresh to see the current state.`,
    };
  }

  if (input.decision.decision === "decline" || input.decision.decision === "defer") {
    return {
      ok: true,
      coupleSelectedFloorPlanId: preferred,
      coupleApprovedFloorPlanId: input.coupleApprovedFloorPlanId,
      couplePreferenceStatus: input.decision.decision === "decline" ? "declined" : "deferred",
      operationalFloorPlanId: input.operationalFloorPlanId,
      seatingInUseFloorPlanId: input.seatingInUseFloorPlanId,
    };
  }

  if (input.decision.case === "A") {
    return {
      ok: true,
      coupleSelectedFloorPlanId: preferred,
      coupleApprovedFloorPlanId: preferred,
      couplePreferenceStatus: "approved",
      operationalFloorPlanId: preferred,
      seatingInUseFloorPlanId: input.seatingInUseFloorPlanId,
    };
  }

  if (input.decision.case === "B") {
    // B3 only — approve new and start seating there. Seats on the old layout stay.
    return {
      ok: true,
      coupleSelectedFloorPlanId: preferred,
      coupleApprovedFloorPlanId: preferred,
      couplePreferenceStatus: "approved",
      operationalFloorPlanId: preferred,
      seatingInUseFloorPlanId: preferred,
    };
  }

  // Case C — explicit seating-in-use required; both assignment sets preserved.
  const inUse = input.decision.seatingInUseFloorPlanId;
  if (!inUse) {
    return { ok: false, message: "Choose which seating arrangement is in use." };
  }
  return {
    ok: true,
    coupleSelectedFloorPlanId: preferred,
    coupleApprovedFloorPlanId: preferred,
    couplePreferenceStatus: "approved",
    operationalFloorPlanId: preferred,
    seatingInUseFloorPlanId: inUse,
  };
}

/** Couple selects a new preferred layout — preference only. */
export function nextStateAfterCoupleSelect(input: {
  newPreferredFloorPlanId: string;
  coupleSelectedFloorPlanId: string | null;
  coupleApprovedFloorPlanId: string | null;
  couplePreferenceStatus: CouplePreferenceStatus | null;
}): {
  coupleSelectedFloorPlanId: string;
  coupleApprovedFloorPlanId: string | null;
  couplePreferenceStatus: CouplePreferenceStatus;
  supersededPriorPending: boolean;
} {
  const priorStatus = normalizeCouplePreferenceStatus(
    input.couplePreferenceStatus,
    input.coupleSelectedFloorPlanId,
  );
  const supersededPriorPending =
    priorStatus === "pending"
    && Boolean(input.coupleSelectedFloorPlanId)
    && input.coupleSelectedFloorPlanId !== input.newPreferredFloorPlanId;

  return {
    coupleSelectedFloorPlanId: input.newPreferredFloorPlanId,
    coupleApprovedFloorPlanId: input.coupleApprovedFloorPlanId,
    couplePreferenceStatus: "pending",
    supersededPriorPending,
  };
}

export function venuePreferenceStatusCopy(input: {
  status: CouplePreferenceStatus | null;
  preferredName: string | null;
  approvedName: string | null;
  shared: boolean;
  isWorking: boolean;
}): { headline: string; detail: string; nextStep: string } {
  const preferred = input.preferredName ?? "their preferred layout";
  switch (input.status) {
    case "pending":
      return {
        headline: `Pending preference: ${preferred}`,
        detail:
          "The couple saved this as a preference only. It is not venue approval, and it did not change your working layout, sharing, or seating by itself.",
        nextStep: "Review the preference: approve, decline, or defer. Sharing stays a separate control.",
      };
    case "approved":
      return {
        headline: `Approved preference: ${preferred}`,
        detail: input.shared
          ? "You approved this preference and the layout is shared with the couple."
          : "You approved this preference, but it is not shared yet — the couple cannot see it until you share the floor plan.",
        nextStep: input.shared
          ? "Seating access and seating-in-use stay separate from approval."
          : "Share the floor plan when the couple should see this approved layout.",
      };
    case "declined":
      return {
        headline: "Preference declined",
        detail: input.approvedName
          ? `You declined ${preferred}. The previous approved preference (${input.approvedName}) is unchanged.`
          : `You declined ${preferred}. No approved preference is on file.`,
        nextStep: "Working layout, sharing, and seating assignments were not rewritten by the decline.",
      };
    case "deferred":
      return {
        headline: "Preference deferred",
        detail: input.approvedName
          ? `You deferred ${preferred}. The previous approved preference (${input.approvedName}) remains.`
          : `You deferred ${preferred} for later. No approved preference is on file.`,
        nextStep: "Return here when you are ready to approve, decline, or ask the couple for another preference.",
      };
    case "withdrawn":
      return {
        headline: "Preference withdrawn",
        detail: "The related offer is no longer available in the couple chooser. Layouts and seating were preserved.",
        nextStep: input.approvedName
          ? `Previous approved preference (${input.approvedName}) remains.`
          : "Offer another layout or set a working layout explicitly if needed.",
      };
    case "superseded":
      return {
        headline: "Earlier preference superseded",
        detail: "The couple chose a newer preference. Review the current pending preference below.",
        nextStep: "Decide on the current preference. Prior approved preference is preserved until you approve a new one.",
      };
    default:
      return {
        headline: "No couple preference yet",
        detail: input.isWorking
          ? "Your working layout is set. Preference review appears when the couple saves a preference."
          : "No working layout is designated yet. Set one explicitly — the system will not invent a fallback from offers or preferences.",
        nextStep: input.isWorking
          ? "Share and seating controls stay independent."
          : "Use Set as working layout on a plan card, or offer a single Library layout for the simple path.",
      };
  }
}

export function couplePreferenceStatusCopy(input: {
  status: CouplePreferenceStatus | null;
  preferredName: string | null;
  approvedAndShared: boolean;
}): { headline: string; detail: string } {
  const name = input.preferredName ?? "this layout";
  switch (input.status) {
    case "pending":
      return {
        headline: `Preference saved: ${name}`,
        detail:
          "This records what you prefer. It does not mean your venue approved it or will use it yet — they review preferences separately from sharing.",
      };
    case "approved":
      return {
        headline: input.approvedAndShared
          ? `Your venue approved ${name}`
          : `Your venue approved ${name} (not shared yet)`,
        detail: input.approvedAndShared
          ? "Your venue will use this layout for prep when it is also their working layout and shared with you."
          : "Approval does not automatically share the layout. You will see it here once your venue shares it.",
      };
    case "declined":
      return {
        headline: "Preference declined",
        detail: "Your venue declined this preference. Prior approved choices stay in place when they had one.",
      };
    case "deferred":
      return {
        headline: "Preference deferred",
        detail: "Your venue put this preference on hold. You can keep viewing shared layouts meanwhile.",
      };
    case "withdrawn":
      return {
        headline: "That option is no longer offered",
        detail: "Your venue withdrew the offer. Your seating and other layouts were not deleted.",
      };
    default:
      return {
        headline: "Choose a preferred layout when options are offered",
        detail: "Saving a preference does not change what the venue uses until they approve it.",
      };
  }
}
