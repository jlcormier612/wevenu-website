import Link from "next/link";

import { rowSentence, type RvpRow } from "@/lib/floor-plans/required-vs-placed";
import type { FloorPlanRequiredVsPlaced } from "@/lib/floor-plans/required-vs-placed-service";

const STATUS_CLASS: Record<RvpRow["status"], string> = {
  short: "text-amber-800",
  over: "text-muted-foreground",
  ok: "text-muted-foreground",
  not_ordered: "text-muted-foreground",
};

/**
 * Event Order quantities vs what is placed on this layout. Informational only:
 * placement is never blocked and nothing here changes the Event Order or bills.
 */
export function FloorPlanRequiredVsPlacedPanel({
  result,
  eventOrderHref,
}: {
  result: FloorPlanRequiredVsPlaced | null;
  eventOrderHref: string;
}) {
  if (!result || !result.hasEventOrder) return null;
  const ordered = result.rows.filter((r) => r.status !== "not_ordered");
  const extras = result.rows.filter((r) => r.status === "not_ordered");

  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3 space-y-3" data-testid="floor-plan-required-vs-placed">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event Order vs this layout</p>
        <p className="text-xs text-muted-foreground" data-testid="floor-plan-rvp-scope">
          {result.planSetup
            ? `Compared with the Event Order sections laid out on “${result.planSetup.name}”.`
            : result.planOutsideSetups
              ? "This layout isn't part of a setup, so it's compared with the whole Event Order."
              : "Compared with the whole Event Order."}
          {" "}Only Event Order items linked to inventory are counted.
        </p>
        {result.comparedSectionNames.length > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="floor-plan-rvp-sections">
            Sections counted: {result.comparedSectionNames.join(", ")}
          </p>
        ) : null}
      </div>

      {result.unmatchedSections.length > 0 ? (
        <p className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900" data-testid="floor-plan-rvp-unmatched">
          {result.unmatchedSections.map((s) => `“${s.name}”`).join(", ")}
          {result.unmatchedSections.length === 1 ? " doesn't" : " don't"} match a floor plan setup, so
          {result.unmatchedSections.length === 1 ? " its" : " their"} items count against every layout.{" "}
          <Link href={eventOrderHref} className="underline">Choose a setup on the Event Order</Link>.
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="floor-plan-rvp-empty">
          Nothing on the Event Order to compare with this layout yet.
        </p>
      ) : (
        <ul className="divide-y divide-border" data-testid="floor-plan-rvp-rows">
          {ordered.map((row) => (
            <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5 text-sm"
              data-testid="floor-plan-rvp-row" data-status={row.status} data-key={row.key}>
              <span className="text-foreground">{row.label}</span>
              <span className={STATUS_CLASS[row.status]}>{rowSentence(row)}{row.status === "ok" ? " ✓" : ""}</span>
            </li>
          ))}
        </ul>
      )}

      {extras.length > 0 ? (
        <ul className="space-y-0.5" data-testid="floor-plan-rvp-extras">
          {extras.map((row) => (
            <li key={row.key} className="text-xs text-muted-foreground" data-testid="floor-plan-rvp-extra">
              {row.label}: {rowSentence(row)}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Seats count the seats at tables plus chairs placed one by one. This never blocks placement, changes the Event Order, or bills.
      </p>
    </section>
  );
}
