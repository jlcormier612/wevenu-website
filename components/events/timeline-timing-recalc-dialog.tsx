"use client";

/**
 * P1c — after Edit Event saves wedding dates or Day-of start, review working
 * timeline recalculation. Cancel writes nothing to timeline. Confirm updates
 * working entries only (never release snapshots).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  confirmEventTimingRecalcAction,
  previewEventTimingRecalcAction,
} from "@/app/(app)/events/[id]/timeline-timing-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { EventTimingRecalcHint } from "@/lib/events/types";
import type { TimingRecalcPreview } from "@/lib/timeline/timing-recalc";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  clientId?: string | null;
  hint: EventTimingRecalcHint | null;
};

export function TimelineTimingRecalcDialog({
  open,
  onOpenChange,
  eventId,
  clientId,
  hint,
}: Props) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<TimingRecalcPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const closedAfterApply = React.useRef(false);

  React.useEffect(() => {
    if (!open || !hint) {
      setPreview(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void previewEventTimingRecalcAction({
      eventId,
      previousEventDate: hint.previousEventDate,
      previousEndDate: hint.previousEventEndDate,
      previousStartTime: hint.previousStartTime,
    }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok || !("preview" in result)) {
        setError(result.ok === false ? result.message : "Could not build the timeline review.");
        setPreview(null);
        return;
      }
      setPreview(result.preview);
    });
    return () => {
      cancelled = true;
    };
  }, [open, hint, eventId]);

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (!closedAfterApply.current) {
      toast.message("Wedding details saved. Timeline item dates were left as they were.");
      router.refresh();
    }
    closedAfterApply.current = false;
    onOpenChange(false);
  }

  function handleApply() {
    if (!hint || !preview) return;
    setApplying(true);
    setError(null);
    void confirmEventTimingRecalcAction({
      eventId,
      fingerprint: preview.fingerprint,
      previousEventDate: hint.previousEventDate,
      previousEndDate: hint.previousEventEndDate,
      previousStartTime: hint.previousStartTime,
    }).then((result) => {
      setApplying(false);
      if (!result.ok) {
        setError(result.message);
        if ("preview" in result && result.preview) setPreview(result.preview);
        return;
      }
      const applied = "applied" in result ? result.applied : 0;
      closedAfterApply.current = true;
      onOpenChange(false);
      if (applied > 0) {
        toast.success(
          preview.hasActiveRelease
            ? `Updated ${applied} working timeline item${applied === 1 ? "" : "s"}. Not shared with the couple yet.`
            : `Updated ${applied} working timeline item${applied === 1 ? "" : "s"}.`,
        );
      } else {
        toast.message("No timeline items needed an automatic update. Review any items that still need attention.");
      }
      if (clientId) router.push(`/clients/${clientId}#timeline`);
      else router.push(`/events/${eventId}#timeline`);
      router.refresh();
    });
  }

  const eligible = preview?.rows.filter((r) => r.eligible) ?? [];
  const review = preview?.rows.filter((r) => !r.eligible) ?? [];
  const kindsLabel = preview?.kinds.includes("date") && preview.kinds.includes("day_of_start")
    ? "wedding dates and Day-of start"
    : preview?.kinds.includes("day_of_start")
      ? "Day-of start time"
      : "wedding dates";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="timeline-timing-recalc-dialog">
        <DialogHeader>
          <DialogTitle>Review timeline after {kindsLabel} change</DialogTitle>
          <DialogDescription>
            Wedding details are already saved. Choose whether to update working timeline items.
            {preview?.hasActiveRelease
              ? " The couple still sees the last schedule you shared until you share again."
              : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Building review…
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" data-testid="timeline-timing-recalc-error">{error}</p>
        ) : null}

        {preview && !loading ? (
          <div className="space-y-4 text-sm">
            {eligible.length === 0 && review.length === 0 ? (
              <p className="text-muted-foreground">
                No working timeline items need an automatic update for this change.
              </p>
            ) : null}

            {eligible.length > 0 ? (
              <div data-testid="timeline-timing-recalc-eligible">
                <p className="font-medium text-heading">Will update if you confirm</p>
                <ul className="mt-2 space-y-2">
                  {eligible.map((row) => (
                    <li key={`${row.kind}-${row.entryId}`} className="rounded-sm border border-border px-3 py-2">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{row.summary}</p>
                      {row.inActiveRelease ? (
                        <p className="mt-1 text-xs text-amber-800">
                          On the couple&apos;s last shared timeline — working copy only until you share again.
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {review.length > 0 ? (
              <div data-testid="timeline-timing-recalc-review">
                <p className="font-medium text-heading">Needs your decision</p>
                <ul className="mt-2 space-y-2">
                  {review.map((row) => (
                    <li key={`${row.kind}-${row.entryId}`} className="rounded-sm border border-amber-200/80 bg-amber-50/40 px-3 py-2">
                      <p className="font-medium text-foreground">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{row.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={applying} data-testid="timeline-timing-recalc-cancel">
            Leave timeline as-is
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={applying || loading || !preview}
            data-testid="timeline-timing-recalc-confirm"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {eligible.length > 0 ? "Update working timeline" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
