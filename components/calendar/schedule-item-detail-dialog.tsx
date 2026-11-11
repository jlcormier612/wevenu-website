"use client";

import * as React from "react";

import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";

import { getBlockAction } from "@/app/(app)/availability/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatTime, resolveItemMeta } from "@/components/calendar/calendar-shared";
import { describeRecurrence } from "@/lib/calendar/recurrence";
import { formScheduleItemTimes } from "@/lib/calendar/schedule-item-times";
import type { CalendarItem } from "@/lib/calendar/types";
import type { CalendarBlock } from "@/lib/availability/types";
import { manualScheduleTypeLabel } from "@/lib/availability/constants";

/**
 * Read-only appointment / schedule-item details.
 * Opening a calendar record must not dump the coordinator into the edit form —
 * Edit is an explicit action from this dialog.
 */
export function ScheduleItemDetailDialog({
  item,
  open,
  onOpenChange,
  onEdit,
}: {
  item: CalendarItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (blockId: string) => void;
}) {
  const [block, setBlock] = React.useState<CalendarBlock | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    if (!open || !item?.rawId) {
      setBlock(null);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    void (async () => {
      const next = await getBlockAction(item.rawId!);
      if (cancelled) return;
      setLoading(false);
      if (!next) {
        setLoadError(true);
        setBlock(null);
        return;
      }
      setBlock(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, item?.rawId]);

  const meta = item ? resolveItemMeta(item) : null;
  const typeLabel = item?.catalogLabel?.trim()
    || (block ? manualScheduleTypeLabel(block.type) : null)
    || meta?.label
    || "Appointment";

  const times = block
    ? formScheduleItemTimes(block.isAllDay, block.startTime, block.endTime)
    : { startTime: item?.time ?? "", endTime: item?.endTime ?? "" };
  const whenLabel = (() => {
    if (!block && !item) return "";
    const startDate = block?.startDate ?? item!.date;
    const endDate = block?.endDate ?? item!.date;
    const datePart = startDate === endDate
      ? formatLongDate(startDate)
      : `${formatLongDate(startDate)} – ${formatLongDate(endDate)}`;
    if (block?.isAllDay || (!times.startTime && !item?.time)) {
      return `${datePart} · All day`;
    }
    const clock = times.endTime || item?.endTime
      ? `${formatTime(times.startTime || item!.time!)} – ${formatTime(times.endTime || item!.endTime!)}`
      : formatTime(times.startTime || item!.time!);
    return `${datePart} · ${clock}`;
  })();

  const workspaceHref = block?.convertedLeadId
    ? `/leads/${block.convertedLeadId}`
    : block?.leadId
      ? `/leads/${block.leadId}`
      : block?.clientId
        ? `/clients/${block.clientId}`
        : item?.convertedLeadId
          ? `/leads/${item.convertedLeadId}`
          : item?.leadId
            ? `/leads/${item.leadId}`
            : item?.clientId
              ? `/clients/${item.clientId}`
              : null;
  const workspaceLabel = item?.relatedName
    ? `Open ${item.relatedName}`
    : workspaceHref?.startsWith("/clients/")
      ? "Open client workspace"
      : "Open lead workspace";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="schedule-item-detail">
        <DialogHeader>
          <DialogTitle>{item?.title ?? "Schedule item"}</DialogTitle>
          <DialogDescription>
            {typeLabel}
            {whenLabel ? ` · ${whenLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading details…</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">Could not load this schedule item.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {block?.notes ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap text-foreground">{block.notes}</p>
              </div>
            ) : null}
            {item?.relatedName || workspaceHref ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Related to</p>
                <p className="text-foreground">{item?.relatedName ?? "Linked workspace"}</p>
              </div>
            ) : null}
            {block && block.recurrenceRule !== "none" ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Repeats</p>
                <p className="text-foreground">
                  {describeRecurrence({
                    rule: block.recurrenceRule,
                    interval: block.recurrenceInterval,
                    endsOn: block.recurrenceEndsOn,
                    count: block.recurrenceCount,
                  })}
                </p>
              </div>
            ) : null}
            {!loading && !loadError && !block?.notes && !item?.relatedName && !workspaceHref
              && (!block || block.recurrenceRule === "none") ? (
              <p className="text-muted-foreground">No additional details.</p>
            ) : null}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-col gap-2 sm:flex-row">
            {workspaceHref ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={<Link href={workspaceHref} />}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {workspaceLabel}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {item?.rawId ? (
              <Button
                type="button"
                size="sm"
                data-testid="schedule-item-detail-edit"
                onClick={() => {
                  const id = item.rawId!;
                  onOpenChange(false);
                  onEdit(id);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
