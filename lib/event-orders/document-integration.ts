/**
 * Work Package D5C — Event Order's integration with the certified Document
 * Domain. Mirrors lib/contracts/document-integration.ts's own boundary
 * discipline exactly: the Event Order business object (`event_orders`,
 * `lib/event-orders/*`) remains authoritative for the operational/
 * commercial record itself — sections, lines, status, revision. This
 * module is the boundary for everything version/representation-shaped;
 * it never touches a `canonical_document_*` table directly.
 *
 * Simpler than Contract's own integration because Event Order has no
 * negotiation phase — no client editing, no signature. Behavior:
 * 'venue_authored' (Type Matrix — venue produces it, no counterparty
 * collaboration), not 'negotiated'. Each "Share with Client" call requests
 * a fresh version of the current content and finalizes it — the Document
 * transitions draft → shared → finalized on the first call, and every
 * later call is a legal same-state no-op transition (finalized →
 * finalized) that still locks a genuinely new version and attaches a
 * genuinely new representation — confirmed against the certified
 * transition table (`p_from = p_to` is always a valid no-op).
 */
import { createDocumentService } from "@/lib/document-domain/integration/service";
import type { CanonicalActor } from "@/lib/document-domain/types";

type DbClient = Parameters<typeof createDocumentService>[0];

const EVENT_ORDER_TYPE = "event_order";

/** Reads canonical_document_references directly (read-only) — the write path always goes through DocumentService. */
export async function getEventOrderDocumentId(client: DbClient, eventOrderId: string): Promise<string | null> {
  const { data } = await client
    .from("canonical_document_references")
    .select("document_id")
    .eq("reference_type", EVENT_ORDER_TYPE)
    .eq("reference_id", eventOrderId)
    .eq("role", "produced_by")
    .maybeSingle<{ document_id: string }>();
  return data?.document_id ?? null;
}

/** Called once, the first time an Event Order is shared. publishDocument() creates an empty placeholder v1 (the certified interface's own documented shape); requestNewVersion immediately supplies the real content. */
async function publishEventOrderDocument(
  client: DbClient, eventOrderId: string, eventId: string, name: string, content: string, actor: CanonicalActor,
): Promise<{ documentId: string }> {
  const service = createDocumentService(client);
  const { documentId } = await service.publishDocument({
    owner: { type: "event", id: eventId },
    source: "generated",
    type: EVENT_ORDER_TYPE,
    behavior: "venue_authored",
    name,
    businessObjectType: EVENT_ORDER_TYPE,
    businessObjectId: eventOrderId,
  });
  await service.requestNewVersion({ documentId, content, requestedBy: actor });
  await service.shareDocument({ documentId, actor });
  return { documentId };
}

/**
 * The one real action: "Share with Client." Ensures a canonical Document
 * exists, requests a fresh version carrying the Event Order's current
 * content snapshot, generates+attaches the PDF, and locks that version —
 * atomically, via finalizeDocument's own certified shape. A prior
 * representation (from an earlier reopen → edit → re-share cycle) is
 * never touched or overwritten; getVersionHistory still returns it
 * exactly as it was, immutable.
 */
export async function shareEventOrderDocument(
  client: DbClient,
  eventOrderId: string, eventId: string, name: string, content: string, actor: CanonicalActor,
  pdf: { storagePath: string; storageUrl: string | null; byteSize: number },
): Promise<{ documentId: string; representationId: string | null }> {
  const service = createDocumentService(client);
  let documentId = await getEventOrderDocumentId(client, eventOrderId);

  if (!documentId) {
    const published = await publishEventOrderDocument(client, eventOrderId, eventId, name, content, actor);
    documentId = published.documentId;
  } else {
    await service.requestNewVersion({ documentId, content, requestedBy: actor });
  }

  const history = await service.getVersionHistory(documentId);
  const current = history.find((v) => v.isCurrent);
  if (!current) throw new Error("Event Order has no current Document Domain version to finalize.");

  const result = await service.finalizeDocument({
    documentId,
    versionId: current.id,
    finalizedBy: actor,
    representation: {
      type: "pdf",
      storageProvider: "supabase",
      storagePath: pdf.storagePath,
      storageUrl: pdf.storageUrl,
      mimeType: "application/pdf",
      byteSize: pdf.byteSize,
    },
  });

  return { documentId, representationId: result.representationId };
}
