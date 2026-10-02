/**
 * Compact L3 "Luv noticed" rows for the record currently being viewed.
 * Dashboard L1 is gated separately — these stay on lead/event/contract context.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { observationActionCta } from "@/lib/luv/observation-quality";
import type { LuvObservation } from "@/lib/luv/types";

export function ContextualLuvObservationsPanel({
  observations,
  emptyHint,
  currentPath,
}: {
  observations: LuvObservation[];
  emptyHint?: string;
  /** When set, a CTA that points at this same record is omitted (no dead same-page link). */
  currentPath?: string;
}) {
  if (observations.length === 0) {
    if (!emptyHint) return null;
    return (
      <p className="text-xs text-muted-foreground">{emptyHint}</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <LuvHeart size={14} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Luv noticed
        </p>
      </div>
      <ul className="space-y-3">
        {observations.map((obs) => {
          const cta = observationActionCta(obs, currentPath);
          return (
            <li
              key={obs.id}
              className="rounded-sm border border-[#D8A7AA]/25 bg-[#D8A7AA]/5 px-3 py-3 space-y-1.5"
            >
              <p className="text-sm font-medium text-heading leading-snug">{obs.message}</p>
              {obs.detail ? (
                <p className="text-xs text-muted-foreground leading-relaxed">{obs.detail}</p>
              ) : null}
              {cta ? (
                <Link
                  href={cta.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
                >
                  {cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
