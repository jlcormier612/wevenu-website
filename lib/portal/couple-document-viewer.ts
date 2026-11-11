/**
 * Couple portal document open/print/download — mirrors venue Documents viewer
 * for file uploads plus contracts (PDF) and invoices (print page).
 */
import { isInlineMime } from "@/lib/document-workspace/viewer";

export type CoupleDocumentViewTarget = {
  id: string;
  name: string;
} & (
  | { kind: "file"; fileUrl: string; mimeType: string | null }
  | { kind: "pdf"; src: string; downloadSrc: string }
  | { kind: "page"; src: string }
);

export type CoupleDocumentViewInput = {
  id: string;
  name: string;
  docType: string;
  fileUrl: string | null;
  mimeType: string | null;
};

/** Infer previewability when mime is missing (common on older couple uploads). */
export function coupleDocumentIsPreviewable(
  mimeType: string | null,
  fileUrl: string,
): boolean {
  if (isInlineMime(mimeType)) return true;
  const path = fileUrl.split("?")[0]?.toLowerCase() ?? "";
  return (
    path.endsWith(".pdf")
    || path.endsWith(".png")
    || path.endsWith(".jpg")
    || path.endsWith(".jpeg")
    || path.endsWith(".gif")
    || path.endsWith(".webp")
    || path.endsWith(".txt")
  );
}

export function coupleDocumentDownloadName(doc: {
  name: string;
  mimeType?: string | null;
  fileUrl?: string;
}): string {
  const base = doc.name.trim() || "document";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const mime = (doc.mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return `${base}.pdf`;
  if (mime === "image/png") return `${base}.png`;
  if (mime === "image/jpeg") return `${base}.jpg`;
  if (mime.startsWith("text/")) return `${base}.txt`;
  const path = doc.fileUrl?.split("?")[0]?.toLowerCase() ?? "";
  const ext = path.match(/\.([a-z0-9]{2,5})$/)?.[1];
  return ext ? `${base}.${ext}` : base;
}

export function coupleContractPdfPath(contractId: string, token: string): string {
  return `/api/portal/contracts/${contractId}/pdf?token=${encodeURIComponent(token)}`;
}

export function coupleInvoicePrintPath(invoiceId: string, token: string): string {
  return `/portal/invoices/${invoiceId}/print?token=${encodeURIComponent(token)}`;
}

/**
 * Resolve how a Docs row opens in the couple viewer.
 * Contracts and invoices always open (PDF / print page). Uploads need a file URL.
 */
export function coupleDocumentViewTarget(
  doc: CoupleDocumentViewInput,
  token: string,
): CoupleDocumentViewTarget | null {
  if (doc.docType === "contract") {
    if (doc.fileUrl) {
      return {
        kind: "file",
        id: doc.id,
        name: doc.name,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType,
      };
    }
    const src = coupleContractPdfPath(doc.id, token);
    return {
      kind: "pdf",
      id: doc.id,
      name: doc.name,
      src,
      downloadSrc: `${src}&download=1`,
    };
  }

  if (doc.docType === "invoice") {
    return {
      kind: "page",
      id: doc.id,
      name: doc.name,
      src: coupleInvoicePrintPath(doc.id, token),
    };
  }

  if (!doc.fileUrl) return null;
  return {
    kind: "file",
    id: doc.id,
    name: doc.name,
    fileUrl: doc.fileUrl,
    mimeType: doc.mimeType,
  };
}
