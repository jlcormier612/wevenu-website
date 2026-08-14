/**
 * Canonical public URLs for active legal documents.
 * Pure mapping — no framework or database imports.
 */

import type { LegalDocumentType } from "@/lib/legal/types";

/** Pretty public paths → document_type keys. */
export const PUBLIC_LEGAL_SLUG_TO_TYPE = {
  terms: "terms_of_service",
  privacy: "privacy_policy",
  cookies: "cookie_policy",
  "acceptable-use": "acceptable_use_policy",
  "end-user-terms": "couple_end_user_terms",
  "vendor-terms": "vendor_end_user_terms",
} as const satisfies Record<string, LegalDocumentType>;

export type PublicLegalSlug = keyof typeof PUBLIC_LEGAL_SLUG_TO_TYPE;

/** document_type → canonical public path (when one exists). */
export const PUBLIC_LEGAL_PATH_BY_TYPE: Partial<
  Record<LegalDocumentType, `/${PublicLegalSlug}`>
> = {
  terms_of_service: "/terms",
  privacy_policy: "/privacy",
  cookie_policy: "/cookies",
  acceptable_use_policy: "/acceptable-use",
  couple_end_user_terms: "/end-user-terms",
  vendor_end_user_terms: "/vendor-terms",
};

export function publicPathForLegalDocumentType(
  documentType: LegalDocumentType,
): string {
  return PUBLIC_LEGAL_PATH_BY_TYPE[documentType] ?? `/legal/${documentType}`;
}

export function isPublicLegalSlug(value: string): value is PublicLegalSlug {
  return value in PUBLIC_LEGAL_SLUG_TO_TYPE;
}
