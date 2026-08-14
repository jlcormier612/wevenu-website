/**
 * Document Domain — Document Service (Phase 2B, renamed/reshaped in
 * Phase 2C per direct redirect: named business-level operations instead
 * of one generic publishEvent(eventType) dispatcher).
 *
 * This is the public API of the Document Domain. It sits above the
 * Adapter Framework (repository.ts / base-adapter.ts) and below every
 * Business Object. "The interface must be identical regardless of
 * producer" — every future producer (Contracts, Invoices, Vendor
 * Documents, Questionnaires, Floor Plans, AI, etc.) calls this exact
 * shape, with no producer-specific parameters anywhere in it. A Business
 * Object never calls repository.ts or base-adapter.ts directly — those
 * remain an infrastructure detail behind this interface. service.ts
 * provides the one shared implementation; no producer ever writes its
 * own.
 */

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
import type { CanonicalActor } from "@/lib/document-domain/types";

/**
 * Shared shape for the six lifecycle actions below — each is "a business
 * decision was made about this Document" with nothing else to say about
 * it beyond who made it and, optionally, why. Kept as one type rather
 * than six identical ones.
 */
export type DocumentLifecycleActionRequest = {
  documentId: string;
  actor: CanonicalActor;
  payload?: Record<string, unknown>;
};

/**
 * The public API of the Document Domain. This type is the only thing a
 * Business Object is ever allowed to hold a reference to — never
 * repository.ts, never base-adapter.ts, never a canonical_document_*
 * table.
 */
export interface DocumentService {
  /** Publish a Document — brings a Business Object's first content into the canonical Document Domain as an initial, unlocked Version. */
  publishDocument(request: PublishDocumentRequest): Promise<{ documentId: string; versionId: string }>;

  /** Request a new Version. */
  requestNewVersion(request: RequestNewVersionRequest): Promise<{ versionId: string; sequenceNumber: number }>;

  /** Finalize a Document — locks the given Version, optionally attaches the Representation it produced, transitions the Document to `finalized`, and emits whichever canonical event its Behavior implies. */
  finalizeDocument(request: FinalizeDocumentRequest): Promise<{ representationId: string | null }>;

  /** Generate a Representation — requested, never created directly by the Business Object (architecture §8: Representations remain immutable, and only the Document Domain creates them). */
  generateRepresentation(request: RequestRepresentationRequest): Promise<{ representationId: string }>;

  /** Create a Reference — the only way a Business Object may ever link itself (or anything else) to a Document; canonical_document_references is never written to directly. */
  createReference(request: CreateReferenceRequest): Promise<{ referenceId: string }>;

  /** Share a Document — transitions it to `shared` and emits `document_shared`. Reuses the certified lifecycle trigger for validation; an illegal attempt (e.g. sharing an already-finalized Document) is rejected there, not re-checked here. */
  shareDocument(request: DocumentLifecycleActionRequest): Promise<{ eventId: string }>;

  /** Archive a Document — transitions it to `archived` and emits `document_archived`. */
  archiveDocument(request: DocumentLifecycleActionRequest): Promise<{ eventId: string }>;

  /** Supersede a Document — transitions a `finalized` Document to `superseded` and emits `document_superseded`; the certified target for "a newer Version/Document has replaced this one" (only legal from `finalized`, per the lifecycle trigger). */
  supersedeDocument(request: DocumentLifecycleActionRequest): Promise<{ eventId: string }>;

  /** Delete a Document — a soft, canonical `deleted` status transition and `document_deleted` event; the source producer's own row may or may not still exist, independently. */
  deleteDocument(request: DocumentLifecycleActionRequest): Promise<{ eventId: string }>;

  /** Mark a Document expired — emits `document_expired`. No certified Status names "expired" directly, so this is event-only; it does not transition Status. */
  expireDocument(request: DocumentLifecycleActionRequest): Promise<{ eventId: string }>;

  /** Record that a Document was viewed — emits `document_viewed`. Event-only, never transitions Status. */
  recordDocumentViewed(request: DocumentLifecycleActionRequest): Promise<{ eventId: string }>;

  /** Retrieve current Representation. */
  getCurrentRepresentation(documentId: string): Promise<CanonicalRepresentation | null>;

  /** Retrieve version history. */
  getVersionHistory(documentId: string): Promise<CanonicalVersionSummary[]>;

  /** Retrieve audit history. */
  getAuditHistory(documentId: string): Promise<CanonicalAuditEntry[]>;
}
