"use client";

import * as React from "react";

import { StarterOwnershipBanner } from "@/components/library/starter-ownership-banner";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { TimelineTemplateDetailsSheet } from "@/components/timeline-templates/timeline-template-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { duplicateTemplateAction } from "@/app/(app)/timeline-templates/actions";
import type { VenueSpace } from "@/lib/availability/types";
import { eventTypeLabel } from "@/lib/leads/constants";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

export function TimelineTemplateEditorHeader({
  template,
  spaces,
  spaceName,
  itemCount,
  masterDescription,
}: {
  template: TimelineTemplate;
  spaces: VenueSpace[];
  spaceName: string | null;
  itemCount: number;
  masterDescription?: string | null;
}) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const isStarter = Boolean(template.sourceMasterKey);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
          {isStarter && !template.isArchived && (
            <Badge variant="muted">{LIBRARY_LABELS.starter}</Badge>
          )}
          {!isStarter && !template.isArchived && (
            <Badge variant="outline">{LIBRARY_LABELS.yourTemplate}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {template.eventType ? eventTypeLabel(template.eventType) : "Any event type"}
          {spaceName ? ` · ${spaceName}` : ""} · {itemCount} item{itemCount !== 1 ? "s" : ""}
        </p>
        {masterDescription ? (
          <p className="text-sm text-muted-foreground">{masterDescription}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="timeline-template-edit-details"
            onClick={() => setDetailsOpen(true)}
          >
            {LIBRARY_LABELS.editDetails}
          </Button>
        </div>
      </div>

      {isStarter ? (
        <StarterOwnershipBanner
          templateName={template.name}
          itemNoun="activities"
          customizeHref={(id) => `/library/timeline-templates/${id}`}
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

      <TimelineTemplateDetailsSheet
        template={template}
        spaces={spaces}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
