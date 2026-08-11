/**
 * Work Package R1 — Reporting's one date-range model. Every report page
 * uses this same resolver so "This Month" means the exact same thing in
 * Sales, Bookings, Revenue, and Events — no report gets its own "Period"
 * vs "Date Filter" vs "From/To" pattern (brief §68).
 *
 * Pure date math only — no metric calculation lives here. Reports pass the
 * resolved `{ from, to }` window straight into the canonical
 * lib/metrics/* functions, which already accept exactly this shape.
 */

export type DateRangePreset =
  | "this_month" | "last_month"
  | "this_quarter" | "last_quarter"
  | "this_year" | "last_year"
  | "custom";

export const DATE_RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

export type ResolvedDateRange = {
  preset: DateRangePreset;
  from: string; // YYYY-MM-DD, inclusive
  to: string;   // YYYY-MM-DD, inclusive
  /** "Jan 1 – Jan 31, 2026" — always shown so the venue never has to guess the active window (brief §13). */
  label: string;
  previousFrom: string;
  previousTo: string;
  /** "vs. last month" / "vs. the prior 14 days" — what the comparison actually is (brief §52). */
  comparisonLabel: string;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtWithYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function rangeLabel(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  return sameYear ? `${fmt(from)} – ${fmtWithYear(to)}` : `${fmtWithYear(from)} – ${fmtWithYear(to)}`;
}

function startOfMonth(y: number, m: number): Date { return new Date(y, m, 1); }
function endOfMonth(y: number, m: number): Date { return new Date(y, m + 1, 0); }
function startOfQuarter(y: number, q: number): Date { return new Date(y, q * 3, 1); }
function endOfQuarter(y: number, q: number): Date { return new Date(y, q * 3 + 3, 0); }

export function resolveDateRange(preset: DateRangePreset, customFrom?: string, customTo?: string): ResolvedDateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);

  switch (preset) {
    case "this_month": {
      const from = startOfMonth(y, m), to = endOfMonth(y, m);
      const prevFrom = startOfMonth(y, m - 1), prevTo = endOfMonth(y, m - 1);
      return { preset, from: iso(from), to: iso(to), label: rangeLabel(from, to), previousFrom: iso(prevFrom), previousTo: iso(prevTo), comparisonLabel: "vs. last month" };
    }
    case "last_month": {
      const from = startOfMonth(y, m - 1), to = endOfMonth(y, m - 1);
      const prevFrom = startOfMonth(y, m - 2), prevTo = endOfMonth(y, m - 2);
      return { preset, from: iso(from), to: iso(to), label: rangeLabel(from, to), previousFrom: iso(prevFrom), previousTo: iso(prevTo), comparisonLabel: "vs. the month before" };
    }
    case "this_quarter": {
      const from = startOfQuarter(y, q), to = endOfQuarter(y, q);
      const prevFrom = startOfQuarter(y, q - 1), prevTo = endOfQuarter(y, q - 1);
      return { preset, from: iso(from), to: iso(to), label: rangeLabel(from, to), previousFrom: iso(prevFrom), previousTo: iso(prevTo), comparisonLabel: "vs. last quarter" };
    }
    case "last_quarter": {
      const from = startOfQuarter(y, q - 1), to = endOfQuarter(y, q - 1);
      const prevFrom = startOfQuarter(y, q - 2), prevTo = endOfQuarter(y, q - 2);
      return { preset, from: iso(from), to: iso(to), label: rangeLabel(from, to), previousFrom: iso(prevFrom), previousTo: iso(prevTo), comparisonLabel: "vs. the quarter before" };
    }
    case "this_year": {
      const from = new Date(y, 0, 1), to = new Date(y, 11, 31);
      const prevFrom = new Date(y - 1, 0, 1), prevTo = new Date(y - 1, 11, 31);
      return { preset, from: iso(from), to: iso(to), label: rangeLabel(from, to), previousFrom: iso(prevFrom), previousTo: iso(prevTo), comparisonLabel: "vs. last year" };
    }
    case "last_year": {
      const from = new Date(y - 1, 0, 1), to = new Date(y - 1, 11, 31);
      const prevFrom = new Date(y - 2, 0, 1), prevTo = new Date(y - 2, 11, 31);
      return { preset, from: iso(from), to: iso(to), label: rangeLabel(from, to), previousFrom: iso(prevFrom), previousTo: iso(prevTo), comparisonLabel: "vs. the year before" };
    }
    case "custom": {
      const fromStr = customFrom || iso(startOfMonth(y, m));
      const toStr = customTo || iso(now);
      const from = new Date(fromStr + "T00:00:00"), to = new Date(toStr + "T00:00:00");
      const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
      const prevTo = new Date(from.getTime() - 86_400_000);
      const prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * 86_400_000);
      return {
        preset, from: fromStr, to: toStr, label: rangeLabel(from, to),
        previousFrom: iso(prevFrom), previousTo: iso(prevTo),
        comparisonLabel: `vs. the prior ${spanDays} day${spanDays === 1 ? "" : "s"}`,
      };
    }
  }
}

const VALID_PRESETS = new Set(DATE_RANGE_PRESETS.map((p) => p.value));

/** Every report page calls this the same way on its own `searchParams` prop — one parsing rule, not five. */
export function resolveDateRangeFromParams(searchParams: Record<string, string | string[] | undefined>): ResolvedDateRange {
  const rawPreset = typeof searchParams.range === "string" ? searchParams.range : "this_month";
  const preset: DateRangePreset = VALID_PRESETS.has(rawPreset as DateRangePreset) ? (rawPreset as DateRangePreset) : "this_month";
  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams.to === "string" ? searchParams.to : undefined;
  return resolveDateRange(preset, from, to);
}

/** Percentage change, direction-agnostic — the caller decides whether "up" is good or bad (Outstanding Balance going up is bad news). */
export function percentChange(current: number, previous: number): { pct: number | null; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { pct: null, direction: "flat" };
    return { pct: null, direction: "up" }; // can't express "% change from zero" honestly — caller shows a plain delta instead
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return { pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}
