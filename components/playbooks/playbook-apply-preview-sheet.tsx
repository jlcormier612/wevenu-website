"use client";

/**
 * Choose → Preview → Apply sheet for Planning Templates.
 * Reuses the Sheet pattern from PlaybookStarterPicker; does not change apply engine behavior.
 */
import * as React from "react";

import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  applyPlaybookAction,
  getPlaybookApplyPreviewAction,
} from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  APPLY_PREVIEW_ISOLATION_NOTE,
  applyPreviewKindCopy,
  formatTemplateReminder,
  groupTasksForApplyPreview,
  type ApplyPreviewMilestoneGroup,
} from "@/lib/playbooks/apply-preview";
import { formatShortDaysOffset } from "@/lib/playbooks/due-dates";
import type { PlaybookKind } from "@/lib/playbooks/types";

export function PlaybookApplyPreviewSheet({
  open,
  onOpenChange,
  templateId,
  kind,
  eventId,
  eventDate,
  onApplied,
  /** When false, preview-only (e.g. event create form before an event exists). */
  canApply = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  kind: PlaybookKind;
  eventId?: string;
  eventDate?: string;
  onApplied?: () => void;
  canApply?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  const [applying, startApply] = React.useTransition();
  const [templateName, setTemplateName] = React.useState("");
  const [groups, setGroups] = React.useState<ApplyPreviewMilestoneGroup[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const kindCopy = applyPreviewKindCopy(kind);
  const taskCount = groups.reduce((n, g) => n + g.taskTitles.length, 0);
  const applyEnabled = canApply && !!eventId && !!eventDate;

  React.useEffect(() => {
    if (!open || !templateId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setGroups([]);
    setTemplateName("");
    void getPlaybookApplyPreviewAction(templateId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      setTemplateName(result.template.name);
      setGroups(groupTasksForApplyPreview(result.milestones, result.tasks));
    });
    return () => {
      cancelled = true;
    };
  }, [open, templateId]);

  function handleApply() {
    if (!eventId || !eventDate) return;
    startApply(async () => {
      const result = await applyPlaybookAction(eventId, templateId, eventDate);
      if (result.ok) {
        toast.success(
          kind === "client"
            ? "Couple checklist applied as a draft — review it here, then release when you're ready."
            : "Team checklist applied — it's active for your venue team on this event.",
        );
        onOpenChange(false);
        onApplied?.();
      } else {
        toast.error(result.message ?? "Could not apply checklist.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="mb-4 shrink-0 space-y-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent" className="text-[10px]">{kindCopy.label}</Badge>
          </div>
          <SheetTitle className="pr-8">
            {loading ? "Loading checklist…" : templateName || "Checklist preview"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">{kindCopy.explanation}</p>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading what&apos;s included…
            </div>
          )}
          {loadError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm">
              {loadError}
            </p>
          )}
          {!loading && !loadError && (
            <>
              <p className="text-xs text-muted-foreground">
                {groups.length} section{groups.length === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}
              </p>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  This template doesn&apos;t have any tasks yet.{" "}
                  <Link href={`/library/playbooks/${templateId}`} className="text-primary hover:underline">
                    Add tasks in Library
                  </Link>{" "}
                  before applying.
                </p>
              ) : (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div key={g.milestoneId} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.milestoneName}
                      </p>
                      <ul className="space-y-1 rounded-lg border border-border bg-muted/20 px-3 py-2">
                        {g.tasks.map((task, i) => {
                          const reminder = formatTemplateReminder(task.reminderBeforeDays);
                          return (
                            <li key={`${g.milestoneId}-${i}`} className="text-sm text-foreground">
                              <span>{task.title}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatShortDaysOffset(task.daysOffset)}
                              </span>
                              {reminder && (
                                <span className="ml-2 block text-[11px] text-muted-foreground">{reminder}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border/60 pt-3">
                {APPLY_PREVIEW_ISOLATION_NOTE}
              </p>
            </>
          )}
        </div>

        <div className="mt-4 flex shrink-0 flex-col gap-2 border-t border-border/60 pt-4">
          {applyEnabled ? (
            <Button
              type="button"
              onClick={handleApply}
              disabled={applying || loading || !!loadError || taskCount === 0}
              className="w-full"
            >
              {applying ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Applying…</>
              ) : (
                "Apply to this event"
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center pb-1">
              This is a preview of the Library template. After you create the event, you can apply a checklist from Planning.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={applying}>
              {applyEnabled ? "Cancel" : "Done"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              render={<Link href={`/library/playbooks/${templateId}`} />}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Edit in Library
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
