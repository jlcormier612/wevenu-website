import type { DocumentCategory } from "@/lib/documents/types";

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; hasExpiry?: boolean }[] = [
  { value: "contract",       label: "Contract" },
  { value: "insurance",      label: "Insurance / COI",     hasExpiry: true },
  { value: "permit",         label: "Permit",               hasExpiry: true },
  { value: "inspiration",    label: "Inspiration" },
  { value: "floor_plan",     label: "Floor Plan" },
  { value: "menu",           label: "Menu" },
  { value: "questionnaire",  label: "Questionnaire" },
  { value: "invoice_copy",   label: "Invoice Copy" },
  { value: "other",          label: "Other" },
];

export function categoryLabel(cat: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export function categoryHasExpiry(cat: DocumentCategory): boolean {
  return !!DOCUMENT_CATEGORIES.find((c) => c.value === cat)?.hasExpiry;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMimeType(mime: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function isPdfMimeType(mime: string | null): boolean {
  return mime === "application/pdf";
}

/** Derive expiry urgency for display */
export function expiryStatus(expiresAt: string | null): "expired" | "soon" | "ok" | null {
  if (!expiresAt) return null;
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}
