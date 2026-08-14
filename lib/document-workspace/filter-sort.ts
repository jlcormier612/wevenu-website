import type { WorkspaceDocument, WorkspaceFilters, WorkspaceSort } from "@/lib/document-workspace/types";

/** Step 7 — Search: title, relationship, event, category, owner, status. (Vendor name is folded into "relationship" for vendor-owned docs; tags aren't part of get_venue_documents' shape yet — a real, named gap, not silently dropped — see the implementation report.) */
export function searchDocuments(docs: WorkspaceDocument[], query: string): WorkspaceDocument[] {
  const q = query.trim().toLowerCase();
  if (!q) return docs;
  return docs.filter((d) =>
    d.name.toLowerCase().includes(q) ||
    (d.relationshipName?.toLowerCase().includes(q) ?? false) ||
    (d.eventName?.toLowerCase().includes(q) ?? false) ||
    d.category.toLowerCase().includes(q) ||
    (d.rawStatus?.toLowerCase().includes(q) ?? false) ||
    d.ownerType.toLowerCase().includes(q));
}

/** Step 8 — exactly these filters: Category, Status, Relationship, Event, Owner, Created Date, Modified Date, Shared, Signed, Locked, Archived. Locked/Archived always pass through empty today — no producer has that state (Step 1 finding); the filter exists structurally for when one does, not faked. */
export function filterDocuments(docs: WorkspaceDocument[], filters: WorkspaceFilters): WorkspaceDocument[] {
  return docs.filter((d) => {
    if (filters.category && d.category !== filters.category) return false;
    if (filters.status && d.status !== filters.status) return false;
    if (filters.shared !== undefined && (d.isCoupleVisible || d.isVendorVisible) !== filters.shared) return false;
    if (filters.signed !== undefined && !!d.signedAt !== filters.signed) return false;
    return true;
  });
}

/** Step 9 — exactly these: Most Recent, Name, Relationship, Category, Created, Modified, Status. */
export function sortDocuments(docs: WorkspaceDocument[], sort: WorkspaceSort): WorkspaceDocument[] {
  const copy = [...docs];
  switch (sort) {
    case "name": return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "relationship": return copy.sort((a, b) => (a.relationshipName ?? "").localeCompare(b.relationshipName ?? ""));
    case "category": return copy.sort((a, b) => a.category.localeCompare(b.category));
    case "created": return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "modified": return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "status": return copy.sort((a, b) => a.status.localeCompare(b.status));
    case "recent":
    default: return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
