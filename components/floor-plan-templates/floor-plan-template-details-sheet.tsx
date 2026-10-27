"use client";

/**
 * Template-level name / event type / space — separate from layout object editing.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateTemplateDetailsAction } from "@/app/(app)/floor-plan-templates/actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { VenueSpace } from "@/lib/availability/types";
import {
  FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE,
  buildFloorPlanTemplateEditEventTypeOptions,
} from "@/lib/floor-plan-templates/event-type-options";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";

const NO_SPACE = "__none__";

export function FloorPlanTemplateDetailsSheet({
  template,
  spaces,
  acceptedEventTypes,
  open,
  onOpenChange,
}: {
  template: FloorPlanTemplate;
  spaces: VenueSpace[];
  acceptedEventTypes: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(template.name);
  const [eventType, setEventType] = React.useState(template.eventType ?? FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE);
  const [spaceId, setSpaceId] = React.useState(template.spaceId ?? NO_SPACE);
  const [pending, startTransition] = React.useTransition();

  const eventTypeItems = React.useMemo(
    () => buildFloorPlanTemplateEditEventTypeOptions(acceptedEventTypes, template.eventType),
    [acceptedEventTypes, template.eventType],
  );

  React.useEffect(() => {
    if (open) {
      setName(template.name);
      setEventType(template.eventType ?? FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE);
      setSpaceId(template.spaceId ?? NO_SPACE);
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
        eventType: eventType === FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE ? null : eventType,
        spaceId: spaceId === NO_SPACE ? null : spaceId,
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
            Rename this template and choose which event type or venue space it belongs to.
            This does not change individual layout objects — edit those on the template page.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="floor-plan-template-details-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Event type</Label>
            <Select
              value={eventType}
              onValueChange={setEventType}
              items={eventTypeItems}
            >
              <SelectTrigger className="h-9 text-sm" data-testid="floor-plan-template-details-event-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypeItems.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {spaces.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Venue space (optional)</Label>
              <Select
                value={spaceId}
                onValueChange={setSpaceId}
                items={[
                  { value: NO_SPACE, label: "No specific space" },
                  ...spaces.map((s) => ({ value: s.id, label: s.name })),
                ]}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="floor-plan-template-details-space">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SPACE}>No specific space</SelectItem>
                  {spaces.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Space association helps pick a default template for that location. It does not change
                room dimensions on the canvas.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              {LIBRARY_LABELS.cancel}
            </Button>
            <Button type="button" disabled={pending} onClick={save} data-testid="floor-plan-template-details-save">
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
