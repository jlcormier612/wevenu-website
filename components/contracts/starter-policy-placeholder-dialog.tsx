"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STARTER_POLICY_PLACEHOLDERS_MESSAGE } from "@/lib/contracts/starters";

export function StarterPolicyPlaceholderDialog({
  open,
  pending,
  onGoBack,
  onSendAnyway,
}: {
  open: boolean;
  pending?: boolean;
  onGoBack: () => void;
  onSendAnyway: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onGoBack(); }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        data-testid="starter-policy-placeholder-warning"
      >
        <DialogHeader>
          <DialogTitle>This agreement still contains starter policy placeholders</DialogTitle>
          <DialogDescription>{STARTER_POLICY_PLACEHOLDERS_MESSAGE}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onGoBack}
            disabled={pending}
            data-testid="starter-policy-go-back"
          >
            Go Back & Edit
          </Button>
          <Button
            type="button"
            onClick={onSendAnyway}
            disabled={pending}
            data-testid="starter-policy-send-anyway"
          >
            {pending ? "Sending…" : "Send Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
