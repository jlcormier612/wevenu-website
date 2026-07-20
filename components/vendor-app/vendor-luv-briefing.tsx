import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export function VendorLuvBriefing({
  wins,
  observations,
  healthTip,
  isPrimarySurface = false,
}: {
  wins:         string[];
  observations: string[];
  healthTip?:   string | null;
  /** True on the dedicated /vendor/luv page (a primary/anchor surface, per
   * Luv Experience Completion Work Stream 6's empty-state rule — always
   * shows a light reassurance state rather than vanishing). False (default)
   * when embedded as one card among several on the dashboard, where
   * vanishing is correct since the parent page has its own content. */
  isPrimarySurface?: boolean;
}) {
  const isEmpty = wins.length === 0 && observations.length === 0 && !healthTip;
  if (isEmpty && !isPrimarySurface) return null;

  return (
    <Card className="border-pink-200/50 dark:border-pink-800/30" style={{ background: "color-mix(in oklch, var(--color-pink-500, #ec4899) 4%, var(--card))" }}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="h-4 w-4 fill-pink-400 text-pink-400 shrink-0" />
          <span className="text-sm font-semibold text-pink-600 dark:text-pink-400">Luv</span>
        </div>

        {isEmpty && (
          <p className="text-xs text-muted-foreground">Nothing new to report right now — everything looks steady.</p>
        )}

        {wins.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-pink-500/70 mb-1.5">Wins</p>
            <ul className="space-y-1">
              {wins.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                  <span className="text-pink-400 shrink-0">✦</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {observations.length > 0 && (
          <div className={wins.length > 0 ? "border-t border-pink-200/30 pt-3" : ""}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Observations</p>
            <ul className="space-y-1">
              {observations.map((o, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="text-muted-foreground/60 shrink-0">·</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        {healthTip && (
          <p className="text-xs text-pink-600 dark:text-pink-400 border-t border-pink-200/30 pt-3">
            {healthTip}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
