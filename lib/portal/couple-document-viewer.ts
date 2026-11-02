/**
 * Couple portal document open/print/download — mirrors venue Documents viewer
 * behavior for file-backed rows without pulling in workspace producer chrome.
 */
import { isInlineMime } from "@/lib/document-workspace/viewer";

export type CoupleDocumentViewTarget = {
  id: string;
  name: string;
  fileUrl: string;
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

export function coupleDocumentDownloadName(doc: Pick<CoupleDocumentViewTarget, "name" | "mimeType" | "fileUrl">): string {
  const base = doc.name.trim() || "document";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const mime = (doc.mimeType ?? "").toLowerCase();
  if (mime === "application/pdf") return `${base}.pdf`;
  if (mime === "image/png") return `${base}.png`;
  if (mime === "image/jpeg") return `${base}.jpg`;
  if (mime.startsWith("text/")) return `${base}.txt`;
  const path = doc.fileUrl.split("?")[0]?.toLowerCase() ?? "";
  const ext = path.match(/\.([a-z0-9]{2,5})$/)?.[1];
  return ext ? `${base}.${ext}` : base;
}
