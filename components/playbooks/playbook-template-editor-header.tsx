"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { duplicateTemplateAction } from "@/app/(app)/playbooks/actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { StarterOwnershipBanner } from "@/components/library/starter-ownership-banner";
import { PlaybookTemplateDetailsSheet } from "@/components/playbooks/playbook-template-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eventTypeLabel } from "@/lib/leads/constants";
import { playbookKindLabel, PLAYBOOK_KINDS } from "@/lib/playbooks/constants";
import type { PlaybookTemplate } from "@/lib/playbooks/types";

export function PlaybookTemplateEditorHeader({
  template,
  taskCount,
  milestoneCount,
}: {
  template: PlaybookTemplate;
  taskCount: number;
  milestoneCount: number;
}) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [dupPending, startDup] = React.useTransition();
  const isStarter = Boolean(template.sourceMasterKey);
  const kindEmoji = PLAYBOOK_KINDS.find((k) => k.value === template.kind)?.emoji;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium text-heading">{template.name}</h1>
          {isStarter && <Badge variant="muted">{LIBRARY_LABELS.starter}</Badge>}
          {!isStarter && <Badge variant="outline">{LIBRARY_LABELS.yourTemplate}</Badge>}
          <span className="text-xs font-medium text-muted-foreground">
            {kindEmoji} {playbookKindLabel(template.kind)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {template.eventType ? `${eventTypeLabel(template.eventType)} template` : "All event types"}
          {` · ${taskCount} task${taskCount !== 1 ? "s" : ""} across ${milestoneCount} milestone${milestoneCount !== 1 ? "s" : ""}`}
        </p>
        {template.description ? (
          <p className="text-sm text-muted-foreground max-w-2xl">{template.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="playbook-template-edit-details"
            onClick={() => setDetailsOpen(true)}
          >
            {LIBRARY_LABELS.editDetails}
          </Button>
          {!isStarter ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="playbook-template-duplicate"
              disabled={dupPending}
              onClick={() => {
                startDup(async () => {
                  const result = await duplicateTemplateAction(template.id, `${template.name} (Copy)`);
                  if (result.ok && result.templateId) {
                    toast.success("Template duplicated.");
                    router.push(`/library/playbooks/${result.templateId}`);
                  } else {
                    toast.error(result.message ?? "Could not duplicate template.");
                  }
                });
              }}
            >
              {LIBRARY_LABELS.duplicate}
            </Button>
          ) : null}
        </div>
      </div>

      {isStarter ? (
        <StarterOwnershipBanner
          templateName={template.name}
          itemNoun="tasks"
          customizeHref={(id) => `/library/playbooks/${id}`}
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

      <PlaybookTemplateDetailsSheet
        template={template}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
