import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ActivationScore } from "@/lib/activation/types";

export function ActivationWidget({ score }: { score: ActivationScore }) {
  const delta = score.previousScore !== null ? score.score - score.previousScore : null;
  const isFull = score.phase === "full";

  const barColor = isFull
    ? "var(--color-success)"
    : score.score >= 70
    ? "var(--color-primary)"
    : score.score >= 40
    ? "var(--color-warning)"
    : "var(--color-muted-foreground)";

  return (
    <Card className={isFull ? "border-success/25" : undefined}
      style={isFull ? { background: "color-mix(in oklch, var(--success) 3%, var(--card))" } : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isFull
              ? <Sparkles className="h-4 w-4 text-success" aria-hidden />
              : <span className="text-sm" aria-hidden>🚀</span>
            }
            <h2 className="font-heading text-sm font-semibold text-heading">
              Activation
            </h2>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-heading leading-none text-heading">
              {score.score}
            </span>
            <span className="text-xs font-medium text-muted-foreground">/ 100</span>
            {delta !== null && delta !== 0 && (
              <span className={`text-xs font-semibold ${delta > 0 ? "text-success" : "text-muted-foreground"}`}>
                {delta > 0 ? `↑ +${delta}` : `↓ ${delta}`}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{score.phaseLabel}</p>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${score.score}%`, background: barColor }}
          />
        </div>

        {/* Gap list */}
        {!isFull && score.gaps.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Next steps
            </p>
            <ul className="space-y-1">
              {score.gaps.map((gap, i) => (
                <li key={i}>
                  <Link
                    href={gap.href}
                    className="flex items-center justify-between gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground/60">→</span>
                      {gap.label}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-primary">+{gap.points} pts</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isFull && (
          <p className="text-xs text-success font-medium">
            Your venue is fully connected. Keep the momentum going.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
