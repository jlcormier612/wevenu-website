/**
 * Document Domain — Adapter Framework (Phase 5 / 2A).
 *
 * The Canonical Adapter Interface (§3 of this phase's brief) — the one
 * contract every future producer-specific adapter implements. No
 * producer-specific adapter is implemented in this phase (§9); this file
 * exists so that when one is, it has exactly one shape to conform to,
 * not seven independently-invented ones.
 *
 * §2's constraint governs every method below: "Adapters must never
 * contain business rules that belong to the producing system [or] that
 * belong to the canonical Document Domain. They are translation layers
 * only." Concretely, that means a producer-specific implementation of
 * this interface should do two things per method, and nothing else:
 *   1. Read whatever shape the producer's own data already has.
 *   2. Call the matching shared function in repository.ts / base-
 *      adapter.ts with the translated input.
 * If a method body needs a conditional beyond that translation, it is
 * very likely smuggling a business rule that belongs somewhere else.
 *
 * writeAudit is deliberately NOT a member of this interface — see the
 * note above its would-be position below.
 */

import type { AdaptProducerResult, CreateRepresentationInput } from "@/lib/document-domain/types";
import type { OwnerResolution } from "@/lib/document-domain/owner-resolver";

/**
 * `TProducerRecord` is whatever shape the producer's own row already has
 * (e.g. a `Contract` type from lib/contracts/types.ts) — this interface
 * is generic over it so the shared framework never needs to know any
 * producer's internal schema.
 */
export interface CanonicalDocumentAdapter<TProducerRecord> {
  /**
   * Create Document (§3). Resolves this producer record's owner (via
   * owner-resolver.ts — never re-implemented per-adapter) and, if
   * resolvable, idempotently creates or finds the canonical Document via
   * base-adapter.ts's adaptProducerToCanonicalDocument(). Returns the
   * resolver's refusal reason, unchanged, when ownership cannot be
   * certified — an adapter must surface this, never swallow it or
   * substitute a different owner type to force a resolution.
   */
  resolveOwner(record: TProducerRecord): OwnerResolution;
  createDocument(record: TProducerRecord): Promise<AdaptProducerResult>;

  /** Create Version (§3) — delegates to repository.createVersion() after translating producer content. */
  createVersion(documentId: string, record: TProducerRecord): Promise<{ versionId: string }>;

  /**
   * Generate Representation (§3) — only meaningful when
   * canonical_document_behavior_capabilities(behavior) says
   * generates_representation is true (Phase 4). An adapter for a
   * Behavior that never generates one (e.g. Submitted) implements this
   * by returning null, not by omitting the method.
   */
  generateRepresentation(versionId: string, record: TProducerRecord): Promise<{ representationId: string } | null>;

  /** Attach Representation (§3) — for a Representation produced outside this call (e.g. an externally rendered PDF) rather than generated inline. */
  attachRepresentation(versionId: string, input: Omit<CreateRepresentationInput, "versionId">): Promise<{ representationId: string }>;

  /** Add References (§3) — Business Object / Message / Task linkage beyond the automatic "produced_by" reference adaptProducerToCanonicalDocument() already creates. */
  addReferences(documentId: string, record: TProducerRecord): Promise<void>;

  /**
   * Emit Canonical Events (§3, §6) — an adapter may only emit
   * CanonicalEventType values (types.ts); this is enforced twice: at
   * compile time by the type itself, and at the DB by
   * canonical_document_events' CHECK constraint (Phase 4) if a caller
   * bypasses TypeScript. No producer-specific event name is ever valid.
   */
  emitEvents(documentId: string, versionId: string | null, record: TProducerRecord): Promise<void>;

  /**
   * Return Canonical IDs (§3) — every method above already returns the
   * relevant canonical id(s) directly; this is not a ninth method, it is
   * the contract that every method obeys. Stated explicitly here so an
   * implementer cannot satisfy the interface with a void-returning
   * method and call it compliant.
   */
}

/**
 * "Write Audit Entry" (§3) is listed as one of the interface's minimum
 * capabilities, but is deliberately NOT a method on
 * CanonicalDocumentAdapter above. Per §7 — "No producer may write
 * directly into canonical audit tables. Every adapter must write audit
 * history through one shared mechanism" — audit writing is not something
 * a producer adapter implements differently; it is a structural
 * byproduct of calling repository.emitEvent() (which writes both the
 * event and its audit entry in one call, see repository.ts). A producer
 * adapter that implements emitEvents() above by calling
 * repository.emitEvent() has already satisfied the audit requirement —
 * there is no separate hook to implement, and no direct path to
 * canonical_document_audit exists anywhere a producer adapter could
 * reach it instead.
 */
