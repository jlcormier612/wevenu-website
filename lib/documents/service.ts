import { createClient } from "@/integrations/supabase/server";
import { createClient as createBrowserClient } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/documents/repository";
import type {
  CreateDocumentResult,
  Document,
  DocumentActionResult,
  DocumentEntityType,
  DocumentUploadPayload,
} from "@/lib/documents/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { triggerAutoComplete } from "@/lib/playbooks/service";

async function withVenue<T>(
  fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | DocumentActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getDocuments(
  entityType: DocumentEntityType,
  entityId: string,
): Promise<Document[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getDocuments(await createClient(), venue.id, entityType, entityId);
}

export async function saveDocument(payload: DocumentUploadPayload): Promise<CreateDocumentResult> {
  if (!payload.entityType || !payload.entityId || !payload.storageUrl) return { ok: false, message: "Missing required fields." };
  const result = await withVenue(async (c, venueId) => {
    const documentId = await repo.insertDocument(c, venueId, payload as DocumentUploadPayload & { entityType: DocumentEntityType; entityId: string });
    // "Upload seating chart" / "Vendor COIs in file" etc. complete themselves
    // once the file actually lands (Vendor Management — Next Iteration,
    // 2026-07-10) — only meaningful for documents attached to an event.
    if (payload.entityType === "event") {
      await triggerAutoComplete(c, venueId, payload.entityId as string, "document_uploaded", "document", documentId);
      if (payload.category === "insurance") {
        await triggerAutoComplete(c, venueId, payload.entityId as string, "document_uploaded_insurance", "document", documentId);
      }
    }
    return { ok: true, documentId } as CreateDocumentResult;
  });
  return result as CreateDocumentResult;
}

// A document that belongs to the venue itself rather than one specific
// lead/client/event/vendor — the attachment a Planning Template task can
// point to, since a template outlives (and predates) any single event.
export async function getVenueDocuments(): Promise<Document[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getVenueDocuments(await createClient(), venue.id);
}

export async function saveVenueDocument(payload: DocumentUploadPayload): Promise<CreateDocumentResult> {
  if (!payload.storageUrl) return { ok: false, message: "Missing required fields." };
  const result = await withVenue(async (c, venueId) => {
    const documentId = await repo.insertVenueDocument(c, venueId, payload);
    return { ok: true, documentId } as CreateDocumentResult;
  });
  return result as CreateDocumentResult;
}

export async function updateDocument(
  documentId: string,
  patch: { name?: string; notes?: string; tags?: string[]; expiresAt?: string | null; category?: Document["category"] },
): Promise<DocumentActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateDocumentMeta(c, venueId, documentId, patch);
    return { ok: true } as DocumentActionResult;
  });
  return result as DocumentActionResult;
}

export async function deleteDocument(documentId: string): Promise<DocumentActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const storagePath = await repo.deleteDocument(c, venueId, documentId);
    // Remove the file from the bucket
    if (storagePath) {
      const browser = createBrowserClient();
      await browser.storage.from("documents").remove([storagePath]);
    }
    return { ok: true } as DocumentActionResult;
  });
  return result as DocumentActionResult;
}
