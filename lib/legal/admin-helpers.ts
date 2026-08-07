/**
 * Pure helpers for HQ Legal Administration (WP5).
 * No DB / framework imports — unit-tested.
 */

import {
  getRequiredDocumentTypes,
  LEGAL_ACCEPTANCE_USER_TYPE_LABELS,
  type LegalAcceptanceUserType,
} from "@/lib/legal/required-documents";
import {
  LEGAL_DOCUMENT_TYPE_TITLES,
  type LegalDocument,
  type LegalDocumentType,
} from "@/lib/legal/types";

export type LegalAdminDashboardSummary = {
  currentLegalDocuments: number;
  totalDocumentVersions: number;
  outstandingAcceptances: number;
  /** 0–100; null when denominator is zero. */
  acceptanceRatePercent: number | null;
};

export type LegalAdminOutstandingRow = {
  userId: string;
  userLabel: string;
  role: LegalAcceptanceUserType;
  roleLabel: string;
  relationshipId: string | null;
  relationshipLabel: string;
  venueId: string | null;
  venueLabel: string;
  documentType: LegalDocumentType;
  documentTitle: string;
  currentVersion: string | null;
  acceptedVersion: string | null;
  lastLoginAt: string | null;
  status: "outdated" | "not_accepted";
};

export type LegalAdminHistoryRow = {
  id: string;
  acceptedAt: string;
  userId: string;
  userLabel: string;
  roleLabel: string;
  relationshipId: string | null;
  relationshipLabel: string;
  documentType: LegalDocumentType | null;
  documentTitle: string;
  acceptedVersion: string;
  acceptanceMethod: string;
  ipAddress: string | null;
};

export type LegalAdminVersionHistoryRow = {
  id: string;
  version: string;
  effectiveDate: string;
  publishedByLabel: string | null;
  publishedAt: string | null;
  isActive: boolean;
  isPublished: boolean;
  acceptanceCount: number;
};

/** Prefer active version; else newest by effective_date / created_at. */
export function pickCurrentLegalVersion(
  versions: LegalDocument[],
): LegalDocument | null {
  const active = versions.find((v) => v.isActive);
  if (active) return active;
  return versions[0] ?? null;
}

/**
 * Deactivate is allowed only when another active version exists for the type.
 * With the one-active-per-type index this is always false for the sole active row —
 * never leave a type with zero actives.
 */
export function canDeactivateLegalVersion(input: {
  isActive: boolean;
  activeCountForType: number;
}): boolean {
  return input.isActive && input.activeCountForType > 1;
}

export function computeLegalAdminDashboardSummary(input: {
  documentTypesWithActive: number;
  totalVersions: number;
  outstandingCount: number;
  /** Users (or user×doc expectations) that are fully current. */
  currentAcceptances: number;
  /** Population used as rate denominator (current + outstanding). */
  totalTrackedAcceptances: number;
}): LegalAdminDashboardSummary {
  const denom = input.totalTrackedAcceptances;
  const rate =
    denom <= 0
      ? null
      : Math.round((input.currentAcceptances / denom) * 1000) / 10;

  return {
    currentLegalDocuments: input.documentTypesWithActive,
    totalDocumentVersions: input.totalVersions,
    outstandingAcceptances: input.outstandingCount,
    acceptanceRatePercent: rate,
  };
}

export function classifyOutstandingStatus(input: {
  acceptedVersion: string | null;
  currentVersion: string | null;
}): "current" | "outdated" | "not_accepted" {
  if (!input.acceptedVersion) return "not_accepted";
  if (
    input.currentVersion &&
    input.acceptedVersion === input.currentVersion
  ) {
    return "current";
  }
  return "outdated";
}

/**
 * Build outstanding rows for one user given required types, active docs,
 * and latest accepted version per document type.
 */
