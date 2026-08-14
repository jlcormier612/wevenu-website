/**
 * Phase 2 vendor_confirm presentation helpers (pure — no I/O).
 */

export type VendorConfirmCouplePhase = "open" | "waiting" | "complete";

export function vendorConfirmCouplePhase(input: {
  completionAuthority?: string | null;
  status: string;
  coupleAcknowledgedAt?: string | null;
}): VendorConfirmCouplePhase | null {
  if (input.completionAuthority !== "vendor_confirm") return null;
  if (input.status === "complete") return "complete";
  if (input.coupleAcknowledgedAt) return "waiting";
  return "open";
}

/** Owned vendor_confirm rows require ack before the vendor Confirm control. */
export function vendorConfirmNeedsCoupleAck(input: {
  completionAuthority?: string | null;
  coupleVisibility: string;
  status: string;
  coupleAcknowledgedAt?: string | null;
}): boolean {
  return (
    input.completionAuthority === "vendor_confirm"
    && input.coupleVisibility === "owned"
    && input.status === "pending"
    && !input.coupleAcknowledgedAt
  );
}

export function vendorConfirmReadyToConfirm(input: {
  completionAuthority?: string | null;
  coupleVisibility: string;
  status: string;
  coupleAcknowledgedAt?: string | null;
}): boolean {
  return (
    input.completionAuthority === "vendor_confirm"
    && input.coupleVisibility === "owned"
    && input.status === "pending"
    && Boolean(input.coupleAcknowledgedAt)
  );
}
