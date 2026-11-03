/**
 * Dashboard Component System — Comparison Card (Work Package R1).
 *
 * Direction is never color/arrow-only — the accessible text sentence is always
 * rendered. Phase 11B adds optional `tone` for Reports metric *families*
 * (category surfaces). Tone must never encode comparison polarity.
 *
 * Phase 11B final polish: stronger value hierarchy; mobile cards size to content
 * (no forced equal-height empty space on narrow screens).
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { percentChange } from "@/lib/reporting/date-range";

export type ComparisonPolarity = "up-good" | "up-bad" | "neutral";

/** Reports KPI family — visual category only, not up/down meaning. */
export type ComparisonTone =
  | "sales"
  | "bookings"
  | "contracted"
  | "collected"
  | "outstanding"
  | "ops"
  | "neutral";

/** Exported for focused polarity regression tests (Outstanding uses up-bad). */
export function comparisonDirectionClass(
  direction: "up" | "down" | "flat",
  polarity: ComparisonPolarity,
): string {
  if (polarity === "neutral" || direction === "flat") return "text-muted-foreground";
  const isGood = (direction === "up" && polarity === "up-good") || (direction === "down" && polarity === "up-bad");
  return isGood ? "text-success" : "text-destructive";
}

export function ComparisonCard({
  label,
  value,
  previousValue,
  comparisonLabel,
  format = (n) => String(n),
  polarity = "neutral",
  tone = "neutral",
  href,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number;
  /** null = the prior period genuinely has no data — shown as "No data for the prior period" rather than a fabricated 0% change. */
  previousValue: number | null;
  comparisonLabel: string;
  format?: (n: number) => string;
  polarity?: ComparisonPolarity;
  /** Metric family surface for Reports (Phase 11B). Independent of polarity. */
  tone?: ComparisonTone;
  href?: string;
  icon?: React.ElementType;
  /** Optional secondary line, e.g. a short definition ("Money received during the selected period."). */
  sub?: string;
}) {
  const hasComparison = previousValue !== null;
  const { pct, direction } = hasComparison ? percentChange(value, previousValue) : { pct: null, direction: "flat" as const };
  const colorClass = hasComparison ? comparisonDirectionClass(direction, polarity) : "text-muted-foreground";
  const DirectionIcon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  const accessibleText = !hasComparison
    ? "No data for the prior period."
    : pct === null
    ? direction === "flat" ? `Unchanged ${comparisonLabel}.` : `New this period — no comparable prior value.`
    : `${Math.abs(pct)}% ${direction === "up" ? "higher" : direction === "down" ? "lower" : "different"} ${comparisonLabel}.`;

  const body: ReactNode = (
    <CardContent className="flex h-full flex-col gap-0.5 p-4 sm:gap-1.5">
      <div className={cn("htc-report-kpi-label flex items-center gap-2")}>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="htc-report-kpi-value text-[1.75rem] font-bold font-heading leading-none text-heading break-words sm:text-3xl">
        {format(value)}
      </p>
      <div className={cn("flex items-center gap-1 text-xs font-medium", colorClass)}>
        {hasComparison && pct !== null && <DirectionIcon className="h-3 w-3" aria-hidden="true" />}
        <span>{accessibleText}</span>
      </div>
      {/* Desktop: reserve sub slot for equal card heights. Mobile: no empty min-height. */}
      {sub ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground sm:mt-auto sm:pt-0.5">{sub}</p>
      ) : (
        <div className="mt-auto hidden min-h-[2.5rem] sm:block" aria-hidden="true" />
      )}
    </CardContent>
  );

  const cardClass = cn(
    "htc-report-kpi sm:h-full",
    href && "transition-colors hover:brightness-[0.99]",
  );

  if (href) {
    return (
      <Link href={href} className="block sm:h-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className={cardClass} data-tone={tone} data-report-kpi="">
          {body}
        </Card>
      </Link>
    );
  }
  return (
    <Card className={cardClass} data-tone={tone} data-report-kpi="">
      {body}
    </Card>
  );
}

export function ComparisonCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // Mobile: content-sized rows. Desktop: equal-height stretch for alignment.
        "grid grid-cols-1 items-start gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:items-stretch lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
