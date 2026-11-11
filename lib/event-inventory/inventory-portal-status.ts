/**
 * Couple-facing Inventory status. Selection copy is only for collaboration_mode=select.
 * A view-only share is a review document, even when status is "shared".
 */
export function inventoryPortalStatusCopy(
  status: string,
  selectMode: boolean,
): { label: string; hint: string } {
  if (!selectMode) {
    if (status === "finalized") {
      return {
        label: "Finalized",
        hint: "This inventory arrangement is locked.",
      };
    }
    return {
      label: "Shared for review",
      hint: "Your venue shared this inventory for you to review. It is read-only — there is nothing to submit.",
    };
  }
  if (status === "shared") {
    return {
      label: "Ready for your choices",
      hint: "Save a draft anytime. Submit when you’re ready — your venue will review before anything is confirmed.",
    };
  }
  if (status === "changes_requested") {
    return {
      label: "Changes requested",
      hint: "Your venue asked you to update your selections. Save a draft, then submit again.",
    };
  }
  if (status === "submitted") {
    return {
      label: "Submitted — awaiting venue review",
      hint: "Your venue is reviewing what you submitted. Quantities are locked until they confirm or ask for changes.",
    };
  }
  if (status === "confirmed") {
    return {
      label: "Confirmed",
      hint: "Your venue confirmed these inventory choices. They’ll appear on your Event Order when shared.",
    };
  }
  if (status === "finalized") {
    return {
      label: "Finalized",
      hint: "This inventory arrangement is locked.",
    };
  }
  return {
    label: "In progress",
    hint: "Review package-included items and any optional extras your venue offered.",
  };
}
