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
import {
  INCOMPLETE_TEMPLATE_WARNING_BODY,
  INCOMPLETE_TEMPLATE_WARNING_TITLE,
} from "@/lib/library/template-readiness";

export function IncompleteTemplateWarningDialog({
  open,
  pending,
  onGoBack,
  onApplyAnyway,
}: {
  open: boolean;
  pending?: boolean;
  onGoBack: () => void;
  onApplyAnyway: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onGoBack(); }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        data-testid="incomplete-template-warning"
      >
        <DialogHeader>
          <DialogTitle>{INCOMPLETE_TEMPLATE_WARNING_TITLE}</DialogTitle>
          <DialogDescription>{INCOMPLETE_TEMPLATE_WARNING_BODY}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onGoBack}
            disabled={pending}
            data-testid="incomplete-template-go-back"
          >
            Go Back
          </Button>
          <Button
            type="button"
            onClick={onApplyAnyway}
            disabled={pending}
            data-testid="incomplete-template-apply-anyway"
          >
            {pending ? "Applying…" : "Apply Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
