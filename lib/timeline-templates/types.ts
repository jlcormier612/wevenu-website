import type { TimelineDayAnchor } from "@/lib/timeline/timing-presentation";
import type { TimelineAudience } from "@/lib/timeline/types";

export type { TimelineDayAnchor };

export type TimelineTemplate = {
  id: string;
  venueId: string;
  name: string;
  eventType: string | null;
  spaceId: string | null;
  isDefault: boolean;
  isArchived: boolean;
  /** Hello to Cheers master key (TL-01 / TL-02 / TL-03) when provisioned from a starter. */
  sourceMasterKey: string | null;
  createdAt: string;
  updatedAt: string;
};

// The library card grid needs the space name and item count alongside the
// base row — computed alongside the list, never stored.
export type TimelineTemplateWithStats = TimelineTemplate & {
  spaceName: string | null;
  itemCount: number;
  /** Activity titles + dayOffset for library preview (presentation only). */
  previewItems: { title: string; dayOffset: number }[];
};

export type TimelineTemplateItem = {
  id: string;
  templateId: string;
  venueId: string;
  title: string;
  description: string | null;
  notes: string | null;
  timeOfDay: string | null; // "HH:MM" or null — an absolute clock anchor, independent of minutesOffset
  minutesOffset: number | null; // minutes relative to the event's start time; null = untimed
  /** Signed offset relative to dayAnchor (event start or end). */
  dayOffset: number;
  /** Which date the dayOffset is measured from. Resolved to event_date-relative on apply. */
  dayAnchor: TimelineDayAnchor;
  // True when this item's timing was estimated (or never set) by an import,
  // rather than confirmed by a coordinator — surfaced in the editor until
  // touched. Added 2026-07-22 per template-import review: previously this
  // only existed as a one-time import-count toast, easy to miss and
  // impossible to recover once dismissed.
  needsReview: boolean;
  audiences: TimelineAudience[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TimelineTemplateItemInput = {
  title: string;
  description: string | null;
  notes: string | null;
  timeOfDay: string | null;
  minutesOffset: number | null;
  dayOffset?: number;
  dayAnchor?: TimelineDayAnchor;
  // Optional at the write boundary — omitted by every hand-authored item
  // (defaults to false at the repository layer); only the import path sets
  // this explicitly.
  needsReview?: boolean;
  audiences: TimelineAudience[];
  sortOrder: number;
};

export type TimelineTemplateActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateTimelineTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; message?: string };

export type ImportTimelineTemplateResult =
  | { ok: true; templateId: string; itemCount: number; guessedCount: number; aiStructured: boolean }
  | { ok: false; message: string };
