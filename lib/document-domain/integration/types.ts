/**
 * Document Domain — Business Object Integration Contract (Phase 6 / 2B).
 *
 * Types for the business-object-facing layer. Distinct from Phase 5's
 * adapter-facing types (lib/document-domain/types.ts, still used
 * underneath): those describe "how to translate one producer row into
 * canonical writes." These describe "what a Business Object's own
 * service code asks the Document Domain to do" — a smaller, higher-level
 * vocabulary that stays identical across every producer (§2: "The
 * interface must be identical regardless of producer").
 */

import type {
  CanonicalActor,
  CanonicalAuditEntry,
  CanonicalDocumentBehavior,
  CanonicalDocumentSource,
  CanonicalOwner,
  CanonicalRepresentation,
  CanonicalRepresentationType,
  CanonicalStorageProvider,
  CanonicalVersionSummary,
} from "@/lib/document-domain/types";

/**
 * Everything a Business Object provides once, to bring its first Document
 * into existence via DocumentService.publishDocument(). Mirrors
 * AdaptProducerInput (Phase 5) deliberately — "publish a Document" and
 * "adapt a producer record" are the same underlying operation seen from
 * two different callers; this type exists so a Business Object never has
 * to know Phase 5's own vocabulary (referenceType/referenceId/
 * referenceRole) to use it.
 */
export type PublishDocumentRequest = {
  owner: CanonicalOwner;
  source: CanonicalDocumentSource;
  type: string;
  behavior: CanonicalDocumentBehavior;
  name: string;
  /** This Business Object's own concept name — e.g. "contract" — and its own row id. Becomes the canonical Reference, never exposed as raw table access to the caller. */
  businessObjectType: string;
  businessObjectId: string;
};

export type RequestNewVersionRequest = {
  documentId: string;
  content?: string | null;
  requestedBy: CanonicalActor;
};

/**
 * DocumentService.finalizeDocument()'s request — the one generic action
 * every producer's "I'm done" moment reduces to (signing, issuing,
 * submitting, completing). See event-translation.ts for how the
 * resulting canonical event is derived from Behavior alone, never from
 * which producer called this.
 */
export type FinalizeDocumentRequest = {
  documentId: string;
  versionId: string;
  finalizedBy: CanonicalActor;
  /** Present when this finalization also produces the Document's artifact (a signed PDF, an issued invoice PDF, a submitted snapshot) — absent for Behaviors that finalize without one (e.g. a Reference document being Published has nothing new to generate). */
  representation?: {
    type: CanonicalRepresentationType;
    storageProvider?: CanonicalStorageProvider;
    storagePath?: string | null;
    storageUrl?: string | null;
    mimeType?: string | null;
    byteSize?: number | null;
    checksum?: string | null;
  } | null;
};

export type RequestRepresentationRequest = {
  versionId: string;
  representationType: CanonicalRepresentationType;
  storageProvider?: CanonicalStorageProvider;
  storagePath?: string | null;
  storageUrl?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  checksum?: string | null;
  requestedBy: CanonicalActor;
};

export type CreateReferenceRequest = {
  documentId: string;
  /** The OTHER entity being linked — e.g. a Message attaching this Document, not the Business Object that owns it (that reference already exists from creation). */
  referenceType: string;
  referenceId: string;
  role: string;
};

export type { CanonicalAuditEntry, CanonicalRepresentation, CanonicalVersionSummary };
