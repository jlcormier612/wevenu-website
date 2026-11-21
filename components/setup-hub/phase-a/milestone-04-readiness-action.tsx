"use client";

import * as React from "react";
import { toast } from "sonner";

import { setReadyToInviteCouplesAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";

export type IncompleteRecommendedItem = {
  number: string;
  title: string;
  statusLabel: string;
};

/**
 * Milestone 04 owner readiness control.
 * Persists via the existing setReadyToInviteCouples / ready_to_invite_couples path.
 * Recommended setup is guided, not mandatory — incomplete items get a confirmation only.
 * Practice Run and optional integrations are never required.
 */
export function Milestone04ReadinessAction({
  readyToInviteCouples,
  readyToInviteCouplesAt,
  incompleteRecommended,
}: {
  readyToInviteCouples: boolean;
  readyToInviteCouplesAt: string | null;
  incompleteRecommended: IncompleteRecommendedItem[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const hasIncomplete = incompleteRecommended.length > 0;

  function declareReady() {
    startTransition(async () => {
      const result = await setReadyToInviteCouplesAction(true);
      if (result.ok) {
        setConfirming(false);
        toast.success("Wonderful — you're ready to start working with clients!");
      } else {
        toast.error("Something went wrong saving that. Please try again.");
      }
    });
  }

  function undoReady() {
    startTransition(async () => {
      const result = await setReadyToInviteCouplesAction(false);
      if (result.ok) {
        toast.success("No problem — take the time you need.");
      } else {
        toast.error("Something went wrong saving that. Please try again.");
      }
    });
  }

  function onPrimaryClick() {
    if (hasIncomplete) {
      setConfirming(true);
      return;
    }
    declareReady();
  }

  if (readyToInviteCouples) {
    return (
      <div
        className="htc-surface-guidance flex flex-wrap items-center justify-between gap-3 p-3.5"
        data-testid="m04-ready-declared"
      >
        <p className="text-sm text-foreground">
          You&apos;ve decided you&apos;re ready. Finish setup to open your Dashboard — Setup Hub
          stays available so you can finish anything later.
          {readyToInviteCouplesAt
            ? ` Declared on ${new Date(readyToInviteCouplesAt).toLocaleDateString()}.`
            : ""}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={undoReady}
          data-testid="m04-ready-undo"
        >
          We need a bit more time
        </Button>
      </div>
    );
  }

  if (confirming && hasIncomplete) {
    return (
      <div
        className="space-y-3 rounded-lg border border-border bg-muted/20 p-3.5"
        data-testid="m04-ready-incomplete-confirm"
        role="region"
        aria-label="Confirm readiness with unfinished setup"
      >
        <p className="text-sm text-foreground">
          Some recommended setup is still unfinished. You can begin working with clients now —
          a few workflows may not be available until those pieces are configured. Setup Hub stays
          open so you can return anytime.
        </p>
        <ul className="space-y-1.5" data-testid="m04-ready-incomplete-list">
          {incompleteRecommended.map((item) => (
            <li key={item.number} className="text-sm text-foreground">
              <span className="font-medium">
                {item.number}. {item.title}
              </span>
              <span className="block text-xs text-muted-foreground">{item.statusLabel}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={declareReady}
            data-testid="m04-ready-confirm-proceed"
          >
            I understand — we&apos;re ready
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setConfirming(false)}
            data-testid="m04-ready-confirm-cancel"
          >
            Keep setting up
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="m04-ready-undeclared">
      <p className="text-sm text-muted-foreground">
        Saying you&apos;re ready doesn&apos;t invite clients or turn anything on. It marks that
        you&apos;re ready to start working in Hello to Cheers — Practice Run and optional
        integrations stay optional.
      </p>
      <Button
        type="button"
        disabled={pending}
        onClick={onPrimaryClick}
        data-testid="m04-ready-cta"
      >
        We&apos;re ready to start working with clients
      </Button>
    </div>
  );
}
