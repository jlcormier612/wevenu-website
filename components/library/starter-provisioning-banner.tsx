"use client";

/**
 * Non-alarming guidance when HTC starter provisioning is incomplete/failed/running.
 * Healthy complete venues never see this. Restore fills missing masters only unless
 * the owner explicitly confirms recreating deliberately deleted starters.
 */

import * as React from "react";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { restoreHtcStartersAction } from "@/app/(app)/library/starter-provisioning-actions";
import { Button } from "@/components/ui/button";
import type { StarterProvisioningSnapshot } from "@/lib/provisioning/starters";

export function StarterProvisioningBanner({
  snapshot,
}: {
  snapshot: StarterProvisioningSnapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirmRecreate, setConfirmRecreate] = React.useState(false);

  if (!snapshot.needsAttention) return null;

  const isPreparing = snapshot.status === "running" || snapshot.status === "pending";
  const isCompleteButRepair =
    snapshot.status === "complete" && snapshot.needsAttention; // defensive; normally hidden

  const title = isPreparing
    ? "Preparing your starter resources"
    : "Some of your starter resources aren't ready yet";

  const body = isPreparing
    ? "You can continue setting up your venue while we finish preparing them."
    : "You can continue setting up your venue while we finish preparing them. Restore only fills missing Hello to Cheers starters — your customizations stay intact.";

  function runRestore(recreateDeleted: boolean) {
    startTransition(async () => {
      const result = await restoreHtcStartersAction({ recreateDeleted });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const seed = result.result;
      if (seed.skippedBecauseRunning) {
        toast.message("Starter preparation is already in progress. Please try again in a moment.");
      } else if (seed.ok) {
        toast.success("Starter resources are ready.");
        setConfirmRecreate(false);
      } else {
        toast.message(
          "Some starters still need attention. You can keep working and try Restore again.",
        );
      }
      router.refresh();
    });
  }

  return (
    <div
      className="htc-surface-guidance space-y-3 px-3 py-3"
      data-testid="starter-provisioning-banner"
      data-status={snapshot.status}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-heading">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>

      {!isPreparing || snapshot.status === "incomplete" || snapshot.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            data-testid="restore-htc-starters"
            onClick={() => runRestore(false)}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Restoring…
              </>
            ) : (
              "Restore HTC starters"
            )}
          </Button>
          {snapshot.status === "complete" || isCompleteButRepair ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              data-testid="restore-htc-starters-confirm-deleted"
              onClick={() => setConfirmRecreate((v) => !v)}
            >
              Also restore deleted starters…
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Preparing…
        </div>
      )}

      {confirmRecreate ? (
        <div
          className="space-y-2 rounded-md border border-border/70 bg-background/60 p-3"
          data-testid="restore-deleted-confirm"
        >
          <p className="text-xs text-muted-foreground">
            This recreates Hello to Cheers starters that were removed from your Library.
            Venue-created templates and edits to existing starters are not overwritten.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid="restore-htc-starters-recreate-deleted"
              onClick={() => runRestore(true)}
            >
              Confirm restore deleted starters
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmRecreate(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
