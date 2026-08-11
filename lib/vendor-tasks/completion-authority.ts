/**
 * Durable completion authority for vendor_tasks.
 *
 * Derived once at write time from couple_visibility × action_type, then stored
 * and used as SoT (do not long-term substitute visibility/action_type).
 *
 * Mapping (verified from product semantics):
 *   private              → vendor_confirm
 *   visible              → vendor_confirm
 *   owned + null action  → couple_acknowledge
 *   owned + share_timeline → action_verified
 */

export type VendorTaskCompletionAuthority =
  | "couple_acknowledge"
  | "vendor_confirm"
  | "action_verified";

export function deriveCompletionAuthority(opts: {
  coupleVisibility: "private" | "visible" | "owned" | string;
  actionType: "share_timeline" | string | null | undefined;
}): VendorTaskCompletionAuthority {
  const owned = opts.coupleVisibility === "owned";
  const shareTimeline = opts.actionType === "share_timeline";

  if (owned && shareTimeline) return "action_verified";
  if (owned) return "couple_acknowledge";
  return "vendor_confirm";
}
