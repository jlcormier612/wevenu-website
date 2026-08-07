/**
 * Relationship Workspace helpers for the read-only Legal compliance card (WP6).
 * Document sets mirror WP2 required-documents mapping (venue_owner / couple / vendor).
 * Version status rules match product `getLegalComplianceSummary` (exact version string).
 */

export type LegalComplianceSubject = "venue" | "couple" | "vendor";

export type LegalComplianceStatus =
  | "current"
  | "outdated"
  | "not_accepted";

/** Applicable document type keys per relationship subject. */
export const LEGAL_COMPLIANCE_DOCUMENT_TYPES: Record<
  LegalComplianceSubject,
  readonly string[]
> = {
  venue: [
    "terms_of_service",
    "privacy_policy",
    "cookie_policy",
    "acceptable_use_policy",
  ],
  couple: ["couple_end_user_terms", "privacy_policy"],
  vendor: ["vendor_end_user_terms", "privacy_policy"],
};

/** Short operational labels for the Legal card. */
export const LEGAL_COMPLIANCE_DOCUMENT_TITLES: Record<string, string> = {
  terms_of_service: "Venue Subscription Agreement",
  privacy_policy: "Privacy",
  cookie_policy: "Cookie",
  acceptable_use_policy: "Acceptable Use",
  couple_end_user_terms: "End User Terms",
  vendor_end_user_terms: "Vendor Terms",
};

const SUBJECT_SET = new Set<string>(["venue", "couple", "vendor"]);

/**
 * Resolve compliance subject from an optional entity/subject type field.
 * RW relationships are venue today; couple/vendor are prepared for when typed.
 */
export function resolveLegalComplianceSubject(
  entityType?: string | null,
): LegalComplianceSubject {
  const raw = entityType?.trim().toLowerCase() ?? "";
  if (raw === "couple") return "couple";
  if (raw === "vendor") return "vendor";
  if (raw === "venue" || raw === "venue_owner") return "venue";
  if (SUBJECT_SET.has(raw)) return raw as LegalComplianceSubject;
  return "venue";
}

/**
 * Current / Outdated / Not Accepted from accepted vs active version strings.
 * Does not call the acceptance engine — same exact-match rule as the product API.
 */
export function resolveLegalComplianceStatus(input: {
  acceptedVersion: string | null | undefined;
  activeVersion: string | null | undefined;
}): LegalComplianceStatus {
  const accepted = input.acceptedVersion?.trim() || null;
  const active = input.activeVersion?.trim() || null;
  if (!accepted) return "not_accepted";
  if (!active) return "outdated";
  return accepted === active ? "current" : "outdated";
}

/**
 * Deep-link into Business → Legal acceptance history, filtered for this relationship.
 * Uses HQ's existing `relationship` (and `q`) query params from WP5.
 */
export function buildLegalAcceptanceHistoryUrl(input: {
  productAppBaseUrl: string;
  relationshipId?: string | null;
  /** Fallback search (email / user) when no relationship id. */
  user?: string | null;
}): string {
  const base = (
    input.productAppBaseUrl.trim() || "http://localhost:3000"
  ).replace(/\/$/, "");
  const params = new URLSearchParams();
  const relationshipId = input.relationshipId?.trim();
  const user = input.user?.trim();
  if (relationshipId) {
    params.set("relationship", relationshipId);
  } else if (user) {
    params.set("q", user);
  }
  const qs = params.toString();
  return qs
    ? `${base}/admin/legal/history?${qs}`
    : `${base}/admin/legal/history`;
}

export function subjectBlurb(subject: LegalComplianceSubject): string {
  if (subject === "couple") {
    return "Read-only compliance for this couple (End User Terms + Privacy).";
  }
  if (subject === "vendor") {
    return "Read-only compliance for this vendor (Vendor Terms + Privacy).";
  }
  return "Read-only compliance for this venue account (Venue Subscription Agreement, Privacy, Cookie, Acceptable Use).";
}
