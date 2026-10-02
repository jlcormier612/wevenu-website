/**
 * User-facing Documents filter groups — presentation only.
 *
 * Underlying WorkspaceCategory / producer classifications stay authoritative.
 * This maps storage categories into the six UI states:
 * All | Contracts | Financial | Planning | Vendors | Other
 */

import type { WorkspaceCategory, WorkspaceDocument } from "@/lib/document-workspace/types";

export type UserFacingDocumentGroup =
  | "Contracts"
  | "Financial"
  | "Planning"
  | "Vendors"
  | "Other";

/** Display order for non-empty filter chips (All is always first, separately). */
export const USER_FACING_DOCUMENT_GROUPS: UserFacingDocumentGroup[] = [
  "Contracts",
  "Financial",
  "Planning",
  "Vendors",
  "Other",
];

/**
 * Roll underlying WorkspaceCategory into one user-facing filter group.
 * Every existing category maps to exactly one group — no reclassification of records.
 */
export function toUserFacingDocumentGroup(
  category: WorkspaceCategory,
): UserFacingDocumentGroup {
  switch (category) {
    case "Contracts":
      return "Contracts";
    case "Invoices":
    case "Financial":
      return "Financial";
    case "Questionnaires":
    case "Planning":
    case "Floor Plans":
    case "Wedding Website":
    case "Photos":
      return "Planning";
    case "Vendor Documents":
      return "Vendors";
    case "Communication":
    case "Exports":
    case "Other":
      return "Other";
  }
}

export function countUserFacingGroups(
  docs: Pick<WorkspaceDocument, "category">[],
): Map<UserFacingDocumentGroup, number> {
  const counts = new Map<UserFacingDocumentGroup, number>();
  for (const g of USER_FACING_DOCUMENT_GROUPS) counts.set(g, 0);
  for (const d of docs) {
    const g = toUserFacingDocumentGroup(d.category);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return counts;
}

/** Categories with at least one document, in display order. */
export function populatedUserFacingGroups(
  docs: Pick<WorkspaceDocument, "category">[],
): UserFacingDocumentGroup[] {
  const counts = countUserFacingGroups(docs);
  return USER_FACING_DOCUMENT_GROUPS.filter((g) => (counts.get(g) ?? 0) > 0);
}

export function filterByUserFacingGroup(
  docs: WorkspaceDocument[],
  group: UserFacingDocumentGroup | "all",
): WorkspaceDocument[] {
  if (group === "all") return docs;
  return docs.filter((d) => toUserFacingDocumentGroup(d.category) === group);
}
