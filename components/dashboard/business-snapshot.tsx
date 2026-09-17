import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import type { SnapshotCardModel } from "@/lib/dashboard/business-snapshot";
import { cn } from "@/lib/utils";

/**
 * Equal outer geometry is non-negotiable: fixed min-height + reserved
 * secondary/tertiary/action slots so empty vs dense content never changes height.
 */
function SnapshotCard({ card }: { card: SnapshotCardModel }) {
  return (
    <Link
      href={card.href}
      className="block h-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors hover:bg-muted/20">
        <CardContent className="flex h-full min-h-[11.5rem] flex-col gap-1 p-4">
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          <p
            className={cn(
              "min-h-[3.25rem] text-xl font-bold font-heading leading-snug text-heading sm:text-2xl",
              card.empty && "text-muted-foreground font-semibold text-lg sm:text-xl",
            )}
          >
            {card.primary}
          </p>
          <div className="mt-auto min-h-[2.75rem] space-y-0.5 pt-1">
            <p className="text-xs leading-snug text-muted-foreground line-clamp-2">
              {card.secondary}
            </p>
            <p className="min-h-[1rem] text-xs leading-snug text-muted-foreground line-clamp-1">
              {card.tertiary || "\u00A0"}
            </p>
          </div>
          <span className="inline-flex h-5 items-center gap-0.5 text-[11px] font-medium text-primary">
            {card.actionLabel}
            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function BusinessSnapshotSection({ cards }: { cards: SnapshotCardModel[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-heading">Business Snapshot</h2>
        <p className="text-xs text-muted-foreground">
          A quick view of the business coming in, booked, collected, and still owed.
        </p>
      </div>
      <ComparisonCardGrid>
        {cards.map((card) => (
          <SnapshotCard key={card.key} card={card} />
        ))}
      </ComparisonCardGrid>
    </section>
  );
}
