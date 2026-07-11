"use client";

/**
 * The Timeline Template Library — a card grid, one card per template
 * (Timeline Templates, 2026-07-10). Mirrors the Planning Template Library's
 * card shape (components/settings/playbooks-section.tsx) but scoped to
 * exactly what was asked for here: no filter/sort controls were requested
 * for this library, so none are built. Archived templates stay visible
 * (muted, sorted last) so there's a way back via Unarchive.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  duplicateTemplateAction, renameTemplateAction, setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/timeline-templates/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimelineTemplateStarterPicker } from "@/components/timeline-templates/timeline-template-starter-picker";
import type { VenueSpace } from "@/lib/availability/types";
import { eventTypeLabel, formatRelative } from "@/lib/leads/constants";
import type { TimelineTemplateWithStats } from "@/lib/timeline-templates/types";

function sortTemplates(templates: TimelineTemplateWithStats[]): TimelineTemplateWithStats[] {
  return [...templates].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1; // archived always last
    return a.name.localeCompare(b.name);
  });
}

function TemplateCard({
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle,
}: {
  template: TimelineTemplateWithStats;
  busy: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchiveToggle: () => void;
}) {
  const router = useRouter();
  const eventType = template.eventType ? eventTypeLabel(template.eventType) : "Any event type";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/library/timeline-templates/${template.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/library/timeline-templates/${template.id}`); }}
      className={`group flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 ${template.isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-heading">{template.name}</p>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} />}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
              {!template.isArchived && !template.isDefault && (
                <DropdownMenuItem onSelect={onSetDefault}>Set as Default</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onArchiveToggle}>{template.isArchived ? "Unarchive" : "Archive"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{eventType}</Badge>
        {template.spaceName && <Badge variant="accent" className="text-[10px]">{template.spaceName}</Badge>}
        {template.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
        {template.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
      </div>

      <p className="mt-auto text-xs text-muted-foreground">
        {template.itemCount} item{template.itemCount !== 1 ? "s" : ""} · Updated {formatRelative(template.updatedAt)}
      </p>
    </div>
  );
}

export function TimelineTemplatesSection({
  initialTemplates, spaces,
}: { initialTemplates: TimelineTemplateWithStats[]; spaces: VenueSpace[] }) {
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const router = useRouter();

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
      toast.success(isArchived ? "Template unarchived." : "Template archived.");
    }
  }

  const sorted = React.useMemo(() => sortTemplates(templates), [templates]);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center space-y-3">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-heading">No timeline templates yet</p>
        <p className="text-xs text-muted-foreground">Reusable day-of schedules a venue builds once and applies to any booking.</p>
        <div className="flex justify-center pt-1"><TimelineTemplateStarterPicker existingTemplates={templates} spaces={spaces} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TimelineTemplateStarterPicker existingTemplates={templates} spaces={spaces} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((t) => (
          <TemplateCard
            key={t.id} template={t} busy={busyId === t.id}
            onRename={() => handleRename(t.id, t.name)}
            onDuplicate={() => handleDuplicate(t.id, t.name)}
            onSetDefault={() => handleSetDefault(t.id, t)}
            onArchiveToggle={() => handleArchiveToggle(t.id, t.isArchived)}
          />
        ))}
      </div>
    </div>
  );
}
