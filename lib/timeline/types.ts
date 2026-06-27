/**
 * Timeline domain types (Sprint 12 — Day-of Timeline).
 */

export type TimelineEntry = {
  id: string;
  venueId: string;
  eventId: string;
  title: string;
  description: string | null;
  entryTime: string | null; // "HH:MM" or null
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEntryInput = {
  title: string;
  description: string;
  entryTime: string; // "HH:MM" or ""
};

export type TimelineErrors = Record<string, string>;

export type TimelineActionResult =
  | { ok: true }
  | { ok: false; errors?: TimelineErrors; message?: string };

export type AddEntryResult =
  | { ok: true; entry: TimelineEntry }
  | { ok: false; errors?: TimelineErrors; message?: string };
