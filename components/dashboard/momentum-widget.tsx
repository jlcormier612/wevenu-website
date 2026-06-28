/**
 * MomentumWidget — "Who needs attention today?"
 *
 * A focused dashboard card segmenting leads by relationship momentum.
 * Heating Up: high interest or responsiveness (engage now, they're ready)
 * Cooling Off: meaningful commitment + going quiet (act before they drift)
 *
 * No scores shown. Just warm, actionable guidance.
 */

import Link from "next/link";
import { LuvHeart } from "@/components/dashboard/luv-widget";

const DUSTY_ROSE = "#D8A7AA";

type Segment = { leadId: string; name: string; reason: string };

function SegmentRow({ lead }: { lead: Segment }) {
  return (
    <Link href={`/leads/${lead.leadId}`}
      className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors rounded-lg px-1 -mx-1">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-heading">{lead.name}</p>
        <p className="text-xs text-muted-foreground leading-snug">{lead.reason}</p>
      </div>
      <span className="shrink-0 text-xs text-primary hover:underline mt-0.5">View →</span>
    </Link>
  );
}

export function MomentumWidget({
  heatingUp,
  coolingOff,
}: {
  heatingUp: Segment[];
  coolingOff: Segment[];
}) {
  if (!heatingUp.length && !coolingOff.length) return null;

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{
        borderColor: `${DUSTY_ROSE}25`,
        background: `color-mix(in oklch, ${DUSTY_ROSE} 3%, var(--card))`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <LuvHeart size={14} />
        <h2 className="font-heading text-sm font-semibold text-heading">
          Who needs attention today?
        </h2>
      </div>

      {heatingUp.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">🔥</span>
            <p className="text-xs font-semibold uppercase tracking-wide text-heading">
              Heating Up ({heatingUp.length})
            </p>
          </div>
          {heatingUp.map((lead) => <SegmentRow key={lead.leadId} lead={lead} />)}
        </div>
      )}

      {heatingUp.length > 0 && coolingOff.length > 0 && (
        <div className="border-t border-border/40" />
      )}

      {coolingOff.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">❄️</span>
            <p className="text-xs font-semibold uppercase tracking-wide text-heading">
              Cooling Off ({coolingOff.length})
            </p>
          </div>
          {coolingOff.map((lead) => <SegmentRow key={lead.leadId} lead={lead} />)}
        </div>
      )}

      <p className="text-[10px] text-right text-muted-foreground flex items-center justify-end gap-1">
        <LuvHeart size={10} /> Luv — your venue assistant
      </p>
    </div>
  );
}
