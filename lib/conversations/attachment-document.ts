/**
 * Message attachment → authoritative Documents registration.
 *
 * Message attachment = delivery/conversation context (conversation_message_attachments).
 * Documents row = workspace system of record (public.documents).
 *
 * Same underlying storage object is referenced — no second physical upload.
 * Destination uses unambiguous lead / client / single-event rules only.
 */
import type { createClient } from "@/integrations/supabase/server";
import * as documentsRepo from "@/lib/documents/repository";
import type { DocumentEntityType } from "@/lib/documents/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type AttachmentDocumentTarget = {
  entityType: DocumentEntityType;
  entityId: string;
};

/**
 * Pure destination rule — no earliest-event inventing.
 * - client + exactly one event → event (matches Booking Documents + lead→client remap)
 * - client + zero events → client
 * - client + multiple events → client only (no arbitrary event pick)
 * - lead only → lead
 */
export function chooseAttachmentDocumentTarget(input: {
  leadId: string | null;
  clientId: string | null;
  eventIds: string[];
}): AttachmentDocumentTarget | null {
  if (input.clientId) {
    if (input.eventIds.length === 1) {
      return { entityType: "event", entityId: input.eventIds[0]! };
    }
    return { entityType: "client", entityId: input.clientId };
  }
  if (input.leadId) {
    return { entityType: "lead", entityId: input.leadId };
  }
  return null;
}

/** Extract storage object path from a public Supabase storage URL. */
export function storagePathFromPublicUrl(url: string): string {
  for (const bucket of ["couple-messages", "documents"] as const) {
    const marker = `/object/public/${bucket}/`;
    const i = url.indexOf(marker);
    if (i >= 0) return decodeURIComponent(url.slice(i + marker.length));
  }
  return url;
}

/**
 * True when deleteDocument may safely remove the object from the `documents` bucket.
 * Conversation uploads live under couple-messages (`conversations/…`) and must not
 * be destroyed when a Documents row is deleted independently.
 */
export function isDocumentsBucketPath(storagePath: string): boolean {
  if (!storagePath) return false;
  if (storagePath.startsWith("conversations/")) return false;
  return true;
}

export function documentsWorkspaceHref(input: {
  leadId: string | null;
  clientId: string | null;
}): string | null {
  if (input.clientId) return `/clients/${input.clientId}#documents`;
  if (input.leadId) return `/leads/${input.leadId}`;
  return null;
}

async function resolveLeadClientForMessage(
  client: DbClient,
  messageId: string,
): Promise<{ venueId: string; leadId: string | null; clientId: string | null } | null> {
  const { data: message } = await client
    .from("conversation_messages")
    .select("id, venue_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle<{ id: string; venue_id: string; conversation_id: string }>();
  if (!message) return null;

  const { data: convo } = await client
    .from("conversations")
    .select("relationship_id, event_vendor_assignment_id")
    .eq("id", message.conversation_id)
    .maybeSingle<{ relationship_id: string | null; event_vendor_assignment_id: string | null }>();
  if (!convo?.relationship_id) {
    // Vendor-anchored conversations are outside venue Inbox document sync.
    return null;
  }

  const [{ data: booked }, { data: lead }] = await Promise.all([
    client
      .from("clients")
      .select("id")
      .eq("relationship_id", convo.relationship_id)
      .eq("venue_id", message.venue_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
    client
      .from("leads")
      .select("id")
      .eq("relationship_id", convo.relationship_id)
      .eq("venue_id", message.venue_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  return {
    venueId: message.venue_id,
    clientId: booked?.id ?? null,
    leadId: lead?.id ?? null,
  };
}

async function eventIdsForClient(client: DbClient, venueId: string, clientId: string): Promise<string[]> {
  const { data } = await client
    .from("events")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId);
  return ((data ?? []) as { id: string }[]).map((e) => e.id);
}

/**
 * After a message attachment row exists, register the same file in Documents.
 * Failures are logged and do not roll back the message attachment.
 */
export async function registerMessageAttachmentAsDocument(
  client: DbClient,
  input: {
    messageId: string;
    attachmentId?: string;
    file: { url: string; name: string; size?: number | null; mimeType?: string | null };
  },
): Promise<{ ok: true; documentId: string } | { ok: false; reason: string }> {
  const ids = await resolveLeadClientForMessage(client, input.messageId);
  if (!ids) return { ok: false, reason: "no_relationship_destination" };

  const eventIds = ids.clientId ? await eventIdsForClient(client, ids.venueId, ids.clientId) : [];
  const target = chooseAttachmentDocumentTarget({
    leadId: ids.leadId,
    clientId: ids.clientId,
    eventIds,
  });
  if (!target) return { ok: false, reason: "no_destination" };

  const storagePath = storagePathFromPublicUrl(input.file.url);
  const sourceNote = input.attachmentId
    ? `Shared in conversation (attachment ${input.attachmentId})`
    : `Shared in conversation (message ${input.messageId})`;

  try {
    const documentId = await documentsRepo.insertDocument(client, ids.venueId, {
      entityType: target.entityType,
      entityId: target.entityId,
      name: input.file.name,
      category: "other",
      notes: sourceNote,
      tags: "from_conversation",
      expiresAt: "",
      fileName: input.file.name,
      fileSize: input.file.size ?? 0,
      mimeType: input.file.mimeType ?? "",
      storagePath,
      storageUrl: input.file.url,
    });
    return { ok: true, documentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "insert_failed";
    return { ok: false, reason: message };
  }
}
