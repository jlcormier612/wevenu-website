/**
 * Configurable required-legal-document mapping by acceptance user type.
 * Change requirements here — do not hardcode in gates or call sites.
 *
 * Venue Owner VSA: product registry titles `terms_of_service` as
 * "Venue Subscription Agreement" (LEGAL_DOCUMENT_TYPE_TITLES). We require
 * that type — not `venue_terms_of_service` ("Venue Terms of Service"), which
 * legacy activation gates still use separately.
 */

import type { LegalDocumentType } from "@/lib/legal/types";

/** Platform principals that have distinct required legal sets. */
export const LEGAL_ACCEPTANCE_USER_TYPES = [
  "venue_owner",
  "venue_manager",
  "team_member",
  "couple",
  "vendor",
] as const;

export type LegalAcceptanceUserType =
  (typeof LEGAL_ACCEPTANCE_USER_TYPES)[number];

export const LEGAL_ACCEPTANCE_USER_TYPE_LABELS: Record<
  LegalAcceptanceUserType,
  string
> = {
  venue_owner: "Venue Owner",
  venue_manager: "Venue Manager",
  team_member: "Team Member",
  couple: "Couple",
  vendor: "Vendor",
};

/**
 * Required document **types** (not row ids) enforced by the acceptance engine.
 * Keep arrays ordered for stable tests / UI later.
 */
export const REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE: Record<
  LegalAcceptanceUserType,
  readonly LegalDocumentType[]
> = {
  // Venue Subscription Agreement = terms_of_service (see file header).
  venue_owner: [
    "terms_of_service",
    "privacy_policy",
    "cookie_policy",
    "acceptable_use_policy",
  ],
  venue_manager: ["privacy_policy", "acceptable_use_policy"],
  team_member: ["privacy_policy", "acceptable_use_policy"],
  couple: ["couple_end_user_terms", "privacy_policy"],
  vendor: ["vendor_end_user_terms", "privacy_policy"],
};

export function isLegalAcceptanceUserType(
  value: string,
): value is LegalAcceptanceUserType {
  return (LEGAL_ACCEPTANCE_USER_TYPES as readonly string[]).includes(value);
}

/** Document types this user type must accept at the currently active version. */
export function getRequiredDocumentTypes(
  userType: LegalAcceptanceUserType,
): readonly LegalDocumentType[] {
  return REQUIRED_LEGAL_DOCUMENTS_BY_USER_TYPE[userType];
}
