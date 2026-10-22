/**
 * Authorized retrieval for document file objects.
 * Venue uploads live in the private `documents` bucket (signed URL).
 * Couple portal uploads live in public `client-media`; venue Documents rows
 * may reference those same objects without copying them.
 * Never treat a stored public URL as authority — routes still authorize first.
 */

export const DOCUMENTS_BUCKET = "documents";
export const CLIENT_MEDIA_BUCKET = "client-media";

export function isDocumentsPublicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("/object/public/documents/") || url.includes("/object/sign/documents/");
}

export function isClientMediaPublicUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("/object/public/client-media/") || url.includes("/object/sign/client-media/");
}

export function storagePathFromDocumentsUrl(url: string): string | null {
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

export function storagePathFromClientMediaUrl(url: string): string | null {
  for (const marker of ["/object/public/client-media/", "/object/sign/client-media/"] as const) {
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
 * Display origin for a documents-table row.
 * uploaded_by_type CHECK only allows venue|vendor; couple-originated insurance
 * mirrors keep uploaded_by_type='venue' but storage_url points at client-media.
 */
export function documentFileOriginLabel(input: {
  uploadedByType: "venue" | "vendor" | string;
  storageUrl?: string | null;
  tags?: string[] | null;
}): "Venue" | "Vendor" | "Client" {
  if (input.uploadedByType === "vendor") return "Vendor";
  if (input.tags?.includes("couple-shared-insurance")) return "Client";
  if (isClientMediaPublicUrl(input.storageUrl ?? null)) return "Client";
  return "Venue";
}

/**
 * Sharing direction for venue Documents detail — not inferred from category alone.
 * Couple→venue shares must not read as "Shared with couple."
 */
export function documentSharingDirectionLabel(input: {
  originLabel: "Venue" | "Vendor" | "Client";
  isCoupleVisible: boolean;
  isVendorVisible: boolean;
}): string {
  if (input.originLabel === "Client") return "Shared by couple";
  if (input.isCoupleVisible) return "Shared with couple";
  if (input.isVendorVisible) return "Shared with vendors";
  return "Private";
}

export function venueIdFromDocumentsPath(storagePath: string): string | null {
  const first = storagePath.split("/").filter(Boolean)[0];
  return first ?? null;
}

/** True when this venue may access this object path. */
export function venueOwnsDocumentsPath(venueId: string, storagePath: string): boolean {
  return venueIdFromDocumentsPath(storagePath) === venueId;
}

export type DocumentAccessActor =
  | { kind: "venue"; venueId: string }
  | { kind: "couple"; venueId: string; clientId: string; eventId: string | null }
  | { kind: "vendor"; vendorId: string; eventIds: string[] };

export type DocumentAccessRow = {
  id: string;
  venueId: string;
  clientId: string | null;
  eventId: string | null;
  storagePath: string;
  isCoupleVisible: boolean;
  sharedWithVendors: boolean;
};

export function canAccessDocumentFile(
  actor: DocumentAccessActor,
  row: DocumentAccessRow,
): boolean {
  if (!row.storagePath) return false;
  if (actor.kind === "venue") {
    return actor.venueId === row.venueId;
  }
  if (actor.kind === "couple") {
    if (actor.venueId !== row.venueId) return false;
    if (!row.isCoupleVisible) return false;
    if (row.clientId && row.clientId === actor.clientId) return true;
    if (row.eventId && actor.eventId && row.eventId === actor.eventId) return true;
    return false;
  }
  if (actor.kind === "vendor") {
    if (!row.sharedWithVendors) return false;
    if (!row.eventId) return false;
    return actor.eventIds.includes(row.eventId);
  }
  return false;
}

export function portalFileHref(documentId: string, token: string): string {
  return `/api/portal/documents/${documentId}/file?token=${encodeURIComponent(token)}`;
}

export function vendorFileHref(documentId: string): string {
  return `/api/vendor/documents/${documentId}/file`;
}

export function venueFileHref(documentId: string): string {
  return `/api/documents/${documentId}/file`;
}
