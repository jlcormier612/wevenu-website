/**
 * Timeline domain types (Sprint 12 — Day-of Timeline; sections, notes,
 * links, and attachments added in the Booking Timeline Experience task).
 */

export type TimelineAudience = "internal" | "couple" | "guest" | "vendor" | "public";

export const TIMELINE_AUDIENCES: { value: TimelineAudience; label: string; color: string; emoji: string }[] = [
  { value: "internal",  label: "Internal",  color: "#B8AEA1", emoji: "🔒" },
  { value: "couple",    label: "Client",    color: "#D8A7AA", emoji: "💗" },
  { value: "guest",     label: "Guests",    color: "#5D6F5D", emoji: "🌿" },
  { value: "vendor",    label: "Vendors",   color: "#C7A66A", emoji: "🚚" },
];

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
  // Lets the couple edit this exact row from the Client Timeline — only
  // meaningful when audiences already includes "couple" (Client Timeline
  // Experience task). Coordinator-only visibility/section/notes/reorder
  // stay coordinator-only regardless of this flag.
  clientEditable: boolean;
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
  clientEditable?: boolean;
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
