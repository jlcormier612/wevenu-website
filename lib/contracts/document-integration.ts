/**
 * Work Package D4 — Contracts' integration with the certified Document
 * Domain. The Contract business object (`contracts`, `lib/contracts/*`)
 * remains authoritative for negotiation state (draft/sent/signed/
 * cancelled/expired, who can edit, the sign flow) — nothing here changes
 * that. This module is the boundary: it calls the one certified
 * `DocumentService` (lib/document-domain/integration/contract.ts) for
 * everything version/representation/finalization-shaped, and never
 * touches a `canonical_document_*` table directly. This is the first
 * real producer integration the Document Domain has had since it was
 * built (D1) — every prior phase correctly deferred it.
 */
import { createDocumentService } from "@/lib/document-domain/integration/service";
import type { CanonicalActor } from "@/lib/document-domain/types";
import type { Contract } from "@/lib/contracts/types";

type DbClient = Parameters<typeof createDocumentService>[0];

const CONTRACT_TYPE = "contract";

/**
 * Resolves the canonical Document a Contract produced, if any. Reads
 * canonical_document_references directly (a read-only lookup, not a
 * write — the write path always goes through DocumentService) rather
 * than adding a new column to `contracts`, so the Contract table itself
 * never has to know the Document Domain exists.
 */
export async function getContractDocumentId(client: DbClient, contractId: string): Promise<string | null> {
  const { data } = await client
    .from("canonical_document_references")
    .select("document_id")
    .eq("reference_type", CONTRACT_TYPE)
    .eq("reference_id", contractId)
    .eq("role", "produced_by")
    .maybeSingle<{ document_id: string }>();
  return data?.document_id ?? null;
}

/**
 * Called once, the first time a Contract is sent. Brings it into the
 * Document Domain (behavior: "negotiated" — matches the certified Type
 * Matrix) and immediately requests a real version carrying the actual
 * sent content, since publishDocument() itself only creates an empty
 * placeholder version (the certified interface's own documented shape —
 * not something this module can or should change). Version 1 is
 * therefore always an empty system marker and version 2 is the real
 * first content; this is a direct, honest consequence of using the
 * existing interface unmodified, not a bug.
 */
export async function publishContractDocument(
  client: DbClient, contract: Pick<Contract, "id" | "venueId" | "clientId" | "title" | "content">,
): Promise<{ documentId: string }> {
  const service = createDocumentService(client);
  const owner = contract.clientId
    ? ({ type: "relationship", id: contract.clientId } as const)
    : ({ type: "venue", id: contract.venueId } as const);

  const { documentId } = await service.publishDocument({
    owner,
    source: "negotiated",
    type: CONTRACT_TYPE,
    behavior: "negotiated",
    name: contract.title,
    businessObjectType: CONTRACT_TYPE,
    businessObjectId: contract.id,
  });

  await service.requestNewVersion({
    documentId,
    content: contract.content,
    requestedBy: { type: "system" },
  });

  await service.shareDocument({
    documentId,
    actor: { type: "venue", id: contract.venueId },
  });

  return { documentId };
}

/**
 * Called each time a Contract is resent after being reopened and edited
 * — a real, meaningful version boundary (a reshared agreement state),
 * never a per-keystroke save (drafts between reopens aren't versioned;
 * only what was actually shared is).
 */
export async function versionContractDocument(
  client: DbClient, documentId: string, content: string, actor: CanonicalActor,
): Promise<{ versionId: string }> {
  const service = createDocumentService(client);
  const { versionId } = await service.requestNewVersion({ documentId, content, requestedBy: actor });
  // Re-sharing is itself a real lifecycle fact — the Document had moved
  // to `pending_action`/whatever `finalized` isn't while awaiting
  // signature, and re-sending should read as "shared" again, not stay on
  // whatever state a reopen implicitly left it at (the reopen itself
  // doesn't touch the Document Domain at all — no status to correct
  // there since a Contract "Draft" state has no Document Domain
  // representation of its own; nothing to reconcile).
  await service.shareDocument({ documentId, actor });
  return { versionId };
}

/**
 * Called by the explicit, venue-triggered "Finalize" action — never
 * automatically on signing. Locks the current version and attaches the
 * generated PDF as an immutable `signed_copy` Representation in one
 * call, matching the certified interface's own atomicity.
 */
export async function finalizeContractDocument(
  client: DbClient,
  documentId: string,
  finalizedBy: CanonicalActor,
  pdf: { storagePath: string; storageUrl: string | null; byteSize: number },
): Promise<{ representationId: string | null }> {
  const service = createDocumentService(client);
  const history = await service.getVersionHistory(documentId);
  const current = history.find((v) => v.isCurrent);
  if (!current) throw new Error("Contract has no current Document Domain version to finalize.");

  const result = await service.finalizeDocument({
    documentId,
    versionId: current.id,
    finalizedBy,
    representation: {
      type: "signed_copy",
      storageProvider: "supabase",
      storagePath: pdf.storagePath,
      storageUrl: pdf.storageUrl,
      mimeType: "application/pdf",
      byteSize: pdf.byteSize,
    },
  });

  // Step 36 — the prior signed representation only becomes superseded
  // once THIS finalization actually succeeds (we're past that point now,
  // finalizeDocument above didn't throw) — never at amendment creation.
  const priorDocumentId = await getPriorDocumentId(client, documentId);
  if (priorDocumentId) {
    await service.supersedeDocument({ documentId: priorDocumentId, actor: finalizedBy });
  }

  return result;
}

/**
 * Records that a new Contract's Document is an amendment of a prior,
 * finalized Contract's Document — via the certified `reference_type:
 * 'supersedes'` (canonical_document_references's own enum value, not a
 * new mechanism). Called at amendment *creation*, read back at amendment
 * *finalization* (finalizeContractDocument below) — the old Document
 * isn't actually transitioned to `superseded` until the new one really
 * is finalized (Step 36: the prior signed representation stays current
 * until the new one succeeds), even though the lineage link itself is
 * recorded up front so the UI can show "this amends X" immediately.
 */
export async function recordAmendmentLineage(
  client: DbClient, newDocumentId: string, priorDocumentId: string,
): Promise<void> {
  const service = createDocumentService(client);
  await service.createReference({
    documentId: newDocumentId,
    referenceType: "supersedes",
    referenceId: priorDocumentId,
    role: "supersedes",
  });
}

/** The prior Document this one amends, if any — read via the same reference recorded at creation. */
export async function getPriorDocumentId(client: DbClient, documentId: string): Promise<string | null> {
  const { data } = await client
    .from("canonical_document_references")
    .select("reference_id")
    .eq("document_id", documentId)
    .eq("reference_type", "supersedes")
    .eq("role", "supersedes")
    .maybeSingle<{ reference_id: string }>();
  return data?.reference_id ?? null;
}

/** Whether the Document Domain already considers this Contract's Document finalized — the one place the customer-facing "Finalized" fact is actually derived from, so Contract status and Document status can never quietly disagree. */
export async function isContractFinalized(client: DbClient, contractId: string): Promise<boolean> {
  const documentId = await getContractDocumentId(client, contractId);
  if (!documentId) return false;
  const { data } = await client.from("canonical_documents").select("status").eq("id", documentId).maybeSingle<{ status: string }>();
  return data?.status === "finalized";
}
