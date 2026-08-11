/**
 * Saved Reports — Work Package D7C. A thin persistence/delivery layer over
 * the already-complete Reporting system. Stores only what R1-R3's own
 * research confirmed is sufficient to fully restore any report view:
 * which report page + which date-range mode (relative presets stay
 * relative — resolved fresh via resolveDateRange() every time the saved
 * report is opened or delivered, never a frozen snapshot).
 */
import type { DateRangePreset } from "@/lib/reporting/date-range";

export const SAVED_REPORT_PATHS = [
  "/reporting", "/reporting/sales", "/reporting/bookings", "/reporting/revenue", "/reporting/events",
] as const;
export type SavedReportPath = (typeof SAVED_REPORT_PATHS)[number];

export const SAVED_REPORT_PATH_LABEL: Record<SavedReportPath, string> = {
  "/reporting": "Overview",
  "/reporting/sales": "Sales",
  "/reporting/bookings": "Bookings",
  "/reporting/revenue": "Revenue",
  "/reporting/events": "Events",
};

export type SavedReport = {
  id: string;
  venueId: string;
  createdBy: string | null;
  name: string;
  reportPath: SavedReportPath;
  datePreset: DateRangePreset;
  customFrom: string | null;
  customTo: string | null;
  /** Hello to Cheers starter key when provisioned from a protected master. */
  sourceMasterKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedReportSchedule = {
  id: string;
  savedReportId: string;
  venueId: string;
  createdBy: string | null;
  recipientEmail: string;
  dayOfWeek: number; // 0 = Sunday
  isActive: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedReportInput = {
  name: string;
  reportPath: SavedReportPath;
  datePreset: DateRangePreset;
  customFrom?: string | null;
  customTo?: string | null;
};

export type SavedReportActionResult = { ok: true } | { ok: false; message?: string };
export type CreateSavedReportResult = { ok: true; savedReportId: string } | { ok: false; message?: string };
