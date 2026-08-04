/**
 * Vendor Documents — library templates + event shares (Vendor Documents V1).
 * All writes go through SECURITY DEFINER RPCs; storage upload uses the
 * service-role API route so vendors never need documents-bucket RLS.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { DocumentCategory } from "@/lib/documents/types";
import type {
  VendorDocumentActionResult,
  VendorEventUpload,
  VendorLibraryDocument,
  VendorUploadedByEvent,
} from "@/lib/vendor-documents/types";

export async function getVendorLibraryDocuments(): Promise<VendorLibraryDocument[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_library_documents");
  if (error) throw error;
  if (!data || "error" in data) return [];
  return ((data.documents ?? []) as VendorLibraryDocument[]);
}

export async function getVendorUploadedDocumentsAcrossEvents(): Promise<VendorUploadedByEvent[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_uploaded_documents");
  if (error) throw error;
  if (!data || "error" in data) return [];
  return ((data.events ?? []) as VendorUploadedByEvent[]);
}

export async function getVendorEventUploads(assignmentId: string): Promise<VendorEventUpload[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_event_uploads", {
    p_assignment_id: assignmentId,
  });
  if (error) throw error;
  if (!data || "error" in data) return [];
  return ((data.documents ?? []) as VendorEventUpload[]);
}

export async function createVendorLibraryDocument(input: {
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
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_vendor_library_document", {
    p_name: input.name,
    p_file_name: input.fileName,
    p_file_size: input.fileSize,
    p_mime_type: input.mimeType,
    p_storage_path: input.storagePath,
    p_storage_url: input.storageUrl,
    p_category: input.category,
    p_notes: input.notes ?? null,
    p_expires_at: input.expiresAt || null,
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? "Could not save document." };
  return { ok: true, documentId: data.documentId as string };
}

export async function deleteVendorLibraryDocument(documentId: string): Promise<VendorDocumentActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_vendor_library_document", {
    p_document_id: documentId,
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? "Could not delete document." };
  return { ok: true };
}

export async function shareVendorDocumentToEvent(input: {
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
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_vendor_document_to_event", {
    p_assignment_id: input.assignmentId,
    p_library_document_id: input.libraryDocumentId ?? null,
    p_name: input.name ?? null,
    p_file_name: input.fileName ?? null,
    p_file_size: input.fileSize ?? null,
    p_mime_type: input.mimeType ?? null,
    p_storage_path: input.storagePath ?? null,
    p_storage_url: input.storageUrl ?? null,
    p_category: input.category ?? "other",
    p_notes: input.notes ?? null,
    p_expires_at: input.expiresAt || null,
    p_share_with_couple: input.shareWithCouple ?? false,
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) {
    const msg =
      data?.error === "library_not_found" ? "Library document not found."
      : data?.error === "not_found" ? "Event assignment not found."
      : data?.error ?? "Could not share document.";
    return { ok: false, message: msg };
  }
  return { ok: true, documentId: data.documentId as string };
}

export async function deleteVendorEventDocument(documentId: string): Promise<VendorDocumentActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_vendor_event_document", {
    p_document_id: documentId,
  });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: data?.error ?? "Could not remove document." };
  return { ok: true };
}
