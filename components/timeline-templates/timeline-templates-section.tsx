"use client";

/**
 * The Timeline Template Library — a card grid, one card per template
 * (Timeline Templates, 2026-07-10). Includes Hello to Cheers starter badge,
 * Restore starters, and a real activity preview (titles + day grouping).
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Eye, Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { addTimelineStarterAgainAction } from "@/app/(app)/library/timeline-templates/actions";
import {
  duplicateTemplateAction, renameTemplateAction, setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/timeline-templates/actions";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TimelineTemplateStarterPicker } from "@/components/timeline-templates/timeline-template-starter-picker";
import type { VenueSpace } from "@/lib/availability/types";
import { eventTypeLabel, formatRelative } from "@/lib/leads/constants";
import {
  formatStarterTimelineDayLabel,
  groupTimelineItemsByDay,
} from "@/lib/timeline-templates/constants";
import {
  TIMELINE_STARTER_MASTERS,
  getTimelineStarterMaster,
  type TimelineStarterMasterKey,
} from "@/lib/timeline-templates/starters";
import type { TimelineTemplateWithStats } from "@/lib/timeline-templates/types";

function sortTemplates(templates: TimelineTemplateWithStats[]): TimelineTemplateWithStats[] {
  return [...templates].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1; // archived always last
    return a.name.localeCompare(b.name);
  });
}

function TemplatePreviewSheet({
  template,
  open,
  onOpenChange,
}: {
  template: TimelineTemplateWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const master = template?.sourceMasterKey
    ? getTimelineStarterMaster(template.sourceMasterKey)
    : undefined;
  const groups = template
    ? groupTimelineItemsByDay(template.previewItems)
    : [];
  const multiDay = groups.length > 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>{template?.name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>Timeline Template</span>
            {template?.sourceMasterKey && <Badge variant="muted">Starter</Badge>}
            {template && <span>· {template.itemCount} {template.itemCount === 1 ? "activity" : "activities"}</span>}
          </div>
        </SheetHeader>
        {template && (
          <div className="px-4 pb-6 space-y-4">
            {(master?.description ?? null) && (
              <p className="text-sm text-muted-foreground">{master?.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Activities and sequence only — add times on the Working Timeline after you apply this template.
            </p>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-4">
                {groups.map((group) => (
                  <div key={group.dayOffset} className="space-y-1.5">
                    {multiDay && (
                      <p className="text-xs font-medium text-heading">
                        {formatStarterTimelineDayLabel(group.dayOffset, template.sourceMasterKey)}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {group.items.map((item, i) => (
                        <li key={`${group.dayOffset}-${i}`} className="text-sm text-foreground">
                          · {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" render={<Link href={`/library/timeline-templates/${template.id}`} />}>
                Open editor
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StarterMenu({ missingKeys }: { missingKeys: TimelineStarterMasterKey[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (missingKeys.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button type="button" variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookPlus className="mr-1.5 h-4 w-4" />}
          Restore starters
        </Button>
      } />
      <DropdownMenuContent align="end">
        {TIMELINE_STARTER_MASTERS.filter((m) => missingKeys.includes(m.key)).map((m) => (
          <DropdownMenuItem
            key={m.key}
            onClick={() => startTransition(async () => {
              const r = await addTimelineStarterAgainAction(m.key);
              if (r.ok) {
                toast.success("Starter added — your earlier customizations were left alone.");
                router.refresh();
              } else toast.error(r.message ?? "Could not add starter.");
            })}
          >
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TemplateCard({
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle, onPreview, archivedView,
}: {
  template: TimelineTemplateWithStats;
  busy: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchiveToggle: () => void;
  onPreview: () => void;
  archivedView?: boolean;
}) {
  const router = useRouter();
  const eventType = template.eventType ? eventTypeLabel(template.eventType) : "Any event type";

  return (
    <div
      className={`group flex flex-col gap-2 rounded-sm border border-border bg-card p-4 transition-colors ${template.isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-heading">{template.name}</p>
        {!archivedView && (
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} />}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onPreview}><Eye className="mr-2 h-3.5 w-3.5" />Preview</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/library/timeline-templates/${template.id}`)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
                {!template.isArchived && !template.isDefault && (
                  <DropdownMenuItem onClick={onSetDefault}>Set as Default</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onArchiveToggle}>{template.isArchived ? "Restore" : "Archive"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{eventType}</Badge>
        {template.spaceName && <Badge variant="accent" className="text-[10px]">{template.spaceName}</Badge>}
        {template.sourceMasterKey && !template.isArchived && (
          <Badge variant="muted" className="text-[10px]">Starter</Badge>
        )}
        {template.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
        {template.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
      </div>

      {template.previewItems.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {template.previewItems.slice(0, 3).map((item, i) => (
            <li key={i} className="truncate">· {item.title}</li>
          ))}
          {template.previewItems.length > 3 && (
            <li>+ {template.previewItems.length - 3} more</li>
          )}
        </ul>
      )}

      <p className="mt-auto text-xs text-muted-foreground">
        {template.itemCount} item{template.itemCount !== 1 ? "s" : ""} · Updated {formatRelative(template.updatedAt)}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={onPreview}>{LIBRARY_LABELS.preview}</Button>
        {archivedView ? (
          <Button type="button" size="sm" variant="outline" onClick={onArchiveToggle} disabled={busy}>
            {LIBRARY_LABELS.restore}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" render={<Link href={`/library/timeline-templates/${template.id}`} />}>
            {LIBRARY_LABELS.edit}
          </Button>
        )}
      </div>
    </div>
  );
}

export function TimelineTemplatesSection({
  initialTemplates, spaces, missingStarterKeys = [],
}: {
  initialTemplates: TimelineTemplateWithStats[];
  spaces: VenueSpace[];
  missingStarterKeys?: TimelineStarterMasterKey[];
}) {
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState<TimelineTemplateWithStats | null>(null);
  const router = useRouter();

  React.useEffect(() => { setTemplates(initialTemplates); }, [initialTemplates]);

  async function withBusy(id: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusyId(id);
    const result = await fn();
    setBusyId(null);
    if (!result.ok) toast.error(result.message ?? "Something went wrong.");
    return result;
  }

  async function handleDuplicate(id: string, name: string) {
    const result = await withBusy(id, () => duplicateTemplateAction(id, `${name} (Copy)`));
    if (result.ok) {
      toast.success("Template duplicated.");
      router.push(`/library/timeline-templates/${(result as { templateId?: string }).templateId}`);
    }
  }

  async function handleRename(id: string, currentName: string) {
    const name = window.prompt("Rename template", currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    const result = await withBusy(id, () => renameTemplateAction(id, name.trim()));
    if (result.ok) setTemplates((p) => p.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)));
  }

  async function handleSetDefault(id: string, template: TimelineTemplateWithStats) {
    const result = await withBusy(id, () => setTemplateDefaultAction(id));
    if (result.ok) {
      setTemplates((p) => p.map((t) => {
        if (t.id === id) return { ...t, isDefault: true };
        if (t.eventType === template.eventType && t.spaceId === template.spaceId) return { ...t, isDefault: false };
        return t;
      }));
    }
  }

  async function handleArchiveToggle(id: string, isArchived: boolean) {
    const result = await withBusy(id, () => setTemplateArchivedAction(id, !isArchived));
    if (result.ok) {
      setTemplates((p) => p.map((t) => (t.id === id ? { ...t, isArchived: !isArchived, isDefault: !isArchived ? false : t.isDefault } : t)));
      toast.success(isArchived ? "Template restored." : "Template archived.");
    }
  }

  const sorted = React.useMemo(() => sortTemplates(templates), [templates]);
  const { active, archived } = React.useMemo(
    () => partitionArchived(sorted, (t) => t.isArchived),
    [sorted],
  );

  if (templates.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border py-10 text-center space-y-3">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-heading">No timeline templates yet</p>
        <p className="text-xs text-muted-foreground">Reusable day-of schedules a venue builds once and applies to any booking.</p>
        <div className="flex justify-center gap-2 pt-1 flex-wrap">
          <StarterMenu missingKeys={missingStarterKeys} />
          <TimelineTemplateStarterPicker existingTemplates={templates} spaces={spaces} />
        </div>
      </div>
    );
  }

  function renderCard(t: TimelineTemplateWithStats, archivedView: boolean) {
    return (
      <TemplateCard
        key={t.id} template={t} busy={busyId === t.id} archivedView={archivedView}
        onPreview={() => setPreviewing(t)}
        onRename={() => handleRename(t.id, t.name)}
        onDuplicate={() => handleDuplicate(t.id, t.name)}
        onSetDefault={() => handleSetDefault(t.id, t)}
        onArchiveToggle={() => handleArchiveToggle(t.id, t.isArchived)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 flex-wrap">
        <StarterMenu missingKeys={missingStarterKeys} />
        <TimelineTemplateStarterPicker existingTemplates={active} spaces={spaces} />
      </div>
      <p className="text-xs text-muted-foreground">
        Edit reusable timelines here. Applying a timeline to a booking happens on the event — never as a client send from the Library.
      </p>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No active timeline templates.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((t) => renderCard(t, false))}
        </div>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archived.map((t) => renderCard(t, true))}
        </div>
      </LibraryArchivedSection>
      <TemplatePreviewSheet
        template={previewing}
        open={!!previewing}
        onOpenChange={(o) => { if (!o) setPreviewing(null); }}
      />
    </div>
  );
}
