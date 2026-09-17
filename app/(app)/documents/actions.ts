"use server";

import { revalidatePath } from "next/cache";

import { deleteDocument, replaceDocumentFile, saveDocument, saveVenueDocument, updateDocument } from "@/lib/documents/service";
import { venueLibraryDocumentPath } from "@/lib/documents/storage-path";
import type {
  CreateDocumentResult,
  Document,
  DocumentActionResult,
  DocumentEntityType,
  DocumentUploadPayload,
} from "@/lib/documents/types";
import { getCurrentVenue } from "@/lib/venue/service";

function entityPath(entityType: DocumentEntityType, entityId: string): string {
  const map: Record<DocumentEntityType, string> = {
    lead:   `/leads/${entityId}`,
    client: `/clients/${entityId}`,
    event:  `/events/${entityId}`,
    vendor: `/vendors/${entityId}`,
  };
  return map[entityType];
}

export async function saveDocumentAction(payload: DocumentUploadPayload & { entityType: DocumentEntityType; entityId: string }): Promise<CreateDocumentResult> {
  const result = await saveDocument(payload);
  if (result.ok) revalidatePath(entityPath(payload.entityType, payload.entityId));
  return result;
}

// Venue-level document — not tied to a Lead/Client/Event/Vendor, so there's
// no single entity page to revalidate. Callers (e.g. the Planning Template
// editor) revalidate their own path after a successful upload.
export async function saveVenueDocumentAction(payload: DocumentUploadPayload): Promise<CreateDocumentResult> {
  return saveVenueDocument(payload);
}

// Venue-level uploaders run in the browser, where the venue id isn't in scope,
// but the documents bucket refuses any object whose first path segment isn't
// the caller's venue (see lib/documents/storage-path.ts). Resolving the path
// here reads the venue from the session instead of trusting a prop, so an
// uploader cannot be handed a stale or foreign id.
export async function venueDocumentUploadPathAction(
  fileName: string,
): Promise<{ ok: true; storagePath: string } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  return { ok: true, storagePath: venueLibraryDocumentPath(venue.id, fileName) };
}

export async function updateDocumentAction(
  documentId: string,
  entityType: DocumentEntityType,
  entityId: string,
  patch: {
    name?: string; notes?: string; tags?: string[]; expiresAt?: string | null;
    category?: Document["category"]; isCoupleVisible?: boolean; sharedWithVendors?: boolean;
  },
): Promise<DocumentActionResult> {
  const result = await updateDocument(documentId, patch);
  if (result.ok) revalidatePath(entityPath(entityType, entityId));
  return result;
}

export async function replaceDocumentFileAction(payload: {
  documentId: string;
  entityType?: DocumentEntityType;
  entityId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  storageUrl: string;
}): Promise<CreateDocumentResult & { version?: number }> {
  const result = await replaceDocumentFile(payload);
  if (result.ok && payload.entityType && payload.entityId) {
    revalidatePath(entityPath(payload.entityType, payload.entityId));
  }
  if (result.ok) revalidatePath("/documents");
  return result;
}

export async function deleteDocumentAction(
  documentId: string,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<DocumentActionResult> {
  const result = await deleteDocument(documentId);
  if (result.ok) revalidatePath(entityPath(entityType, entityId));
  return result;
}
