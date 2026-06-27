/**
 * LuvWidget — "What Luv noticed today"
 *
 * Phase 1: Notice only. All observations are derived from existing data —
 * no AI calls, no external services, no new DB tables.
 *
 * Brand: Dusty Rose (#D8A7AA) heart. Warm, calm, encouraging tone.
 * Not a chatbot. Not "AI software." An experienced venue coordinator
 * quietly helping in the background.
 */

import Link from "next/link";
import { Heart } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LuvObservation } from "@/lib/luv/types";

const DUSTY_ROSE = "#D8A7AA";

function LuvHeart({ size = 14 }: { size?: number }) {
  return (
    <Heart
      aria-hidden
      style={{ width: size, height: size, color: DUSTY_ROSE, fill: DUSTY_ROSE }}
      className="shrink-0"
    />
  );
}

function ObservationRow({ obs }: { obs: LuvObservation }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <LuvHeart />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm text-foreground leading-snug">{obs.message}</p>
        {obs.detail && (
          <p className="text-xs text-muted-foreground">{obs.detail}</p>
        )}
      </div>
      <Link
        href={obs.link}
        className="shrink-0 text-xs font-medium text-primary hover:underline whitespace-nowrap mt-0.5"
      >
        {obs.actionLabel ?? "View →"}
      </Link>
    </div>
  );
}

export function LuvWidget({ observations }: { observations: LuvObservation[] }) {
  return (
    <Card
      className="border-[#D8A7AA]/25"
      style={{ background: "color-mix(in oklch, #D8A7AA 4%, var(--card))" }}
    >
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2">
          <LuvHeart size={16} />
          <h2 className="font-heading text-sm font-semibold text-heading">
            What Luv noticed today
          </h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your venue assistant is keeping an eye out for you.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        {observations.length === 0 ? (
          <div className="flex items-center gap-2 py-4">
            <LuvHeart />
            <p className="text-sm text-muted-foreground">
              Everything looks good today — nothing needs your attention right now.
            </p>
          </div>
        ) : (
          <div>
            {observations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
            <p className="text-[10px] text-muted-foreground pt-3 pb-0.5 text-right">
              Luv — your venue assistant
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
