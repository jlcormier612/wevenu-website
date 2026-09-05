/**
 * Migration Center — shared types.
 *
 * Pipeline: source-specific parser (SourceAdapter) → normalized migration
 * record (this file's MigrationRecord) → validation/dedupe → canonical
 * product entity, created only by the existing, unmodified entity-create
 * functions (createClientCore, ingestLead, createVendorForVenue, etc.).
 * A MigrationRecord is a staging/audit record — never a second
 * representation of a client/lead/vendor/event/payment.
 */

export type SourceKey =
  | "generic_csv"
  | "the_knot"
  | "weddingwire"
  | "planning_pod"
  | "honeybook"
  | "weven_legacy"
  // Adapter: lib/migration/sources/tripleseat.ts (file-based Phase 1).
  // source_profiles row: 20261305000000_source_profiles_tripleseat.sql.
  | "tripleseat";

export type SourceProfile = {
  key: SourceKey;
  displayName: string;
  hasDirectConnection: boolean;
  forwardOnly: boolean;
  exportAssisted: boolean;
  whiteGloveRecommended: boolean;
  supportedFileTypes: string[];
  hasKnownParser: boolean;
  historicalLimitations: string | null;
  isEnabled: boolean;
};

export type MigrationEntityType =
  | "client"
  | "lead"
  | "vendor"
  | "event"
  | "payment"
  | "document"
  | "calendar_block"
  | "date_hold"
  | "tour"
  | "package"
  | "key_date"
  /** Event Order + Invoice + Payment Schedule + optional external contract/docs. */
  | "active_commitment"
  /** Operational couple_guests for an active/future Event. */
  | "guest_list"
  /** Event ↔ Vendor assignment on an active/future Event. */
  | "event_vendor_assignment"
  /** Venue-owned timeline_entries when proximity/finalized/force says import. */
  | "timeline_entry"
  /** Floor plan source files (Document SoR + optional Space template / Event plan). */
  | "floor_plan";

export type SessionStatus =
  | "uploaded"
  | "recognizing"
  | "mapping"
  | "validating"
  | "ready_for_review"
  | "committing"
  | "committed"
  | "partially_committed"
  | "failed"
  | "abandoned";

