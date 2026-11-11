"use client";

/**
 * Template-level name / event type / description — Planning templates have no
 * space column; kind (Client vs Venue) is immutable after create.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateTemplateDetailsAction } from "@/app/(app)/playbooks/actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_TYPES } from "@/lib/leads/constants";
import { playbookKindLabel } from "@/lib/playbooks/constants";
import type { PlaybookTemplate } from "@/lib/playbooks/types";

const ANY_EVENT_TYPE = "__any__";

export function PlaybookTemplateDetailsSheet({
  template,
  open,
  onOpenChange,
}: {
  template: PlaybookTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(template.name);
  const [eventType, setEventType] = React.useState(template.eventType ?? ANY_EVENT_TYPE);
  const [description, setDescription] = React.useState(template.description ?? "");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setName(template.name);
      setEventType(template.eventType ?? ANY_EVENT_TYPE);
      setDescription(template.description ?? "");
    }
  }, [open, template]);

  function save() {
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    startTransition(async () => {
      const result = await updateTemplateDetailsAction(template.id, {
        name: name.trim(),
        eventType: eventType === ANY_EVENT_TYPE ? null : eventType,
        description: description.trim() || null,
      });
      if (result.ok) {
        toast.success(LIBRARY_LABELS.saved);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save template details.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.editDetails}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Rename this planning template and choose which event type it belongs to.
            Template type ({playbookKindLabel(template.kind)}) cannot change after create.
            Planning templates are not assigned to a venue space. This does not change milestones
            or tasks.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="playbook-template-details-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Event type</Label>
            <Select
              value={eventType}
              onValueChange={setEventType}
              items={[{ value: ANY_EVENT_TYPE, label: "All event types" }, ...EVENT_TYPES]}
            >
              <SelectTrigger className="h-9 text-sm" data-testid="playbook-template-details-event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_EVENT_TYPE}>All event types</SelectItem>
                {EVENT_TYPES.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional"
              data-testid="playbook-template-details-description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {LIBRARY_LABELS.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={save} data-testid="playbook-template-details-save">
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  {LIBRARY_LABELS.saving}
                </>
              ) : (
                LIBRARY_LABELS.saveChanges
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
