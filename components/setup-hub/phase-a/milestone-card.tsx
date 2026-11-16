import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PhaseAMilestoneView } from "@/lib/setup-hub/phase-a-milestones";
import type { MilestoneStatus } from "@/lib/setup-hub/types";

function statusVariant(
  status: MilestoneStatus,
): "muted" | "outline" | "default" {
  if (status === "ready") return "outline";
  if (status === "needs_attention") return "default";
  return "muted";
}

export function PhaseAMilestoneCard({ milestone }: { milestone: PhaseAMilestoneView }) {
  return (
    <article
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
      data-testid={`phase-a-milestone-card-${milestone.number}`}
    >
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-sm font-semibold text-heading"
        aria-hidden
      >
        {milestone.number}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-lg font-medium text-heading">{milestone.title}</h3>
          <Badge variant={statusVariant(milestone.status)}>{milestone.statusLabel}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{milestone.description}</p>
      </div>
      <Button
        type="button"
        className="w-full shrink-0 sm:w-auto"
        render={<Link href={milestone.href} />}
        data-testid={`phase-a-milestone-cta-${milestone.number}`}
      >
        {milestone.actionLabel}
      </Button>
    </article>
  );
}