export type MigrationSession = {
  id: string;
  venueId: string;
  sourceKey: SourceKey;
  status: SessionStatus;
  createdByType: "venue" | "hq_staff";
  createdBy: string | null;
  engagementId: string | null;
  resumable: boolean;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type RecordStatus =
  | "parsed"
  | "normalized"
  | "validated"
  | "duplicate_exact"
  | "duplicate_likely"
  | "conflict"
  | "needs_review"
  | "approved"
  | "rejected"
  | "committed"
  | "skipped";

export type MatchType = "none" | "exact" | "likely";

export type MigrationRecord = {
  id: string;
  sessionId: string;
  venueId: string;
  sourceRowRef: string | null;
  rawPayload: Record<string, unknown>;
  targetEntityType: MigrationEntityType;
  normalizedPayload: Record<string, unknown> | null;
  status: RecordStatus;
  matchType: MatchType;
  matchedEntityId: string | null;
  matchConfidence: number | null;
  conflictFields: Record<string, { existing: unknown; incoming: unknown }> | null;
  validationErrors: string[] | null;
  createdEntityId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  committedAt: string | null;
  /** Concurrent commit/retry lock — independent of status. Null when unclaimed. */
  claimedAt: string | null;
  claimedBy: string | null;
  createdAt: string;
};

/** A single row exactly as read from the uploaded file — column headers as keys. */
export type SourceRow = Record<string, string | null | undefined>;

/** The canonical normalized shape a source-specific parser produces for one row, per target entity. Deliberately mirrors this codebase's existing *Input types (ClientInput/LeadInput/VendorInput) closely, but stays a plain, permissive shape here — validation happens after normalization, not during it. */
export type NormalizedClientLike = {
  firstName: string;
  lastName: string;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  email?: string | null;
  phone?: string | null;
  eventDate?: string | null;
  /** Inclusive end day (multi-day Events). */
  endDate?: string | null;
  eventType?: string | null;
  guestCount?: string | null;
  /** Maps to ClientInput.ceremonyTime → Event.startTime. */
  startTime?: string | null;
  /** Maps to ClientInput.receptionTime → Event.endTime. */
  endTime?: string | null;
  setupTime?: string | null;
  teardownTime?: string | null;
  /** Resolved UUID when known; otherwise resolve spaceName at commit. */
  spaceId?: string | null;
  /** Source space label for review/mapping when UUID is not in the export. */
  spaceName?: string | null;
  notes?: string | null;
  /** The source's own record id, if the export includes one — the repeat-import short-circuit key (§B.4). */
  sourceId?: string | null;
};

export type NormalizedVendorLike = {
  businessName: string;
  category?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  sourceId?: string | null;
};

export type NormalizedLeadLike = NormalizedClientLike & {
  inquiryMessage?: string | null;
  estimatedBudget?: string | null;
};

export type NormalizedCalendarBlockLike = {
  title: string;
  type: string;
  reason?: string | null;
  startDate: string;
  endDate?: string | null;
  isAllDay?: boolean | null;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  recurrenceRule?: string | null;
  recurrenceEndsOn?: string | null;
  recurrenceInterval?: string | null;
  recurrenceCount?: string | null;
  sourceId?: string | null;
};

export type NormalizedDateHoldLike = {
  title: string;
  holdDate: string;
  startTime?: string | null;
  endTime?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  leadEmail?: string | null;
  leadId?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  sourceId?: string | null;
};

export type NormalizedTourLike = {
  scheduledAt: string;
  notes?: string | null;
  leadEmail?: string | null;
  leadId?: string | null;
  sourceId?: string | null;
};

export type NormalizedPackageLike = {
  name: string;
  description?: string | null;
  basePrice?: string | null;
  category?: string | null;
  sourceId?: string | null;
};

export type NormalizedEventLike = {
  name: string;
  eventDate: string;
  eventEndDate?: string | null;
  eventType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  setupTime?: string | null;
  teardownTime?: string | null;
  guestCount?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  sourceId?: string | null;
};

export type NormalizedKeyDateLike = {
  label: string;
  date: string;
  note?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  sourceId?: string | null;
};

/** Real HTC documents row on an event or client — not a migration-only artifact. */
export type NormalizedDocumentLike = {
  name: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  mimeType?: string | null;
  fileSize?: string | null;
  category?: string | null;
  notes?: string | null;
  entityType?: "event" | "client";
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  sourceId?: string | null;
};

/**
 * Floor Plan Phase 3 — batch import of original floor-plan files.
 * See lib/migration/floor-plan-import.ts for matching / reconciliation rules.
 */
export type NormalizedFloorPlanLike = {
  name: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  renderableImageUrl?: string | null;
  mimeType?: string | null;
  fileSize?: string | null;
  scope: "space_master" | "event_specific" | "general_reference";
  spaceId?: string | null;
  spaceName?: string | null;
  eventId?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
  sourceId?: string | null;
  notes?: string | null;
};

export type NormalizationResult =
  | { ok: true; entityType: MigrationEntityType; normalized: Record<string, unknown> }
  | { ok: false; error: string };

/** A source adapter's whole job: recognize its own shape, and turn one raw row into a normalized candidate for one entity type. Nothing downstream is ever source-specific. */
export type SourceAdapter = {
  key: SourceKey;
  /** True if `headers` looks like this source's known export shape. Used for auto-recognition; a venue/operator can always override the detected source manually. */
  recognizes: (headers: string[]) => boolean;
  /** Normalize one raw row. Returns ok:false (never throws) for a row this adapter cannot make sense of — it becomes a `needs_review` record, never silently dropped. */
  normalizeRow: (row: SourceRow, entityType: MigrationEntityType) => NormalizationResult;
};

export type SessionSummary = {
  session: MigrationSession;
  counts: Record<RecordStatus, number>;
  byEntityType: Partial<Record<MigrationEntityType, Record<RecordStatus, number>>>;
};

export type CommitOutcome = {
  committed: number;
  skipped: number;
  failed: number;
};

/** Slice 1 (file retention) — an original uploaded file, as attached to a session. */
export type SessionSourceFile = {
  documentId: string; fileName: string; fileSize: number | null; mimeType: string | null;
  storageUrl: string; uploadedAt: string;
};

/** Slice 2 (resumability) — which step the UI should resume a session into, computed from its actual current record-level state, never a raw status value alone. */
export type SessionResumeState =
  | "needs_processing"   // rows uploaded, dedupe hasn't run (or didn't finish) yet
  | "needs_review"       // dedupe has run; at least one record needs a human decision
  | "ready_to_commit"    // dedupe has run; nothing needs review, nothing committed yet
  | "partially_done"     // some records committed, some still need review
  | "done"               // every record is committed, skipped, or rejected — nothing left to do
  | "empty";             // no records at all yet (shouldn't normally be reachable from the UI)
