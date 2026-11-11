/**
 * Shared account-setup legal acknowledgment helpers.
 * Affirmative, unchecked-by-default consent for invite/signup forms.
 * Pure — no DB or framework imports (except types).
 */

import { publicPathForLegalDocumentType } from "@/lib/legal/public-routes";
import type { LegalDocumentType } from "@/lib/legal/types";

export type SignupLegalAudience = "couple" | "vendor" | "venue";

/** Terms + Privacy document types required at account setup per audience. */
export const SIGNUP_LEGAL_DOCUMENT_TYPES: Record<
  SignupLegalAudience,
  readonly [LegalDocumentType, LegalDocumentType]
> = {
  couple: ["couple_end_user_terms", "privacy_policy"],
  vendor: ["vendor_end_user_terms", "privacy_policy"],
  venue: ["venue_terms_of_service", "privacy_policy"],
};

export const SIGNUP_LEGAL_ACCEPTED_ERROR: Record<SignupLegalAudience, string> = {
  couple:
    "Please agree to the End User Terms and Privacy Policy to continue.",
  vendor:
    "Please agree to the Vendor Terms and Privacy Policy to continue.",
  venue:
    "Please agree to the Terms of Service and Privacy Policy to continue.",
};

export function signupLegalLinks(audience: SignupLegalAudience): {
  termsHref: string;
  termsLabel: string;
  privacyHref: string;
  privacyLabel: string;
} {
  const [termsType] = SIGNUP_LEGAL_DOCUMENT_TYPES[audience];
  return {
    termsHref: publicPathForLegalDocumentType(termsType),
    termsLabel:
      audience === "couple"
        ? "End User Terms"
        : audience === "vendor"
          ? "Vendor Terms"
          : "Terms of Service",
    privacyHref: publicPathForLegalDocumentType("privacy_policy"),
    privacyLabel: "Privacy Policy",
  };
}

/**
 * Affirmative acknowledgment only — unchecked / missing / "false" → false.
 * Matches venue activate + welcome API parsing.
 */
export function isLegalAcceptedValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function parseLegalAcceptedFromFormData(formData: FormData): boolean {
  return isLegalAcceptedValue(formData.get("legalAccepted"));
}

export function requireSignupLegalAccepted(
  audience: SignupLegalAudience,
  legalAccepted: boolean,
): { ok: true } | { ok: false; error: string } {
  if (legalAccepted) return { ok: true };
  return { ok: false, error: SIGNUP_LEGAL_ACCEPTED_ERROR[audience] };
}
