"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { keepDuplicateSeparateAction } from "@/app/(app)/leads/[id]/actions";
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

  return (
    <>
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <p className="font-medium text-heading">Possible duplicate inquiry</p>
        <p className="mt-1 text-muted-foreground">
          We found information that may connect this inquiry to an existing customer.
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
              Possible existing customer
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
            <DialogTitle>This looks like a duplicate</DialogTitle>
            <DialogDescription>
              This new inquiry may be from a customer you already have in your records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground">
            <p>
              If it is the same customer, consolidate the useful information into the existing
              lead, then delete this duplicate lead. Hello to Cheers does not automatically merge
              these records — you stay in control of what is kept.
            </p>
            <div>
              <p className="font-medium text-heading">What to do</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Open the existing lead.</li>
                <li>Add any new contact information you want to keep (email, phone, partner details).</li>
                <li>Copy any useful inquiry details or message into a note on the existing lead.</li>
                <li>Delete this duplicate lead.</li>
                <li>Continue working from the original lead.</li>
              </ol>
            </div>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              <p className="font-medium text-heading">Reporting</p>
              <p className="mt-1">
                Deleting an erroneous duplicate lead removes that duplicate from your lead and
                conversion totals. It does not change the original lead&apos;s history or Booking
                status, and it does not create a second Booking.
              </p>
            </div>
            <p className="text-muted-foreground">
              If these are actually different customers, choose Keep separate.
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
                <Button
                  type="button"
                  variant="secondary"
                  render={<Link href={`/leads/${review.matchedLeadId}`} />}
                >
                  Open existing lead
                </Button>
              ) : null}
              <Button type="button" onClick={() => setGuidanceOpen(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
