/**
 * Maps portal vendor-pick RPC error codes to couple-facing copy.
 *
 * Pick/Unpick call toggle_vendor_pick / toggle_directory_vendor_pick, which
 * return `{ ok: false, error: "<code>" }`. The UI used to collapse every
 * failure into a generic toast, which hid the real Sandbox failure mode
 * (`event_not_found` when the portal client has no active event).
 */
export function vendorPickSaveErrorMessage(error?: string | null): string {
  switch (error) {
    case "event_not_found":
      return "Your event isn't set up yet, so picks can't be saved. Please contact your venue.";
    case "not_found":
      return "That vendor recommendation is no longer available. Refresh and try again.";
    case "invalid_token":
      return "Your portal session expired. Open your planning link again.";
    case "unauthorized":
      return "You don't have access to update this pick.";
    case "not_in_directory":
      return "That vendor isn't on your venue's approved list anymore.";
    case "Missing fields.":
      return "Couldn't save your pick — something was missing. Refresh and try again.";
    default:
      return "Couldn't save your pick. Please try again.";
  }
}

/** Pick requires an active event (recommendations attach to event_id). */
export function canToggleVendorPick(eventDate: string | null | undefined): boolean {
  return typeof eventDate === "string" && eventDate.length > 0;
}
