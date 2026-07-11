import type { TimelineAudience } from "@/lib/timeline/types";

export type TimelineTemplate = {
  id: string;
  venueId: string;
  name: string;
  eventType: string | null;
  spaceId: string | null;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

// The library card grid needs the space name and item count alongside the
// base row — computed alongside the list, never stored.
export type TimelineTemplateWithStats = TimelineTemplate & {
  spaceName: string | null;
  itemCount: number;
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
  | { ok: true; templateId: string; itemCount: number; guessedCount: number }
  | { ok: false; message: string };
