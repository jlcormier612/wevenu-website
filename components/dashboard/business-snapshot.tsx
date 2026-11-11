import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ComparisonCardGrid } from "@/components/dashboard-system/comparison-card";
import type { SnapshotCardModel } from "@/lib/dashboard/business-snapshot";
import { cn } from "@/lib/utils";

/**
 * Equal outer geometry is non-negotiable: fixed min-height + reserved
 * secondary/tertiary/action slots so empty vs dense content never changes height.
 *
 * Palette refinement (docs/design/htc-visual-system.md):
 * - Lead Flow: eucalyptus header band + white metric area
 * - Booked Business: green mist working surface
 * - Cash Collected: soft sage wash
 * - Outstanding (>0): ivory + restrained blush header (not full blush card)
 * - Outstanding (0): white / neutral — no positive-balance highlight
 * - Action links: charcoal (no ordinary green body text)
 */
function SnapshotCard({ card }: { card: SnapshotCardModel }) {
  const leadFlow = card.key === "lead_flow";
  const booked = card.key === "booked_business";
  const cash = card.key === "cash_collected";
  const outstandingActive = card.key === "outstanding" && !card.empty;
  const outstandingEmpty = card.key === "outstanding" && card.empty;

  return (
    <Link
      href={card.href}
      className="block h-full rounded-[0.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn(
          "h-full overflow-hidden rounded-[0.75rem] border-[color:var(--htc-border-warm)] ring-0 transition-colors hover:brightness-[0.99]",
          booked && "bg-[var(--htc-green-mist)]",
          cash && "bg-[var(--htc-botanical-pale)]",
          outstandingActive && "bg-[var(--htc-ivory)]",
          outstandingEmpty && "bg-card",
          !booked && !cash && !outstandingActive && !outstandingEmpty && !leadFlow && "bg-card",
          leadFlow && "bg-card",
        )}
      >
        <CardContent className="flex h-full min-h-[11.5rem] flex-col gap-0 p-0">
          <div
            className={cn(
              "px-4 pt-4",
              leadFlow &&
                "border-b border-[color:color-mix(in_oklch,var(--htc-eucalyptus)_45%,var(--htc-border-warm))] bg-[var(--htc-eucalyptus-surface)] pb-2",
              outstandingActive &&
                "border-b border-[color:color-mix(in_oklch,var(--htc-soft-rose)_40%,var(--htc-border-warm))] bg-[var(--htc-soft-blush)] pb-2",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          </div>
          <div
            className={cn(
              "flex flex-1 flex-col gap-1 px-4 pb-4",
              leadFlow || outstandingActive ? "bg-transparent pt-3" : "pt-1",
              leadFlow && "bg-card",
            )}
          >
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
            <span className="inline-flex h-5 items-center gap-0.5 text-[11px] font-medium text-foreground">
              {card.actionLabel}
              <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
            </span>
          </div>
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
