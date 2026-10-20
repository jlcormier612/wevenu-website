"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { keepDuplicateSeparateAction } from "@/app/(app)/leads/[id]/actions";
import { MergeLeadDialog } from "@/components/leads/merge-lead-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signalLabel, type DuplicateSignal } from "@/lib/leads/duplicate-detection";
import type { DuplicateReview } from "@/lib/leads/duplicate-review";
import { statusLabel } from "@/lib/leads/constants";

export function PossibleDuplicateBanner({
  review,
  newLead,
}: {
  review: DuplicateReview;
  newLead: {
    displayName: string;
    email: string | null;
    phone: string | null;
  };
}) {
  const router = useRouter();
  const [guidanceOpen, setGuidanceOpen] = React.useState(false);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (review.status !== "needs_review") return null;

  async function keepSeparate() {
    setPending(true);
    const result = await keepDuplicateSeparateAction(review.leadId);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Kept separate — this inquiry stays independent.");
    router.refresh();
  }

  function openMerge() {
    if (!review.matchedLeadId) {
      toast.error("No matching lead is linked for merge. Open the existing lead if you have one.");
      return;
    }
    setGuidanceOpen(false);
    setMergeOpen(true);
  }

  return (
    <>
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <p className="font-medium text-heading">Possible duplicate lead</p>
        <p className="mt-1 text-muted-foreground">
          This inquiry may match an existing lead. Review the match — merge only if both records
          are the same prospect. Hello to Cheers does not merge on its own.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-background/80 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">New inquiry</p>
            <p className="font-medium text-heading">{newLead.displayName}</p>
            {newLead.email ? <p className="text-muted-foreground">{newLead.email}</p> : null}
            {newLead.phone ? <p className="text-muted-foreground">{newLead.phone}</p> : null}
          </div>
          <div className="rounded-md border border-border bg-background/80 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Possible existing lead
            </p>
            <p className="font-medium text-heading">{review.matchedDisplayName}</p>
            {review.matchedEmail ? (
              <p className="text-muted-foreground">{review.matchedEmail}</p>
            ) : null}
            {review.matchedPhone ? (
              <p className="text-muted-foreground">{review.matchedPhone}</p>
            ) : null}
            {review.matchedSalesStage ? (
              <p className="text-muted-foreground">
                Status: {statusLabel(review.matchedSalesStage)}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Matched by:{" "}
              {review.signals.map((s) => signalLabel(s as DuplicateSignal)).join(", ")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setGuidanceOpen(true)} disabled={pending}>
            Review match
          </Button>
          {review.matchedLeadId ? (
            <Button
              type="button"
              size="sm"
              onClick={() => openMerge()}
              disabled={pending}
              data-testid="duplicate-merge-open"
            >
              Merge lead
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void keepSeparate()}
            disabled={pending}
          >
            Keep separate
          </Button>
          {review.matchedLeadId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              render={<Link href={`/leads/${review.matchedLeadId}`} />}
            >
              Open existing lead
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={guidanceOpen} onOpenChange={setGuidanceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Possible duplicate lead</DialogTitle>
            <DialogDescription>
              This new inquiry may match a lead you already have. Merge only when both submissions
              represent the same prospect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground">
            <p>
              If it is the same person, choose <span className="font-medium">Merge lead</span>. You
              will preview which record survives (usually the earliest), fill empty fields, resolve
              any conflicting values, and decide what to do with tour appointments before you
              confirm. Nothing merges until you confirm.
            </p>
            <div>
              <p className="font-medium text-heading">What to do</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Compare the new inquiry with the existing lead.</li>
                <li>
                  If they are the same prospect, choose Merge lead and review the preview carefully.
                </li>
                <li>Resolve any field or tour choices, then confirm the merge.</li>
                <li>Continue on the surviving lead. The other record is soft-marked and redirects here.</li>
              </ol>
            </div>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              <p className="font-medium text-heading">After a merge</p>
              <p className="mt-1">
                The secondary lead is soft-marked and hidden from active lead lists and lead-received
                reporting totals. Booking status on the surviving lead does not invent a second
                Booking. Past communications are not resent.
              </p>
            </div>
            <p className="text-muted-foreground">
              If these may be different prospects, choose Keep separate.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setGuidanceOpen(false);
                void keepSeparate();
              }}
            >
              Keep separate
            </Button>
            <div className="flex flex-wrap gap-2">
              {review.matchedLeadId ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    render={<Link href={`/leads/${review.matchedLeadId}`} />}
                  >
                    Open existing lead
                  </Button>
                  <Button
                    type="button"
                    onClick={() => openMerge()}
                    data-testid="duplicate-merge-from-modal"
                  >
                    Merge lead
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setGuidanceOpen(false)}>
                  Close
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {review.matchedLeadId ? (
        <MergeLeadDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          currentLeadId={review.leadId}
          initialOtherLeadId={review.matchedLeadId}
        />
      ) : null}
    </>
  );
}
