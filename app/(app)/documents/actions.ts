"use server";

import { revalidatePath } from "next/cache";

import { deleteDocument, saveDocument, saveVenueDocument, updateDocument } from "@/lib/documents/service";
import type {
  CreateDocumentResult,
  Document,
  DocumentActionResult,
  DocumentEntityType,
  DocumentUploadPayload,
} from "@/lib/documents/types";

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

export async function updateDocumentAction(
  documentId: string,
  entityType: DocumentEntityType,
  entityId: string,
  patch: { name?: string; notes?: string; tags?: string[]; expiresAt?: string | null; category?: Document["category"] },
): Promise<DocumentActionResult> {
  const result = await updateDocument(documentId, patch);
  if (result.ok) revalidatePath(entityPath(entityType, entityId));
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
