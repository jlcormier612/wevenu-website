import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import type { SnapshotCardModel } from "@/lib/dashboard/business-snapshot";
import { cn } from "@/lib/utils";

function SnapshotCard({ card }: { card: SnapshotCardModel }) {
  return (
    <Link
      href={card.href}
      className="block h-full rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors hover:bg-muted/20">
        <CardContent className="flex h-full min-h-[8.5rem] flex-col gap-1.5 p-4">
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          <p
            className={cn(
              "text-xl font-bold font-heading leading-snug text-heading sm:text-2xl",
              card.empty && "text-muted-foreground font-semibold text-lg sm:text-xl",
            )}
          >
            {card.primary}
          </p>
          <p className="mt-auto pt-1 text-xs text-muted-foreground">{card.secondary}</p>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
            View
            <ChevronRight className="h-3 w-3" aria-hidden />
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
          A concise view of pipeline, booked business, upcoming events, and outstanding balances.
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
