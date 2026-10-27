"use client";

import * as React from "react";

import { duplicateTemplateAction } from "@/app/(app)/floor-plan-templates/actions";
import { FloorPlanTemplateDetailsSheet } from "@/components/floor-plan-templates/floor-plan-template-details-sheet";
import { StarterOwnershipBanner } from "@/components/library/starter-ownership-banner";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VenueSpace } from "@/lib/availability/types";
import { eventTypeLabel } from "@/lib/leads/constants";
import type { FloorPlanTemplate } from "@/lib/floor-plan-templates/types";

export function FloorPlanTemplateEditorHeader({
  template,
  spaces,
  spaceName,
  objectCount,
  masterDescription,
  acceptedEventTypes = [],
}: {
  template: FloorPlanTemplate;
  spaces: VenueSpace[];
  spaceName: string | null;
  objectCount: number;
  masterDescription?: string | null;
  acceptedEventTypes?: string[];
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const isStarter = Boolean(template.sourceMasterKey);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
          {isStarter && <Badge variant="muted">{LIBRARY_LABELS.starter}</Badge>}
          {!isStarter && <Badge variant="outline">{LIBRARY_LABELS.yourTemplate}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {template.eventType ? eventTypeLabel(template.eventType) : "Any event type"}
          {spaceName ? ` · ${spaceName}` : ""} · {objectCount} item{objectCount !== 1 ? "s" : ""}
        </p>
        {masterDescription ? (
          <p className="text-sm text-muted-foreground max-w-2xl">{masterDescription}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="floor-plan-template-edit-details"
            onClick={() => setDetailsOpen(true)}
          >
            {LIBRARY_LABELS.editDetails}
          </Button>
        </div>
      </div>
      {isStarter ? (
        <StarterOwnershipBanner
          templateName={template.name}
          itemNoun="layout objects"
          customizeHref={(id) => `/library/floor-plan-templates/${id}`}
          onCustomize={async () => {
            const suggested = template.name.replace(/\s*\(Starter\)\s*$/i, "").trim() || template.name;
            const result = await duplicateTemplateAction(template.id, `${suggested} — ${new Date().getFullYear()}`);
            if (result.ok && result.templateId) {
              return { ok: true as const, templateId: result.templateId };
            }
            return { ok: false as const, message: (result as { message?: string }).message };
          }}
        />
      ) : null}

      <FloorPlanTemplateDetailsSheet
        template={template}
        spaces={spaces}
        acceptedEventTypes={acceptedEventTypes}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
