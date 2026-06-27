"use client";

import * as React from "react";

import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { applyTemplateAction } from "@/app/(app)/events/[id]/timeline-actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TIMELINE_TEMPLATES, formatTime } from "@/lib/timeline/constants";

export function TemplatePicker({
  eventId,
  eventStartTime,
  onApplied,
}: {
  eventId: string;
  eventStartTime: string | null;
  onApplied: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleApply() {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await applyTemplateAction(eventId, selectedId, eventStartTime);
      if (result.ok) {
        toast.success("Template applied.");
        setOpen(false);
        setSelectedId(null);
        onApplied();
      } else {
        toast.error(result.message ?? "Could not apply template.");
      }
    });
  }

  const selected = TIMELINE_TEMPLATES.find((t) => t.id === selectedId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
            Choose a starting point. All entries are fully editable after applying.
            {eventStartTime ? (
              <> Times are calculated from your event start time ({formatTime(eventStartTime)}).</>
            ) : (
              <> Set a start time on the event to get accurate times.</>
            )}
          </p>
        </SheetHeader>

        <div className="space-y-3">
          {TIMELINE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedId(template.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                selectedId === template.id
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

              {selectedId === template.id && (
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
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setOpen(false); setSelectedId(null); }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedId || pending}
            onClick={handleApply}
          >
            {pending ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Applying…</>
            ) : (
              <>Apply {selected?.name ?? "Template"}</>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
