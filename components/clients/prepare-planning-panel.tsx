"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  applyPlaybookAction,
  getPlaybookApplyPreviewAction,
} from "@/app/(app)/playbooks/actions";
import { PlaybookApplyPreviewSheet } from "@/components/playbooks/playbook-apply-preview-sheet";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  APPLY_PREVIEW_ISOLATION_NOTE,
  applyPreviewKindCopy,
  formatTemplateReminder,
  groupTasksForApplyPreview,
  type ApplyPreviewMilestoneGroup,
} from "@/lib/playbooks/apply-preview";
import { PLAYBOOK_KINDS, playbookKindLabel } from "@/lib/playbooks/constants";
import { formatShortDaysOffset } from "@/lib/playbooks/due-dates";
import { recommendPlanningTemplate } from "@/lib/playbooks/recommend";
import type { EventPlaybookApplication, PlaybookKind, PlaybookTemplate } from "@/lib/playbooks/types";

export function PreparePlanningPanel({
  eventId,
  eventDate,
  eventType,
  templates,
  applications,
}: {
  eventId: string | null;
  eventDate: string | null;
  eventType: string | null;
  templates: PlaybookTemplate[];
  applications: EventPlaybookApplication[];
}) {
  return (
    <div
      className="rounded-sm border px-6 py-5 text-left"
      style={{ borderColor: "#D8A7AA40", background: "#FDF8F8" }}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
        Planning Templates
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        Recommend, review, then apply. Applying does not release Client Planning to the client.
      </p>
      <div className="space-y-5">
        {PLAYBOOK_KINDS.map((k) => (
          <PreparePlanningKind
            key={k.value}
            kind={k.value}
            eventId={eventId}
            eventDate={eventDate}
            eventType={eventType}
            templates={templates}
            application={applications.find((a) => a.kind === k.value)}
          />
        ))}
      </div>
    </div>
  );
}

function PreparePlanningKind({
  kind,
  eventId,
  eventDate,
  eventType,
  templates,
  application,
}: {
  kind: PlaybookKind;
  eventId: string | null;
  eventDate: string | null;
  eventType: string | null;
  templates: PlaybookTemplate[];
  application: EventPlaybookApplication | undefined;
}) {
  const router = useRouter();
  const recommendation = recommendPlanningTemplate(templates, kind, eventType);
  const [selectedId, setSelectedId] = React.useState(recommendation.recommended?.id ?? "");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [groups, setGroups] = React.useState<ApplyPreviewMilestoneGroup[]>([]);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [applying, startApply] = React.useTransition();
  const kindCopy = applyPreviewKindCopy(kind);
  const label = playbookKindLabel(kind);
  const selected = recommendation.choices.find((t) => t.id === selectedId) ?? null;

  React.useEffect(() => {
    setSelectedId(recommendation.recommended?.id ?? "");
  }, [recommendation.recommended?.id]);

  React.useEffect(() => {
    if (!selectedId || application) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    void getPlaybookApplyPreviewAction(selectedId).then((result) => {
      if (cancelled) return;
      setLoadingPreview(false);
      if (!result.ok) {
        setGroups([]);
        return;
      }
      setGroups(groupTasksForApplyPreview(result.milestones, result.tasks));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, application]);

  function handleApply() {
    if (!eventId || !eventDate || !selectedId) return;
    startApply(async () => {
      const result = await applyPlaybookAction(eventId, selectedId, eventDate);
      if (result.ok) {
        toast.success(
          kind === "client"
            ? "Client Planning applied as a draft — it is not visible to the client until you release it."
            : "Venue Planning applied — it is active for your team on this event.",
        );
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not apply this Planning Template.");
      }
    });
  }

  const taskCount = groups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <div className="space-y-3 border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      <div>
        <p className="text-sm font-medium" style={{ color: "#3D2F30" }}>{label}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{kindCopy.explanation}</p>
      </div>

      {application ? (
        <p className="text-sm" style={{ color: "#3D2F30" }}>
          {kind === "client" && !application.releasedAt
            ? `Applied as a draft — ${application.templateName}. Not yet released to the client.`
            : kind === "client"
              ? `Released to the client — ${application.templateName}.`
              : `Configured — ${application.templateName}.`}
        </p>
      ) : !eventId || !eventDate ? (
        <p className="text-sm text-muted-foreground">
          Add event details before applying a Planning Template.
        </p>
      ) : recommendation.choices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matching template found.{" "}
          <Link href="/library/playbooks" className="underline-offset-2 hover:underline" style={{ color: "#5A3235" }}>
            Create one in Library
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-sm" style={{ color: "#3D2F30" }}>
            {recommendation.recommended
              ? <>Recommended: {recommendation.recommended.name}</>
              : recommendation.reason === "multiple_matches"
                ? "More than one matching Planning Template — choose which to apply."
                : "No matching template found"}
          </p>

          {recommendation.reason === "no_match" && recommendation.choices.length > 0 && (
            <p className="text-xs text-muted-foreground">
              You can still choose from existing {label} templates.
            </p>
          )}

          <Select
            value={selectedId}
            onValueChange={(v) => setSelectedId(v ?? "")}
            items={recommendation.choices.map((t) => ({
              value: t.id,
              label: t.isDefault ? `${t.name} (default)` : t.name,
            }))}
          >
            <SelectTrigger className="h-9 text-sm bg-white">
              <SelectValue placeholder="Choose a Planning Template" />
            </SelectTrigger>
            <SelectContent>
              {recommendation.choices.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.isDefault ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loadingPreview && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading what this will create…
            </p>
          )}

          {!loadingPreview && selected && groups.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {groups.length} section{groups.length === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"} will be created for this event.
              </p>
              {groups.map((g) => (
                <div key={g.milestoneId} className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.milestoneName}
                  </p>
                  <ul className="space-y-1">
                    {g.tasks.map((task, i) => {
                      const reminder = formatTemplateReminder(task.reminderBeforeDays);
                      return (
                        <li key={`${g.milestoneId}-${i}`} className="text-sm" style={{ color: "#3D2F30" }}>
                          {task.title}
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
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {APPLY_PREVIEW_ISOLATION_NOTE}
              </p>
            </div>
          )}

          {!loadingPreview && selected && groups.length === 0 && (
            <p className="text-xs text-muted-foreground">
              This Planning Template doesn&apos;t have any tasks yet.{" "}
              <Link href={`/library/playbooks/${selected.id}`} className="underline-offset-2 hover:underline" style={{ color: "#5A3235" }}>
                Add tasks in Library
              </Link>{" "}
              before applying.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              disabled={applying || !selectedId || loadingPreview || taskCount === 0}
            >
              {applying ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Applying…</>
              ) : (
                `Apply ${label}`
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={!selectedId}
            >
              Review
            </Button>
          </div>

          {selectedId ? (
            <PlaybookApplyPreviewSheet
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              templateId={selectedId}
              kind={kind}
              eventId={eventId}
              eventDate={eventDate ?? undefined}
              onApplied={() => router.refresh()}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
