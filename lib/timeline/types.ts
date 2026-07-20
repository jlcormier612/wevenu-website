/**
 * Timeline domain types (Sprint 12 — Day-of Timeline; sections, notes,
 * links, and attachments added in the Booking Timeline Experience task).
 */

// docs/client-workspace-product-architecture.md §12 — the approved
// Visibility vocabulary in full (matches the DB check constraint). "venue"
// and "client" are kept as valid values for precision/future use, but
// aren't offered as picker toggles below: per the approved workflow, the
// venue's own live framework is always visible to the client (they're
// planning inside it) and the venue always reads the client's latest
// submitted snapshot — neither of those two core parties' mutual
// visibility is gated by a tag. Only the three genuine external-audience
// tags are real, deliberate per-item publishing decisions.
// "public" (the old vocabulary's unused value, no picker UI ever) is dropped.
export type TimelineAudience = "venue" | "client" | "wedding_party" | "guests" | "vendors";

export const TIMELINE_AUDIENCES: { value: TimelineAudience; label: string; color: string; emoji: string }[] = [
  { value: "wedding_party", label: "Wedding Party", color: "#A98CC7", emoji: "💐" },
  { value: "guests",        label: "Guests",        color: "#5D6F5D", emoji: "🌿" },
  { value: "vendors",       label: "Vendors",       color: "#C7A66A", emoji: "🚚" },
];

// docs/commitment-lifecycle-architecture.md §4 — who authored this item.
// "shared" deliberately omitted (approved 2026-07-17): Delegation (§7)
// already covers cross-party edit rights structurally.
export type TimelineOwner = "venue" | "client";

// Whether this item can be changed right now, by whoever would otherwise
// be allowed to (§12) — venue-owned structural milestones default locked;
// never gates a cross-party edit, which Owner alone already governs.
export type TimelineLockState = "editable" | "locked";

export type TimelineSection = {
  id: string;
  venueId: string;
  eventId: string;
  name: string;
  sortOrder: number;
  // Lets the couple add new items to this section from the Client Timeline
  // (Client-Added Timeline Items task). Off by default — a section only
  // becomes addable when the venue explicitly opts it in.
  clientCanAdd: boolean;
  createdAt: string;
  updatedAt: string;
};

// Shared with the live Wedding Day Dashboard run-of-show toggle (same
// column, same values) — completing an item in the Booking Timeline editor
// and the day-of dashboard are the same fact, not two separate ones.
export type TimelineEntryStatus = "not_started" | "in_progress" | "complete";

export type TimelineEntry = {
  id: string;
  venueId: string;
  eventId: string;
  title: string;
  description: string | null;
  notes: string | null;
  entryTime: string | null; // "HH:MM" or null
  audiences: TimelineAudience[];
  sectionId: string | null; // null = unsectioned
  sortOrder: number;
  // Who authored this item, and whether it can be changed right now —
  // fully supersede the old clientEditable boolean (Commitment Alignment,
  // Timeline Implementation, 2026-07-17).
  owner: TimelineOwner;
  lockState: TimelineLockState;
  status: TimelineEntryStatus;
  // Venue team member responsible for this item — references venue_staff,
  // the same roster Planning Tasks assign to (Timeline Experience
  // Completion task).
  assignedToStaffId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEntryInput = {
  title: string;
  description: string;
  notes?: string;
  entryTime: string; // "HH:MM" or ""
  audiences?: TimelineAudience[];
  sectionId?: string | null;
  sortOrder?: number;
  lockState?: TimelineLockState;
  status?: TimelineEntryStatus;
  assignedToStaffId?: string | null;
};

/** Upcoming / Today / Complete — computed from status + the event's own date, never stored. */
export type TimelineDueStatus = "upcoming" | "today" | "complete";

// Resolved at read-time from the documents table — never duplicated here, so
// a renamed document is reflected automatically. Same shape/spirit as
// PlaybookTaskAttachment, document-only since Links (below) is its own field.
export type TimelineEntryAttachment = {
  id: string;
  timelineEntryId: string;
  documentId: string;
  sortOrder: number;
  createdAt: string;
  label: string;
};

export type TimelineEntryLink = {
  id: string;
  timelineEntryId: string;
  url: string;
  label: string | null;
  sortOrder: number;
  createdAt: string;
};

export type TimelineErrors = Record<string, string>;

export type TimelineActionResult =
  | { ok: true }
  | { ok: false; errors?: TimelineErrors; message?: string };

export type AddEntryResult =
  | { ok: true; entry: TimelineEntry }
  | { ok: false; errors?: TimelineErrors; message?: string };

export type AddSectionResult =
  | { ok: true; section: TimelineSection }
  | { ok: false; message?: string };

/** "Duplicate a section" (Timeline Experience Completion task) — copies the section and its entries' core fields (not links/attachments/related items). */
export type DuplicateSectionResult =
  | { ok: true; section: TimelineSection; entries: TimelineEntry[] }
  | { ok: false; message?: string };

export type AddAttachmentResult =
  | { ok: true; attachment: TimelineEntryAttachment }
  | { ok: false; message?: string };

export type AddLinkResult =
  | { ok: true; link: TimelineEntryLink }
  | { ok: false; message?: string };

// Related platform items a Timeline entry can point to (Timeline Integration
// task). "planning_task" reuses the existing event_task_context_links table
// directly — a task already has a timeline_entry_id column, so linking from
// either side reads and writes the same row, never a duplicate. The other
// four source types are new (timeline_entry_context_links), mirroring that
// same multi-source-type shape. Resolved at read-time, same as
// TimelineEntryAttachment — never duplicated here.
export type TimelineRelatedSourceType = "planning_task" | "vendor" | "floor_plan" | "conversation" | "invoice";

export type TimelineRelatedLink = {
  id: string;
  timelineEntryId: string;
  sourceType: TimelineRelatedSourceType;
  sourceId: string;
  label: string;
  detail: string | null;
};

export type AddRelatedLinkResult =
  | { ok: true; link: TimelineRelatedLink }
  | { ok: false; message?: string };
