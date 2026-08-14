/**
 * Hello to Cheers — Starter Saved Reports.
 * Thin bookmarks over canonical reporting paths. No new metrics or formulas.
 */
import type { DateRangePreset } from "@/lib/reporting/date-range";
import type { SavedReportPath } from "@/lib/saved-reports/types";

export type SavedReportStarterMasterKey =
  | "SR-SALES"
  | "SR-BOOKINGS"
  | "SR-REVENUE"
  | "SR-EVENTS";

export type SavedReportStarterMaster = {
  key: SavedReportStarterMasterKey;
  name: string;
  reportPath: SavedReportPath;
  datePreset: DateRangePreset;
};

export const SAVED_REPORT_STARTER_MASTERS: readonly SavedReportStarterMaster[] = [
  {
    key: "SR-SALES",
    name: "Sales",
    reportPath: "/reporting/sales",
    datePreset: "this_month",
  },
  {
    key: "SR-BOOKINGS",
    name: "Bookings",
    reportPath: "/reporting/bookings",
    datePreset: "this_month",
  },
  {
    key: "SR-REVENUE",
    name: "Revenue",
    reportPath: "/reporting/revenue",
    datePreset: "this_month",
  },
  {
    key: "SR-EVENTS",
    name: "Events",
    reportPath: "/reporting/events",
    datePreset: "this_month",
  },
] as const;

export function getSavedReportStarterMaster(key: string): SavedReportStarterMaster | undefined {
  return SAVED_REPORT_STARTER_MASTERS.find((m) => m.key === key);
}

export function shouldSkipSavedReportStarterProvision(opts: {
  masterKey: string;
  masterName: string;
  existingByKey: Set<string>;
  existingNames: Set<string>;
}): "skip_key" | "skip_name" | "create" {
  if (opts.existingByKey.has(opts.masterKey)) return "skip_key";
  if (opts.existingNames.has(opts.masterName)) return "skip_name";
  return "create";
}
