/**
 * Document Domain — Adapter Framework (Phase 5 / 2A).
 *
 * Typed rejections for every validation category §8 of this phase's
 * brief requires the framework to reject. None of these VALIDATE
 * anything themselves — each one wraps a Postgres error that a
 * constraint, unique index, or trigger already raised in the Phase 4
 * foundation. This file's only job is turning an opaque database error
 * into a typed, callable-code-legible rejection — "reuse the canonical
 * validation already implemented, do not duplicate validation logic"
 * applies here precisely: there is no re-implementation of any rule
 * below, only translation of the DB's own enforcement into TypeScript.
 *
 * See mapPostgresError() for how a raw Supabase/Postgres error becomes
 * one of these.
 */

export class DocumentDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** canonical_documents_owner_id_shape (Phase 4) — owner_type/owner_id mismatch. */
export class InvalidOwnerError extends DocumentDomainError {
  constructor(detail: string) {
    super(`Invalid Document owner: ${detail}`, "invalid_owner");
  }
}

/** canonical_document_versions_one_current (Phase 4) — a second current version was attempted. */
export class DuplicateCurrentVersionError extends DocumentDomainError {
  constructor(documentId: string) {
    super(`Document ${documentId} already has a current version`, "duplicate_current_version");
  }
}

/** canonical_documents_enforce_transition() (Phase 4) — an illegal status transition. */
export class InvalidTransitionError extends DocumentDomainError {
  constructor(from: string, to: string) {
    super(`Invalid Document status transition: ${from} -> ${to}`, "invalid_transition");
  }
}

/**
 * canonical_document_representations.version_id is NOT NULL + FK (Phase
 * 4) — structurally, this table has no document_id column at all, so an
 * "orphan" representation (one with no valid version) cannot exist in
 * the database; this error exists for the one place it CAN still surface
 * — a caller passing a version_id that does not exist, which the FK
 * constraint rejects.
 */
export class OrphanRepresentationError extends DocumentDomainError {
  constructor(versionId: string) {
    super(`No such Version ${versionId} — a Representation must belong to an existing Version`, "orphan_representation");
  }
}

/** canonical_document_references unique(document_id, reference_type, reference_id, role) (Phase 4). */
export class DuplicateReferenceError extends DocumentDomainError {
  constructor(referenceType: string, referenceId: string, role: string) {
    super(`Reference already exists: ${referenceType}/${referenceId} (${role})`, "duplicate_reference");
  }
}

/** canonical_document_representations.representation_type CHECK enum (Phase 4). */
export class InvalidRepresentationError extends DocumentDomainError {
  constructor(representationType: string) {
    super(`"${representationType}" is not a certified representation type`, "invalid_representation");
  }
}

/** canonical_document_events.event_type CHECK enum (Phase 4) — belt-and-suspenders; CanonicalEventType already makes this a compile-time error for any caller using the types in types.ts. */
export class InvalidEventTypeError extends DocumentDomainError {
  constructor(eventType: string) {
    super(`"${eventType}" is not a certified Document event type`, "invalid_event_type");
  }
}

/**
 * §5 of this phase's brief: some producer contexts cannot resolve to a
 * certified owner type (the documents.lead_id finding) — this is not a
 * database error at all, it is the owner resolver refusing to proceed
 * BEFORE any write is attempted. See owner-resolver.ts.
 */
export class UnresolvableOwnerError extends DocumentDomainError {
  constructor(reason: string) {
    super(`Cannot resolve a certified owner: ${reason}`, "unresolvable_owner");
  }
}

const PG_UNIQUE_VIOLATION = "23505";
const PG_CHECK_VIOLATION = "23514";
const PG_FOREIGN_KEY_VIOLATION = "23503";

/**
 * Translates a raw Postgres/PostgREST error (as thrown by the repository
 * functions in this module) into the appropriate typed error above.
 * Every branch cites the Phase 4 constraint it corresponds to — this
 * function recognizes existing validation, it does not add any.
 */
export function mapPostgresError(error: { code?: string; message?: string; details?: string } | null | undefined, context: Record<string, string> = {}): DocumentDomainError | null {
  if (!error) return null;
  const message = error.message ?? "";

  if (error.code === PG_CHECK_VIOLATION && message.includes("canonical_documents_owner_id_shape")) {
    return new InvalidOwnerError(context.ownerType ? `owner_type=${context.ownerType}` : message);
  }
  if (error.code === PG_UNIQUE_VIOLATION && message.includes("canonical_document_versions_one_current")) {
    return new DuplicateCurrentVersionError(context.documentId ?? "unknown");
  }
  if (message.includes("Invalid Document status transition")) {
    const match = /Invalid Document status transition: (\w+) -> (\w+)/.exec(message);
    return new InvalidTransitionError(match?.[1] ?? "unknown", match?.[2] ?? "unknown");
  }
  if (error.code === PG_FOREIGN_KEY_VIOLATION && message.includes("canonical_document_representations")) {
    return new OrphanRepresentationError(context.versionId ?? "unknown");
  }
  if (error.code === PG_UNIQUE_VIOLATION && message.includes("canonical_document_references")) {
    return new DuplicateReferenceError(
      context.referenceType ?? "unknown",
      context.referenceId ?? "unknown",
      context.role ?? "unknown",
    );
  }
  if (error.code === PG_CHECK_VIOLATION && message.includes("representation_type")) {
    return new InvalidRepresentationError(context.representationType ?? "unknown");
  }
  if (error.code === PG_CHECK_VIOLATION && message.includes("event_type")) {
    return new InvalidEventTypeError(context.eventType ?? "unknown");
  }

  return null;
}
