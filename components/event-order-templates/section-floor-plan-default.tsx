"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { updateEventOrderTemplateSectionAction } from "@/app/(app)/library/event-order-templates/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FLOOR_PLAN_SETUP_NAME_SUGGESTIONS } from "@/lib/floor-plans/required-vs-placed";
import type { EventOrderTemplateSection } from "@/lib/event-order-templates/types";

/** Template default for which floor plan setup this section's items are compared with. */
export function SectionFloorPlanDefault({
  templateId,
  section,
  onPersist,
}: {
  templateId: string;
  section: EventOrderTemplateSection;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
}) {
  const router = useRouter();
  const [setupName, setSetupName] = React.useState(section.floorPlanSetupName ?? "");
  const [notOnPlan, setNotOnPlan] = React.useState(section.notOnFloorPlan ?? false);
  const [pending, startTransition] = React.useTransition();
  const listId = `eo-section-setup-suggestions-${section.id}`;

  function save(input: { floorPlanSetupName?: string | null; notOnFloorPlan?: boolean }) {
    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateSectionAction(templateId, section.id, input);
      if (!r.ok) {
        onPersist("error", r.message ?? "Could not save.");
        return;
      }
      onPersist("saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5 rounded-md bg-muted/30 px-3 py-2" data-testid={`eo-template-section-floor-plan-${section.id}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!notOnPlan ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={`${listId}-input`} className="text-xs text-muted-foreground">Floor plan setup</Label>
            <Input
              id={`${listId}-input`}
              list={listId}
              value={setupName}
              placeholder={section.name}
              disabled={pending}
              className="h-8 w-44 text-sm"
              data-testid={`eo-template-section-setup-name-${section.id}`}
              onChange={(e) => setSetupName(e.target.value)}
              onBlur={() => {
                if (setupName.trim() !== (section.floorPlanSetupName ?? "")) save({ floorPlanSetupName: setupName.trim() || null });
              }}
            />
            <datalist id={listId}>
              {FLOOR_PLAN_SETUP_NAME_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Switch
            checked={notOnPlan}
            disabled={pending}
            data-testid={`eo-template-section-not-on-floor-plan-${section.id}`}
            onCheckedChange={(next) => {
              setNotOnPlan(next);
              save({ notOnFloorPlan: next });
            }}
          />
          <Label className="text-xs text-muted-foreground">Not on a floor plan</Label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {notOnPlan
          ? "This section's items are never compared with a floor plan."
          : `Items here are compared with the event's floor plan setup named “${setupName.trim() || section.name}”. Use the same name when you add setups to an event — you can also change the match on each event.`}
      </p>
    </div>
  );
}
