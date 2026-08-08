/**
 * Document Domain — Document Service (Phase 2B, renamed/reshaped in
 * Phase 2C per direct redirect).
 *
 * The one shared implementation of DocumentService (contract.ts). Every
 * future producer gets this same object — there is no per-producer
 * subclass or override point; a producer needing its own branch here
 * would be the signal that this design failed, not a place to add one.
 *
 * Delegates every write to repository.ts (Phase 5, unchanged) and every
 * read to repository.ts's read functions; the only logic native to this
 * file is choosing WHICH repository calls a given generic action
 * implies, in what order — the event itself is always decided by
 * event-translation.ts, never here.
 */

import { createClient } from "@/integrations/supabase/server";
import * as repo from "@/lib/document-domain/repository";
import {
  eventForInitialVersion,
  eventForNewVersion,
  eventForFinalization,
  eventForRepresentationRequest,
} from "@/lib/document-domain/integration/event-translation";
import type { DocumentService, DocumentLifecycleActionRequest } from "@/lib/document-domain/integration/contract";
import type {
  PublishDocumentRequest,
  RequestNewVersionRequest,
  FinalizeDocumentRequest,
  RequestRepresentationRequest,
  CreateReferenceRequest,
  CanonicalRepresentation,
  CanonicalVersionSummary,
  CanonicalAuditEntry,
} from "@/lib/document-domain/integration/types";
import type { CanonicalDocumentStatus, CanonicalEventType } from "@/lib/document-domain/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The system actor used for events this layer emits on the Business
 * Object's behalf rather than a specific human/entity acting — creation
 * and version-generation events describe content coming into existence,
 * not a person's action, so they're attributed to `system` unless a
 * future need arises to attribute them otherwise. finalizeDocument, by
 * contrast, always uses the caller-supplied `finalizedBy` actor, since
 * finalizing genuinely is someone's (or something's) action.
 */
const SYSTEM_ACTOR = { type: "system" as const };

export function createDocumentService(client: DbClient): DocumentService {
  /**
   * Shared body for the six named lifecycle methods below
   * (shareDocument/archiveDocument/supersedeDocument/deleteDocument/
   * expireDocument/recordDocumentViewed) — each is "emit this one fixed
   * canonical event, and if it names a certified Status, transition to
   * it first." Without the Status transition, a Business Object would
   * have no way to move a fresh Document out of `draft` at all, since
   * the public interface lists no separate "transition status"
   * capability and finalizeDocument only accepts `shared`/
   * `pending_action` as its starting point
   * (canonical_document_validate_status_transition, Phase 4). Reuses
   * that same certified trigger for validation — an invalid attempt
   * (e.g. sharing an already-finalized Document) is rejected by the
   * trigger itself and surfaces as the existing InvalidTransitionError,
   * not a new check duplicated here.
   */
  async function emitLifecycleEvent(
    request: DocumentLifecycleActionRequest,
    eventType: CanonicalEventType,
    status: CanonicalDocumentStatus | null,
  ): Promise<{ eventId: string }> {
    if (status) {
      await repo.transitionStatus(client, request.documentId, status);
    }
    return repo.emitEvent(client, {
      documentId: request.documentId,
      eventType,
      actor: request.actor,
      payload: request.payload,
    });
  }

  return {
    async publishDocument(request: PublishDocumentRequest) {
      const { documentId } = await repo.createDocument(client, {
        owner: request.owner,
        source: request.source,
        type: request.type,
        behavior: request.behavior,
        name: request.name,
      });

      const { versionId } = await repo.createVersion(client, {
        documentId,
        createdBy: SYSTEM_ACTOR,
      });

      await repo.addReference(client, {
        documentId,
        referenceType: request.businessObjectType,
        referenceId: request.businessObjectId,
        role: "produced_by",
      });

      await repo.emitEvent(client, {
        documentId,
        versionId,
        eventType: eventForInitialVersion(request.source),
        actor: SYSTEM_ACTOR,
      });

      return { documentId, versionId };
    },

    async requestNewVersion(request: RequestNewVersionRequest) {
      const { versionId, sequenceNumber } = await repo.createVersion(client, {
        documentId: request.documentId,
        content: request.content,
        createdBy: request.requestedBy,
      });

      await repo.emitEvent(client, {
        documentId: request.documentId,
        versionId,
        eventType: eventForNewVersion(),
        actor: request.requestedBy,
      });

      return { versionId, sequenceNumber };
    },

    async finalizeDocument(request: FinalizeDocumentRequest) {
      let representationId: string | null = null;
      if (request.representation) {
        const rep = await repo.createRepresentation(client, {
          versionId: request.versionId,
          representationType: request.representation.type,
          storageProvider: request.representation.storageProvider,
          storagePath: request.representation.storagePath,
          storageUrl: request.representation.storageUrl,
          mimeType: request.representation.mimeType,
          byteSize: request.representation.byteSize,
          checksum: request.representation.checksum,
          generatedBy: request.finalizedBy,
        });
        representationId = rep.representationId;
      }

      await repo.lockVersion(client, request.versionId);
      await repo.transitionStatus(client, request.documentId, "finalized");

      const behavior = await repo.getDocumentBehavior(client, request.documentId);
      const eventType = await eventForFinalization(client, behavior);

      await repo.emitEvent(client, {
        documentId: request.documentId,
        versionId: request.versionId,
        eventType,
        actor: request.finalizedBy,
      });

      return { representationId };
    },

    async generateRepresentation(request: RequestRepresentationRequest) {
      const { representationId } = await repo.createRepresentation(client, {
        versionId: request.versionId,
        representationType: request.representationType,
        storageProvider: request.storageProvider,
        storagePath: request.storagePath,
        storageUrl: request.storageUrl,
        mimeType: request.mimeType,
        byteSize: request.byteSize,
        checksum: request.checksum,
        generatedBy: request.requestedBy,
      });

      // Representations belong to a Version, not a Document directly —
      // the event is still recorded against the owning Document (every
      // canonical event is), found via the Version's own audit context.
      const documentId = await repo.getDocumentIdForVersion(client, request.versionId);
      await repo.emitEvent(client, {
        documentId,
        versionId: request.versionId,
        eventType: eventForRepresentationRequest(),
        actor: request.requestedBy,
      });

      return { representationId };
    },

    async createReference(request: CreateReferenceRequest) {
      return repo.addReference(client, {
        documentId: request.documentId,
        referenceType: request.referenceType,
        referenceId: request.referenceId,
        role: request.role,
      });
    },

    shareDocument: (request) => emitLifecycleEvent(request, "document_shared", "shared"),
    archiveDocument: (request) => emitLifecycleEvent(request, "document_archived", "archived"),
    supersedeDocument: (request) => emitLifecycleEvent(request, "document_superseded", "superseded"),
    deleteDocument: (request) => emitLifecycleEvent(request, "document_deleted", "deleted"),
    expireDocument: (request) => emitLifecycleEvent(request, "document_expired", null),
    recordDocumentViewed: (request) => emitLifecycleEvent(request, "document_viewed", null),

    async getCurrentRepresentation(documentId: string): Promise<CanonicalRepresentation | null> {
      return repo.getCurrentRepresentation(client, documentId);
    },

    async getVersionHistory(documentId: string): Promise<CanonicalVersionSummary[]> {
      return repo.getVersionHistory(client, documentId);
    },

    async getAuditHistory(documentId: string): Promise<CanonicalAuditEntry[]> {
      return repo.getAuditHistory(client, documentId);
    },
  };
}
