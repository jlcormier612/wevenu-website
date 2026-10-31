/**
 * What the Documents viewer shows for each row: the readable document itself
 * (print page or PDF), never the metadata panel.
 */
import type { WorkspaceDocument } from "@/lib/document-workspace/types";
import type { EventOrderStatus } from "@/lib/event-orders/types";

export type DocumentViewSource =
  /** Same-origin print page — framed, printed from the frame. */
  | { kind: "page"; src: string }
  /** Same-origin PDF rendered on request (`?download=1` for the attachment). */
  | { kind: "pdf"; src: string; downloadSrc: string }
  /** Uploaded file — previewable when the browser can show it inline. */
  | { kind: "file"; src: string; previewable: boolean };

/** `files` = vendor sessions: only uploaded files open in the viewer. */
export type DocumentViewerScope = "venue" | "files";

export function workspacePdfPath(docType: "contract" | "event_order", id: string): string {
  return `/api/document-workspace/${docType}/${id}/pdf`;
}

function isInlineMime(mime: string | null): boolean {
  if (!mime) return false;
  return mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("text/plain");
}

export function documentViewSource(
  doc: Pick<WorkspaceDocument, "docType" | "id" | "eventId" | "fileUrl" | "mimeType">,
  scope: DocumentViewerScope = "venue",
): DocumentViewSource | null {
  if (doc.docType === "document") {
    if (!doc.fileUrl) return null;
    return { kind: "file", src: doc.fileUrl, previewable: isInlineMime(doc.mimeType) };
  }
  if (scope !== "venue") return null;
  switch (doc.docType) {
    case "invoice":
      return { kind: "page", src: `/invoices/${doc.id}/print` };
    case "floor_plan":
      return doc.eventId ? { kind: "page", src: `/events/${doc.eventId}/floor-plan-print/${doc.id}` } : null;
    case "questionnaire":
      return doc.eventId ? { kind: "page", src: `/events/${doc.eventId}/questionnaire-print/${doc.id}` } : null;
    case "contract":
    case "event_order": {
      const src = workspacePdfPath(doc.docType, doc.id);
      return { kind: "pdf", src, downloadSrc: `${src}?download=1` };
    }
    default:
      return null;
  }
}

export function contractWorkingCopyNote(status: string): string | null {
  return status === "signed" ? null : "Working copy — not signed yet";
}

export function eventOrderPdfNote(eo: { status: EventOrderStatus; finalizedAt: string | null; sharedAt: string | null }): string {
  if (eo.status === "open") return "Draft — still being edited";
  if (!eo.sharedAt) return "Final — not yet shared with the couple";
  if (eo.finalizedAt && Date.parse(eo.sharedAt) < Date.parse(eo.finalizedAt)) return "Final — changes not yet shared with the couple";
  return "Final — shared with the couple";
}
