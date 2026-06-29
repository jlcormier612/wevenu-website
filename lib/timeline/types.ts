/**
 * Timeline domain types (Sprint 12 — Day-of Timeline).
 */

export type TimelineAudience = "internal" | "couple" | "guest" | "vendor" | "public";

export const TIMELINE_AUDIENCES: { value: TimelineAudience; label: string; color: string; emoji: string }[] = [
  { value: "internal",  label: "Internal",  color: "#B8AEA1", emoji: "🔒" },
  { value: "couple",    label: "Couple",    color: "#D8A7AA", emoji: "💗" },
  { value: "guest",     label: "Guests",    color: "#5D6F5D", emoji: "🌿" },
  { value: "vendor",    label: "Vendors",   color: "#C7A66A", emoji: "🚚" },
];

export type TimelineEntry = {
  id: string;
  venueId: string;
  eventId: string;
  title: string;
  description: string | null;
  entryTime: string | null; // "HH:MM" or null
  audiences: TimelineAudience[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEntryInput = {
  title: string;
  description: string;
  entryTime: string; // "HH:MM" or ""
  audiences?: TimelineAudience[];
};

export type TimelineErrors = Record<string, string>;

export type TimelineActionResult =
  | { ok: true }
  | { ok: false; errors?: TimelineErrors; message?: string };

export type AddEntryResult =
  | { ok: true; entry: TimelineEntry }
  | { ok: false; errors?: TimelineErrors; message?: string };
