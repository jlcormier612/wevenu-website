"use client";

/**
 * Work Package R1 — the one date-range control every report page shares
 * (brief §68: not "From/To" on one report and "Period" on another). Drives
 * the URL's own `range`/`from`/`to` search params — each report page is a
 * Server Component that reads those directly, so changing the range here
 * re-fetches real server data for whichever report is currently open, and
 * the range survives navigating between report tabs (ReportTabs preserves
 * the current search params on every tab link).
 */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DATE_RANGE_PRESETS, type DateRangePreset } from "@/lib/reporting/date-range";
import { SaveReportButton } from "@/components/reporting/save-report-button";

export function DateRangeControl({ current, label }: { current: DateRangePreset; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Work Package R3 — a real bug fixed here: this component isn't remounted
  // when navigating between reports (same position in the layout tree), so
  // storing "is custom range open" and the from/to input values in
  // useState — initialized once from props/searchParams — went stale the
  // moment the venue navigated somewhere that changed the range *without*
  // going through this component's own Select/Apply handlers (e.g. an
  // Overview ComparisonCard linking straight to "/reporting/sales" with no
  // range params, right after having set a Custom Range). `customOpen` is
  // now derived directly from the live `current` prop every render, never
  // stored; the from/to inputs stay in sync via the effect below, keyed to
  // the actual URL params rather than a one-time snapshot of them.
  const customOpen = current === "custom";
  const [customFrom, setCustomFrom] = React.useState(searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = React.useState(searchParams.get("to") ?? "");

  React.useEffect(() => {
    setCustomFrom(searchParams.get("from") ?? "");
    setCustomTo(searchParams.get("to") ?? "");
  }, [searchParams]);

  function applyPreset(preset: DateRangePreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", preset);
    if (preset !== "custom") { params.delete("from"); params.delete("to"); }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={current} onValueChange={(v) => applyPreset(v as DateRangePreset)} items={DATE_RANGE_PRESETS}>
        <SelectTrigger className="w-40" aria-label="Date range"><SelectValue /></SelectTrigger>
        <SelectContent>
          {DATE_RANGE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {customOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-36 text-sm" aria-label="Start date" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-36 text-sm" aria-label="End date" />
          <Button type="button" size="sm" onClick={applyCustom} disabled={!customFrom || !customTo}>Apply</Button>
        </div>
      )}
      {/* Brief §13 — the active window is always spelled out, never left for the venue to infer from a preset name alone. */}
      <span className="text-sm text-muted-foreground">Showing {label}</span>
      <SaveReportButton pathname={pathname} preset={current} customFrom={customFrom || undefined} customTo={customTo || undefined} />
    </div>
  );
}
