import { createClient } from "@/integrations/supabase/server";
import type {
  Document,
  DocumentActionResult,
  DocumentEntityType,
  DocumentUploadPayload,
} from "@/lib/documents/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type DocRow = {
  id: string; venue_id: string;
  lead_id: string | null; client_id: string | null;
  event_id: string | null; vendor_id: string | null;
  name: string; file_name: string; file_size: number | null;
  mime_type: string | null; storage_path: string; storage_url: string;
  category: Document["category"]; notes: string | null; tags: string[];
  expires_at: string | null; created_at: string; updated_at: string;
};

function mapDoc(r: DocRow): Document {
  return {
    id: r.id, venueId: r.venue_id,
    leadId: r.lead_id, clientId: r.client_id,
    eventId: r.event_id, vendorId: r.vendor_id,
    name: r.name, fileName: r.file_name, fileSize: r.file_size,
    mimeType: r.mime_type, storagePath: r.storage_path, storageUrl: r.storage_url,
    category: r.category, notes: r.notes, tags: r.tags ?? [],
    expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getDocuments(
  client: DbClient,
  venueId: string,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<Document[]> {
  const col = `${entityType}_id` as "lead_id" | "client_id" | "event_id" | "vendor_id";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("documents").select("*").eq("venue_id", venueId) as any)
    .eq(col, entityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DocRow[]).map(mapDoc);
}

export async function insertDocument(
  client: DbClient,
  venueId: string,
  payload: DocumentUploadPayload,
): Promise<string> {
  const entityCol = `${payload.entityType}_id`;
  const tags = payload.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const row: Record<string, unknown> = {
    venue_id: venueId,
    [entityCol]: payload.entityId,
    name: payload.name.trim() || payload.fileName,
    file_name: payload.fileName,
    file_size: payload.fileSize,
    mime_type: payload.mimeType,
    storage_path: payload.storagePath,
    storage_url: payload.storageUrl,
    category: payload.category,
    notes: payload.notes.trim() || null,
    tags,
    expires_at: payload.expiresAt || null,
  };

  const { data, error } = await client
    .from("documents")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateDocumentMeta(
  client: DbClient,
  venueId: string,
  documentId: string,
  patch: { name?: string; notes?: string; tags?: string[]; expiresAt?: string | null; category?: Document["category"] },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.notes !== undefined) update.notes = patch.notes.trim() || null;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.category !== undefined) update.category = patch.category;
  if ("expiresAt" in patch) update.expires_at = patch.expiresAt || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("documents") as any)
    .update(update)
    .eq("id", documentId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteDocument(
  client: DbClient,
  venueId: string,
  documentId: string,
): Promise<string | null> {
  // Return the storage_path so the caller can remove the file from the bucket
  const { data } = await client
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("venue_id", venueId)
    .maybeSingle<{ storage_path: string }>();

  const { error } = await client
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("venue_id", venueId);
  if (error) throw error;
  return data?.storage_path ?? null;
}
