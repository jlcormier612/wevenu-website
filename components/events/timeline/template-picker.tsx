"use client";

import * as React from "react";

import Link from "next/link";
import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { applyTemplateAction } from "@/app/(app)/events/[id]/timeline-actions";
import { applyTimelineTemplateAction } from "@/app/(app)/timeline-templates/booking-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { eventTypeLabel } from "@/lib/leads/constants";
import { TIMELINE_TEMPLATES, formatTime } from "@/lib/timeline/constants";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

type LibraryTemplate = TimelineTemplate & { itemCount?: number };

type Selection =
  | { source: "library"; id: string }
  | { source: "starter"; id: string };

export function TemplatePicker({
  eventId,
  eventStartTime,
  templates = [],
  onApplied,
  existingEntryCount = 0,
}: {
  eventId: string;
  eventStartTime: string | null;
  /** Venue Timeline Templates library (archived excluded by the loader). */
  templates?: LibraryTemplate[];
  onApplied: () => void;
  /** When this Timeline already has entries, applying another template adds
   * to it rather than starting fresh — surfaced here so a coordinator can't
   * silently double up a Timeline they've already built (Timeline Release
   * Readiness, Release Blocker #3). */
  existingEntryCount?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Selection | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selectedLibrary = selected?.source === "library"
    ? templates.find((t) => t.id === selected.id)
    : undefined;
  const selectedStarter = selected?.source === "starter"
    ? TIMELINE_TEMPLATES.find((t) => t.id === selected.id)
    : undefined;
  const selectedName = selectedLibrary?.name ?? selectedStarter?.name;

  function handleApply() {
    if (!selected) return;
    if (existingEntryCount > 0) {
      const ok = confirm(
        `This Timeline already has ${existingEntryCount} ${existingEntryCount === 1 ? "entry" : "entries"}. Applying "${selectedName}" will add its entries on top — nothing existing will be changed or removed. Continue?`
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = selected.source === "library"
        ? await applyTimelineTemplateAction(eventId, selected.id, eventStartTime)
        : await applyTemplateAction(eventId, selected.id, eventStartTime);
      if (result.ok) {
        toast.success("Template applied.");
        setOpen(false);
        setSelected(null);
        onApplied();
      } else {
        toast.error(result.message ?? "Could not apply template.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null); }}>
      <SheetTrigger
        render={
          <Button type="button" variant="outline" size="sm" />
        }
      >
        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
        Use Template
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Apply a Timeline Template</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Choose a starting point from your library. All entries are fully editable after applying.
            {eventStartTime ? (
              <> Times are calculated from your event start time ({formatTime(eventStartTime)}).</>
            ) : (
              <> Set a start time on the event to get accurate times.</>
            )}
          </p>
        </SheetHeader>

        {existingEntryCount > 0 && (
          <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="space-y-0.5">
              <p className="font-medium text-warning-foreground">This Timeline already has {existingEntryCount} {existingEntryCount === 1 ? "entry" : "entries"}</p>
              <p className="text-xs text-muted-foreground">
                Applying a template adds its entries on top — nothing existing is changed or removed.
              </p>
            </div>
          </div>
        )}

        {!eventStartTime && (
          <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="space-y-0.5">
              <p className="font-medium text-warning-foreground">No start time set</p>
              <p className="text-xs text-muted-foreground">
                Template times will be calculated from noon. Set a start time on the event
                for accurate scheduling.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">My templates</h3>
              <p className="text-xs text-muted-foreground">
                From your Timeline Templates library.
              </p>
            </div>

            {templates.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
                <p className="text-sm text-muted-foreground">
                  No templates in your library yet.
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0"
                  render={<Link href="/library/timeline-templates" />}
                >
                  Create one in Timeline Templates
                </Button>
              </div>
            ) : (
              templates.map((template) => {
                const isSelected = selected?.source === "library" && selected.id === template.id;
                const count = template.itemCount;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelected({ source: "library", id: template.id })}
                    className={`w-full rounded-sm border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{template.name}</p>
                      {typeof count === "number" && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {count} {count === 1 ? "entry" : "entries"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {template.eventType ? eventTypeLabel(template.eventType) : "Any event type"}
                      {template.isDefault ? " · Default" : ""}
                    </p>
                  </button>
                );
              })
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Starter templates</h3>
              <p className="text-xs text-muted-foreground">
                Built-in starting points — not saved to your library.
              </p>
            </div>
            {TIMELINE_TEMPLATES.map((template) => {
              const isSelected = selected?.source === "starter" && selected.id === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelected({ source: "starter", id: template.id })}
                  className={`w-full rounded-sm border p-4 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{template.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {template.entries.length} entries
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{template.description}</p>

                  {isSelected && (
                    <div className="mt-3 space-y-1 border-t border-border pt-3">
                      {template.entries.slice(0, 6).map((entry, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          · {entry.title}
                        </p>
                      ))}
                      {template.entries.length > 6 && (
                        <p className="text-xs text-muted-foreground">
                          + {template.entries.length - 6} more entries…
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </section>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setOpen(false); setSelected(null); }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selected || pending}
            onClick={handleApply}
          >
            {pending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Applying…</>
            ) : (
              <>Apply {selectedName ?? "Template"}</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
