/**
 * Dashboard Component System — Comparison Card (Work Package R1).
 *
 * The genuinely missing component family Dashboard Component System Phase 2
 * identified but didn't build: a primary value against a comparison value,
 * with direction and percentage change. Built now because Reporting is the
 * first real consumer (every report's period-over-period comparison).
 *
 * Direction is never color/arrow-only (brief §15/§46/§72) — the accessible
 * text sentence ("18% higher than last month") is always rendered, not just
 * implied by an arrow. "Up" is never assumed to be good: the caller passes
 * `polarity` (a metric like Outstanding Balance going up is bad news), and
 * `informational` polarity (the default) renders the same neutral color
 * StatTile uses for a non-severity value — no invented color meaning.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { percentChange } from "@/lib/reporting/date-range";

export type ComparisonPolarity = "up-good" | "up-bad" | "neutral";

function directionColorClass(direction: "up" | "down" | "flat", polarity: ComparisonPolarity): string {
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
  href?: string;
  icon?: React.ElementType;
  /** Optional secondary line, e.g. a short definition ("Money received during the selected period."). */
  sub?: string;
}) {
  const hasComparison = previousValue !== null;
  const { pct, direction } = hasComparison ? percentChange(value, previousValue) : { pct: null, direction: "flat" as const };
  const colorClass = hasComparison ? directionColorClass(direction, polarity) : "text-muted-foreground";
  const DirectionIcon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;

  const accessibleText = !hasComparison
    ? "No data for the prior period."
    : pct === null
    ? direction === "flat" ? `Unchanged ${comparisonLabel}.` : `New this period — no comparable prior value.`
    : `${Math.abs(pct)}% ${direction === "up" ? "higher" : direction === "down" ? "lower" : "different"} ${comparisonLabel}.`;

  const body: ReactNode = (
    <CardContent className="p-4 space-y-1.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold font-heading text-heading">{format(value)}</p>
      <div className={cn("flex items-center gap-1 text-xs font-medium", colorClass)}>
        {hasComparison && pct !== null && <DirectionIcon className="h-3 w-3" aria-hidden="true" />}
        <span>{accessibleText}</span>
      </div>
      {sub && <p className="text-xs text-muted-foreground pt-0.5">{sub}</p>}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Card className="transition-colors hover:bg-muted/20">{body}</Card>
      </Link>
    );
  }
  return <Card>{body}</Card>;
}

export function ComparisonCardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>;
}
