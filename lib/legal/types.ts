/**
 * Versioned platform legal documents.
 * Pure types — no framework or database imports.
 *
 * document_type keys map to display titles (stored in `title`):
 *   terms_of_service        → Venue Subscription Agreement (public site /terms)
 *   venue_terms_of_service  → Venue Terms of Service
 *   couple_end_user_terms   → End User Terms
 *   vendor_end_user_terms   → Vendor Terms
 *   privacy_policy          → Privacy Policy
 *   cookie_policy           → Cookie Policy
 *   acceptable_use_policy   → Acceptable Use Policy
 */

export type LegalDocumentType =
  | "terms_of_service"
  | "venue_terms_of_service"
  | "couple_end_user_terms"
  | "vendor_end_user_terms"
  | "privacy_policy"
  | "cookie_policy"
  | "acceptable_use_policy";

export const LEGAL_DOCUMENT_TYPE_TITLES: Record<LegalDocumentType, string> = {
  terms_of_service: "Venue Subscription Agreement",
  venue_terms_of_service: "Venue Terms of Service",
  couple_end_user_terms: "End User Terms",
  vendor_end_user_terms: "Vendor Terms",
  privacy_policy: "Privacy Policy",
  cookie_policy: "Cookie Policy",
  acceptable_use_policy: "Acceptable Use Policy",
};

export type LegalDocument = {
  id: string;
  documentType: LegalDocumentType;
  title: string;
  version: string;
  effectiveDate: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Ordered list of every platform document type (for admin tables). */
export const LEGAL_DOCUMENT_TYPES = Object.keys(
  LEGAL_DOCUMENT_TYPE_TITLES,
) as LegalDocumentType[];

/** Input for appending a new immutable version row (always created inactive). */
export type CreateLegalDocumentVersionInput = {
  documentType: LegalDocumentType;
  title: string;
  version: string;
  effectiveDate: string;
  content: string;
};

/** One row in the HQ Legal summary table (current active or latest version). */
export type LegalDocumentTypeSummary = {
  documentType: LegalDocumentType;
  title: string;
  /** Null when no versions exist for this type yet. */
  current: LegalDocument | null;
};

/** Append-only acceptance audit row. Never update — insert a new row per accept. */
export type LegalAcceptance = {
  id: string;
  /** App-wired context; may point at a customer/vendor relationship or be null. */
  relationshipId: string | null;
  userId: string;
  legalDocumentId: string;
  /** Snapshot of legal_documents.version at accept time. */
  acceptedVersion: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

/**
 * One row for the read-only Legal History profile table.
 * No dedicated acceptance_method column exists on legal_acceptances — method
 * is derived for display (all current write paths require a checkbox confirm).
 */
export type LegalAcceptanceHistoryItem = {
  id: string;
  documentType: LegalDocumentType | null;
  /** Human document label (e.g. Venue Terms of Service). */
  documentTitle: string;
  acceptedVersion: string;
  acceptedAt: string;
  /** Display label for how the user accepted (e.g. Checkbox). */
  acceptanceMethod: string;
};

/** Active legal document link for acceptance gates. */
export type LegalGateDocumentLink = {
  id: string;
  documentType: LegalDocumentType;
  title: string;
  version: string;
  path: string;
};

/**
 * Result of comparing required active document versions against the caller's
 * latest accepted versions (exact string match on `version`).
 */
export type LegalGateStatus = {
  needsAcceptance: boolean;
  documents: LegalGateDocumentLink[];
};

/** Authenticated staff portals that re-check legal versions after login. */
export type AuthenticatedLegalPortal = "venue" | "vendor";

/** Couple portal Welcome gate document links (active versions). */
export type CouplePortalLegalDocumentLink = {
  id: string;
  documentType: Extract<
    LegalDocumentType,
    "couple_end_user_terms" | "privacy_policy"
  >;
  title: string;
  version: string;
  path: string;
};

export type CouplePortalLegalGateStatus = {
  needsAcceptance: boolean;
  documents: CouplePortalLegalDocumentLink[];
};

/**
 * Whose legal set applies for a compliance summary (read-only CRM / gates).
 * Venue account → Venue Terms + Privacy.
 * Couple → End User Terms + Privacy.
 * Vendor → Vendor Terms + Privacy.
 */
export type LegalComplianceSubject = "venue" | "couple" | "vendor";

/** Acceptance vs currently active document version. */
export type LegalComplianceStatus =
  | "current"
  | "outdated"
  | "not_accepted";

/** One document row in a read-only Legal compliance card. */
export type LegalComplianceRow = {
  documentType: LegalDocumentType;
  /** Short label for CRM display (e.g. "Venue Terms"). */
  title: string;
  /** Active platform version, if one exists. */
  activeVersion: string | null;
  /** Latest accepted version for this identity, if any. */
  acceptedVersion: string | null;
  acceptedAt: string | null;
  status: LegalComplianceStatus;
};

export type LegalComplianceSummary = {
  subject: LegalComplianceSubject;
  rows: LegalComplianceRow[];
};
