"use server";

import { revalidatePath } from "next/cache";

import {
  createVendorLibraryDocument,
  deleteVendorEventDocument,
  deleteVendorLibraryDocument,
  shareVendorDocumentToEvent,
} from "@/lib/vendor-documents/service";
import type { DocumentCategory } from "@/lib/documents/types";
import type { VendorDocumentActionResult } from "@/lib/vendor-documents/types";

export async function createVendorLibraryDocumentAction(input: {
  name: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  storagePath: string;
  storageUrl: string;
  category: DocumentCategory;
  notes?: string;
  expiresAt?: string | null;
}): Promise<VendorDocumentActionResult> {
  const result = await createVendorLibraryDocument(input);
  if (result.ok) revalidatePath("/vendor/documents");
  return result;
}

export async function deleteVendorLibraryDocumentAction(
  documentId: string,
): Promise<VendorDocumentActionResult> {
  const result = await deleteVendorLibraryDocument(documentId);
  if (result.ok) revalidatePath("/vendor/documents");
  return result;
}

export async function shareVendorDocumentToEventAction(input: {
  assignmentId: string;
  libraryDocumentId?: string | null;
  name?: string;
  fileName?: string;
  fileSize?: number | null;
  mimeType?: string | null;
  storagePath?: string;
  storageUrl?: string;
  category?: DocumentCategory;
  notes?: string;
  expiresAt?: string | null;
  shareWithCouple?: boolean;
}): Promise<VendorDocumentActionResult> {
  const result = await shareVendorDocumentToEvent(input);
  if (result.ok) {
    revalidatePath("/vendor/documents");
    revalidatePath(`/vendor/events/${input.assignmentId}`);
  }
  return result;
}

export async function deleteVendorEventDocumentAction(
  documentId: string,
  assignmentId: string,
): Promise<VendorDocumentActionResult> {
  const result = await deleteVendorEventDocument(documentId);
  if (result.ok) {
    revalidatePath("/vendor/documents");
    revalidatePath(`/vendor/events/${assignmentId}`);
  }
  return result;
}
