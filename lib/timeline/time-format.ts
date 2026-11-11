/**
 * Timeline time display ↔ storage.
 * Storage remains HH:MM (24h). User-facing HTC convention is en-US 12-hour with AM/PM
 * (same as lib/timeline/constants formatTime / lib/events/constants formatTime).
 */

import { formatTime, minutesToTime, timeToMinutes } from "@/lib/timeline/constants";

/** Format stored HH:MM for display (e.g. "6:00 PM"). Empty stays empty. */
export function formatTimelineTimeForInput(hhmm: string | null | undefined): string {
  if (!hhmm?.trim()) return "";
  const trimmed = hhmm.trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return "";
  return formatTime(trimmed.length === 4 ? `0${trimmed}` : trimmed);
}

/**
 * Parse user-facing time into stored HH:MM.
 * Accepts "6:00 PM", "6 PM", "18:00", "6:00pm". Returns "" for blank, null for invalid.
 */
export function parseTimelineTimeInput(raw: string | null | undefined): string | null {
  if (raw == null) return "";
  const s = raw.trim();
  if (!s) return "";

  // Already HH:MM (24h) — including type=time values
  const military = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (military) {
    return minutesToTime(timeToMinutes(`${military[1]!.padStart(2, "0")}:${military[2]}`));
  }

  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i);
  if (!ampm) return null;
  let hour = Number(ampm[1]);
  const minute = ampm[2] != null ? Number(ampm[2]) : 0;
  const meridiem = ampm[3]!.replace(/\./g, "").toLowerCase();
  if (!Number.isFinite(hour) || hour < 1 || hour > 12) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  if (meridiem.startsWith("a")) {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }
  return minutesToTime(hour * 60 + minute);
}

/** Normalize draft field: keep display string while typing; validate on blur/save. */
export function normalizeTimelineTimeForSave(raw: string): { ok: true; hhmm: string } | { ok: false; message: string } {
  const parsed = parseTimelineTimeInput(raw);
  if (parsed === null) {
    return { ok: false, message: "Enter a valid time like 6:00 PM (or leave blank)." };
  }
  return { ok: true, hhmm: parsed };
}
