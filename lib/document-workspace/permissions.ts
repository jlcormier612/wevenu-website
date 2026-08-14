import type { WorkspaceDocument, WorkspacePermissions } from "@/lib/document-workspace/types";

/**
 * Step 11 — surfaced from existing authorization, not redesigned. This app
 * has no per-document ACL (RLS gates at the table/venue level — if a venue
 * user can see a row at all, they have Read); Edit/Download/Share below
 * reflect only what each producer's own module actually supports today.
 * Archive/Lock are false for every doc_type because no producer has that
 * state (confirmed in Step 1) — showing them as available would be
 * fabricating a capability, not surfacing a real one.
 */
export function computeVenuePermissions(doc: WorkspaceDocument): WorkspacePermissions {
  const hasRealFile = !!doc.fileUrl;
  return {
    read: true,
    // "Edit" here means edit-in-workspace (rename/categorize/tag) — only
    // the generic uploads module supports that; contracts/invoices/floor
    // plans/questionnaires are edited through their own producer screens,
    // per the brief's own "no producer integration" boundary.
    edit: doc.docType === "document",
    comment: false,
    share: doc.docType === "document" || doc.docType === "contract" || doc.docType === "invoice",
    download: hasRealFile,
    archive: false,
    lock: false,
  };
}
