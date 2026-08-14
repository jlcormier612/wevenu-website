/**
 * Document Domain — Adapter Framework (Phase 5 / 2A).
 *
 * Shared types every producer adapter uses. Nothing here is producer-
 * specific — a producer-specific adapter (Contracts, Vendor Documents,
 * etc. — none implemented this phase, see docs/document-domain-adapter-
 * plan.md) translates ITS OWN shape into these before calling into
 * lib/document-domain/base-adapter.ts.
 *
 * Mirrors the DB enums in supabase/migrations/20261213000000_document_
 * domain_foundation.sql exactly — these unions exist so an invalid value
 * is a compile-time error here, on top of (never instead of) the DB's own
 * CHECK constraints, which remain the source of truth.
 */

export type CanonicalOwnerType = "system" | "venue" | "relationship" | "event" | "vendor";
export type CanonicalActorType = "system" | "venue" | "relationship" | "event" | "vendor" | "ai";

export type CanonicalDocumentSource = "uploaded" | "generated" | "negotiated" | "ai_generated";

export type CanonicalDocumentBehavior =
  | "collaborative"
  | "venue_authored"
  | "negotiated"
  | "reference"
  | "generated"
  | "submitted";

export type CanonicalDocumentStatus =
  | "draft"
  | "in_review"
  | "shared"
  | "pending_action"
  | "finalized"
  | "superseded"
  | "archived"
  | "deleted";

export type CanonicalRepresentationType = "pdf" | "image" | "print_layout" | "export" | "signed_copy";

export type CanonicalStorageProvider = "supabase" | "external";

export type CanonicalEventType =
  | "document_uploaded"
  | "document_generated"
  | "document_shared"
  | "document_viewed"
  | "document_approved"
  | "document_signed"
  | "document_superseded"
  | "document_expired"
  | "document_archived"
  | "document_deleted";

/**
 * "System" is the only owner type with no id — every other variant
 * carries the id of the entity it maps to (venues.id / clients.id /
 * events.id / vendors.id — "Relationship" in product language is backed
 * by `clients`, per the certified architecture's own note).
 */
export type CanonicalOwner =
  | { type: "system" }
  | { type: "venue"; id: string }
  | { type: "relationship"; id: string }
  | { type: "event"; id: string }
  | { type: "vendor"; id: string };

export type CanonicalActor =
  | { type: "system" }
  | { type: "venue"; id: string }
  | { type: "relationship"; id: string }
  | { type: "event"; id: string }
  | { type: "vendor"; id: string }
  | { type: "ai" };

export type CreateDocumentInput = {
  owner: CanonicalOwner;
  source: CanonicalDocumentSource;
  type: string;
  behavior: CanonicalDocumentBehavior;
  name: string;
  notes?: string | null;
  tags?: string[];
  expiresAt?: string | null;
  retentionPolicy?: string | null;
};

export type CreateVersionInput = {
  documentId: string;
  content?: string | null;
  createdBy: CanonicalActor;
};

export type CreateRepresentationInput = {
  versionId: string;
  representationType: CanonicalRepresentationType;
  storageProvider?: CanonicalStorageProvider;
  storagePath?: string | null;
  storageUrl?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  checksum?: string | null;
  generatedBy: CanonicalActor;
};

export type AddReferenceInput = {
  documentId: string;
  referenceType: string;
  referenceId: string;
  role: string;
};

export type EmitEventInput = {
  documentId: string;
  versionId?: string | null;
  eventType: CanonicalEventType;
  actor: CanonicalActor;
  payload?: Record<string, unknown>;
};

/** The generic shape every producer's "adapt one record" call reduces to. */
export type AdaptProducerInput = {
  owner: CanonicalOwner;
  source: CanonicalDocumentSource;
  type: string;
  behavior: CanonicalDocumentBehavior;
  name: string;
  /** The producer's own table name / concept — e.g. "contract", "vendor_library_document". */
  referenceType: string;
  /** The producer's own row id. */
  referenceId: string;
  /** Defaults to "produced_by" — see canonical_document_references.role, architecture §5. */
  referenceRole?: string;
};

export type AdaptProducerResult = {
  documentId: string;
  /** false when an existing adaptation was found (idempotent no-op) or a concurrent caller won the race. */
  created: boolean;
};

/**
 * Read models (Phase 6 / 2B) — "Retrieve current Representation,"
 * "Retrieve version history," "Retrieve audit history" (§2). Phase 5's
 * framework was write-only; these are the first read shapes in the
 * Document Domain module.
 */
export type CanonicalRepresentation = {
  id: string;
  versionId: string;
  representationType: CanonicalRepresentationType;
  storageProvider: CanonicalStorageProvider;
  storagePath: string | null;
  storageUrl: string | null;
  mimeType: string | null;
  byteSize: number | null;
  checksum: string | null;
  generatedBy: CanonicalActor;
  createdAt: string;
};

export type CanonicalVersionSummary = {
  id: string;
  documentId: string;
  sequenceNumber: number;
  isCurrent: boolean;
  lockedAt: string | null;
  createdBy: CanonicalActor;
  createdAt: string;
};

export type CanonicalAuditEntry = {
  id: string;
  documentId: string;
  versionId: string | null;
  action: string;
  actor: CanonicalActor;
  detail: Record<string, unknown>;
  createdAt: string;
};
