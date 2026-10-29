/**
 * White Glove onboarding materials — upload validation + path helpers.
 * Objects live in the private `documents` bucket under onboarding/{venueId}/…
 */
import { DOCUMENTS_BUCKET } from "@/lib/documents/access";

export const WG_MATERIALS_BUCKET = DOCUMENTS_BUCKET;

/** 25 MiB — venue brochures, packages sheets, floor plans. */
export const WG_MATERIAL_MAX_BYTES = 25 * 1024 * 1024;

/** Soft cap per enrollment to limit abuse; operators can ask for more via email. */
export const WG_MATERIAL_MAX_COUNT = 40;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/zip",
  "application/x-zip-compressed",
]);

const ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "md", "markdown",
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif",
  "zip",
]);

export type WgMaterialValidation =
  | { ok: true; mime: string; safeFileName: string }
  | { ok: false; message: string };

export function sanitizeWgMaterialFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  return base.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 120) || "upload";
}

export function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.pop() ?? "") : "";
}

export function validateWgMaterialFile(file: {
  name: string;
  type: string;
  size: number;
}): WgMaterialValidation {
  if (!file.size || file.size <= 0) {
    return { ok: false, message: "That file looks empty. Choose another file." };
  }
  if (file.size > WG_MATERIAL_MAX_BYTES) {
    return { ok: false, message: "Each file must be 25 MB or smaller." };
  }
  const safeFileName = sanitizeWgMaterialFileName(file.name);
  const ext = extensionOf(safeFileName);
  const mime = (file.type || "").toLowerCase().trim();
  const mimeOk = !mime || mime === "application/octet-stream" || ALLOWED_MIME.has(mime);
  const extOk = !ext || ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    return {
      ok: false,
      message:
        "Use a common venue file type (PDF, Word, Excel, CSV, image, or ZIP).",
    };
  }
  if (ext && !ALLOWED_EXT.has(ext) && mime && !ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      message:
        "Use a common venue file type (PDF, Word, Excel, CSV, image, or ZIP).",
    };
  }
  return {
    ok: true,
    mime: mime && mime !== "application/octet-stream" ? mime : guessMimeFromExt(ext),
    safeFileName,
  };
}

function guessMimeFromExt(ext: string): string {
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "csv":
      return "text/csv";
    case "txt":
    case "md":
    case "markdown":
      return "text/plain";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

export function wgMaterialStoragePath(venueId: string, safeFileName: string): string {
  return `onboarding/${venueId}/${Date.now()}_${safeFileName}`;
}

/** Prefer storage_path; fall back to path embedded in a legacy public_url. */
export function resolveWgMaterialStoragePath(row: {
  storage_path?: string | null;
  public_url?: string | null;
}): string | null {
  const direct = row.storage_path?.trim();
  if (direct) return direct;
  const url = row.public_url?.trim();
  if (!url) return null;
  for (const marker of ["/object/public/documents/", "/object/sign/documents/"] as const) {
    const i = url.indexOf(marker);
    if (i >= 0) {
      const rest = url.slice(i + marker.length);
      const path = decodeURIComponent(rest.split("?")[0] ?? "");
      return path || null;
    }
  }
  return null;
}

/**
 * Infer a suggested Import Wizard entity from the file name when obvious.
 * Ambiguous materials stay null — operator chooses.
 */
export function suggestImportEntityFromFileName(
  fileName: string,
): "packages" | "inventory" | null {
  const n = fileName.toLowerCase();
  if (/package|pricing|price.?list|rate.?card|menu/.test(n)) return "packages";
  if (/inventory|rental|chair|table|linen/.test(n)) return "inventory";
  return null;
}

export function suggestPlanningImport(fileName: string): boolean {
  const n = fileName.toLowerCase();
  return /checklist|playbook|planning|timeline|task.?list/.test(n);
}