export function buildOutstandingRowsForUser(input: {
  userId: string;
  userLabel: string;
  role: LegalAcceptanceUserType;
  relationshipId?: string | null;
  relationshipLabel?: string;
  venueId?: string | null;
  venueLabel?: string;
  lastLoginAt?: string | null;
  activeByType: Partial<Record<LegalDocumentType, { version: string }>>;
  acceptedByType: Partial<Record<LegalDocumentType, string>>;
}): LegalAdminOutstandingRow[] {
  const required = getRequiredDocumentTypes(input.role);
  const rows: LegalAdminOutstandingRow[] = [];

  for (const documentType of required) {
    const active = input.activeByType[documentType];
    const acceptedVersion = input.acceptedByType[documentType] ?? null;
    const currentVersion = active?.version ?? null;
    const status = classifyOutstandingStatus({
      acceptedVersion,
      currentVersion,
    });
    if (status === "current") continue;

    rows.push({
      userId: input.userId,
      userLabel: input.userLabel,
      role: input.role,
      roleLabel: LEGAL_ACCEPTANCE_USER_TYPE_LABELS[input.role],
      relationshipId: input.relationshipId ?? null,
      relationshipLabel: input.relationshipLabel ?? "—",
      venueId: input.venueId ?? null,
      venueLabel: input.venueLabel ?? "—",
      documentType,
      documentTitle: LEGAL_DOCUMENT_TYPE_TITLES[documentType],
      currentVersion,
      acceptedVersion,
      lastLoginAt: input.lastLoginAt ?? null,
      status,
    });
  }

  return rows;
}

export type LegalAdminListFilters = {
  search?: string;
  role?: string;
  documentType?: string;
  relationshipId?: string;
  venueId?: string;
};

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function includesSearch(
  haystack: Array<string | null | undefined>,
  needle: string,
): boolean {
  if (!needle) return true;
  return haystack.some((part) =>
    (part ?? "").toLowerCase().includes(needle),
  );
}

export function filterOutstandingRows(
  rows: LegalAdminOutstandingRow[],
  filters: LegalAdminListFilters,
): LegalAdminOutstandingRow[] {
  const search = normalizeSearch(filters.search);
  const role = (filters.role ?? "").trim();
  const documentType = (filters.documentType ?? "").trim();
  const relationshipId = (filters.relationshipId ?? "").trim();
  const venueId = (filters.venueId ?? "").trim();

  return rows.filter((row) => {
    if (role && row.role !== role) return false;
    if (documentType && row.documentType !== documentType) return false;
    if (relationshipId && row.relationshipId !== relationshipId) return false;
    if (venueId && row.venueId !== venueId) return false;
    if (
      !includesSearch(
        [
          row.userLabel,
          row.roleLabel,
          row.relationshipLabel,
          row.venueLabel,
          row.documentTitle,
          row.documentType,
          row.currentVersion,
          row.acceptedVersion,
        ],
        search,
      )
    ) {
      return false;
    }
    return true;
  });
}

export function filterHistoryRows(
  rows: LegalAdminHistoryRow[],
  filters: LegalAdminListFilters,
): LegalAdminHistoryRow[] {
  const search = normalizeSearch(filters.search);
  const role = (filters.role ?? "").trim().toLowerCase();
  const documentType = (filters.documentType ?? "").trim();
  const relationshipId = (filters.relationshipId ?? "").trim();

  return rows.filter((row) => {
    if (role) {
      const roleKey = row.roleLabel.toLowerCase().replace(/\s+/g, "_");
      const roleLabel = row.roleLabel.toLowerCase();
      if (roleKey !== role && roleLabel !== role && !roleLabel.includes(role)) {
        return false;
      }
    }
    if (documentType && row.documentType !== documentType) return false;
    if (relationshipId && row.relationshipId !== relationshipId) return false;
    if (
      !includesSearch(
        [
          row.userLabel,
          row.roleLabel,
          row.relationshipLabel,
          row.documentTitle,
          row.documentType,
          row.acceptedVersion,
          row.acceptanceMethod,
          row.ipAddress,
        ],
        search,
      )
    ) {
      return false;
    }
    return true;
  });
}

export function documentTitleForType(
  documentType: LegalDocumentType | null | undefined,
  fallback?: string | null,
): string {
  if (documentType && documentType in LEGAL_DOCUMENT_TYPE_TITLES) {
    return LEGAL_DOCUMENT_TYPE_TITLES[documentType];
  }
  return fallback?.trim() || "Unknown document";
}
