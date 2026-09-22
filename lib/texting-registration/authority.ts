/**
 * Venue staff who may enable / edit / submit texting setup.
 * Capability: settings.texting (Owners via title; Administrators via preset).
 */
import { hasCapability, type MembershipAccessInput } from "@/lib/authorization";

/** @deprecated Prefer canConfigureVenueTextingFromAccess — dual-write compatibility only. */
export function canConfigureVenueTexting(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager";
}

export function canConfigureVenueTextingFromAccess(
  input: MembershipAccessInput | null | undefined,
): boolean {
  if (!input) return false;
  return hasCapability(input, "settings.texting");
}

export const TEXTING_SETUP_ROLE_DENIED =
  "You do not have permission to enable or change text messaging setup.";
