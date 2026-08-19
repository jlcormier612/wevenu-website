"use client";

import * as React from "react";
import { toast } from "sonner";

import { setReadyToInviteCouplesAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ReviewStageRow = {
  title: string;
  status: "complete" | "in_progress" | "not_started" | null;
  detail: string;
  required: boolean;
};

/**
 * Setup Hub's Review / Ready to Invite Couples stage
 * (docs/continuous-setup-experience-implementation-plan.md §A) — reuses
 * the exact same per-stage state SetupHubOverview already computed and
 * displayed above it; nothing here invents a new completion signal.
 *
 * The action itself is always available regardless of per-stage status —
 * readiness is the owner's own deliberate call, not something computed
 * for them.
 */
export function SetupReadiness({
  stages,
  readyToInviteCouples,
  readyToInviteCouplesAt,
}: {
  stages: ReviewStageRow[];
  readyToInviteCouples: boolean;
  readyToInviteCouplesAt: string | null;
}) {
  const [pending, startTransition] = React.useTransition();

  function toggle(ready: boolean) {
    startTransition(async () => {
      const result = await setReadyToInviteCouplesAction(ready);
      if (result.ok) {
        toast.success(ready ? "Wonderful — you're ready to invite couples!" : "No problem — take the time you need.");
      } else {
        toast.error("Something went wrong saving that. Please try again.");
      }
    });
  }

  const done = stages.filter((s) => s.status === "complete");
  const needsAttention = stages.filter((s) => s.status !== "complete" && s.required);
  const optional = stages.filter((s) => s.status !== "complete" && !s.required);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Where things stand</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          A quick look at everything above, all in one place — so you know exactly where you are before deciding you&apos;re ready to invite couples in.
        </p>

        {done.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">All set</p>
            <ul className="space-y-1">
              {done.map((s) => (
                <li key={s.title} className="text-sm text-foreground">{s.title}</li>
              ))}
            </ul>
          </div>
        )}

        {needsAttention.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Still needs your attention</p>
            <ul className="space-y-1">
              {needsAttention.map((s) => (
                <li key={s.title} className="text-sm text-foreground">
                  {s.title}
                  <span className="block text-xs text-muted-foreground">{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {optional.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Optional, whenever you&apos;re ready</p>
            <ul className="space-y-1">
              {optional.map((s) => (
                <li key={s.title} className="text-sm text-foreground">
                  {s.title}
                  <span className="block text-xs text-muted-foreground">{s.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-border pt-4">
          {readyToInviteCouples ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-primary/20 bg-primary/5 p-3.5">
              <p className="text-sm text-foreground">
                You told us you&apos;re ready to invite couples in
                {readyToInviteCouplesAt ? ` on ${new Date(readyToInviteCouplesAt).toLocaleDateString()}` : ""}.
              </p>
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => toggle(false)}>
                We need a bit more time
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You don&apos;t need everything above finished to say yes — this is your call, whenever it feels right.
              </p>
              <Button type="button" disabled={pending} onClick={() => toggle(true)}>
                We&apos;re ready to invite couples
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
