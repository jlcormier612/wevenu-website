"use client";

/**
 * The Planning Template Library. A real, filterable, sortable card grid —
 * every template shows what it is, what type it is, how big it is, and when
 * it last changed. Each card's action menu is the one place to Edit,
 * Duplicate, Rename, Set as Default, or Archive it (Planning Templates
 * Library Rebuild, 2026-07-10). Archived templates stay visible here (muted,
 * sorted last) so there's a way back via Unarchive — they only disappear
 * from the booking-apply flows, per getTemplates()'s archived-exclusion
 * default.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  duplicateTemplateAction, renameTemplateAction,
  setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/playbooks/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaybookStarterPicker } from "@/components/playbooks/playbook-starter-picker";
import { EVENT_TYPES, eventTypeLabel, formatRelative } from "@/lib/leads/constants";
import { PLAYBOOK_KINDS, playbookKindLabel } from "@/lib/playbooks/constants";
import type { PlaybookTemplateWithStats } from "@/lib/playbooks/types";

const OTHER_EVENT_TYPE = { value: "__other__", label: "Other" };

type EventTypeFilter = "all" | string;
type KindFilter = "all" | "client" | "venue";
type SortKey = "updated" | "name" | "most_used";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated",   label: "Last Updated" },
  { value: "name",      label: "Name (A → Z)" },
  { value: "most_used", label: "Most Used" },
];

function sortTemplates(templates: PlaybookTemplateWithStats[], sort: SortKey): PlaybookTemplateWithStats[] {
  return [...templates].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1; // archived always last
    switch (sort) {
      case "name":      return a.name.localeCompare(b.name);
      case "most_used": return b.usageCount - a.usageCount;
      default:          return b.updatedAt.localeCompare(a.updatedAt); // updated, most-recent-first
    }
  });
}

function TemplateCard({
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle,
}: {
  template: PlaybookTemplateWithStats;
  busy: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchiveToggle: () => void;
}) {
  const router = useRouter();
  const eventType = template.eventType ? eventTypeLabel(template.eventType) : "All event types";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/library/playbooks/${template.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/library/playbooks/${template.id}`); }}
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
              <DropdownMenuItem onClick={() => router.push(`/library/playbooks/${template.id}`)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
              {!template.isArchived && !template.isDefault && (
                <DropdownMenuItem onClick={onSetDefault}>Set as Default</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchiveToggle}>{template.isArchived ? "Unarchive" : "Archive"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{eventType}</Badge>
        <Badge variant="accent" className="text-[10px]">{playbookKindLabel(template.kind)}</Badge>
        {template.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
        {template.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
      </div>

      <p className="mt-auto text-xs text-muted-foreground">
        {template.taskCount} task{template.taskCount !== 1 ? "s" : ""} · Updated {formatRelative(template.updatedAt)}
      </p>
    </div>
  );
}

export function PlaybooksSection({ initialTemplates }: { initialTemplates: PlaybookTemplateWithStats[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = React.useState<EventTypeFilter>("all");
  const [kindFilter, setKindFilter] = React.useState<KindFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("updated");

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
      router.push(`/library/playbooks/${(result as { templateId?: string }).templateId}`);
    }
  }

  async function handleRename(id: string, currentName: string) {
    const name = window.prompt("Rename template", currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    const result = await withBusy(id, () => renameTemplateAction(id, name.trim()));
    if (result.ok) setTemplates((p) => p.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)));
  }

  async function handleSetDefault(id: string, template: PlaybookTemplateWithStats) {
    const result = await withBusy(id, () => setTemplateDefaultAction(id));
    if (result.ok) {
      setTemplates((p) => p.map((t) => {
        if (t.id === id) return { ...t, isDefault: true };
        if (t.kind === template.kind && t.eventType === template.eventType) return { ...t, isDefault: false };
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

  const filtered = React.useMemo(() => {
    const base = templates.filter((t) => {
      if (eventTypeFilter !== "all") {
        const group = t.eventType ?? OTHER_EVENT_TYPE.value;
        if (group !== eventTypeFilter) return false;
      }
      if (kindFilter !== "all" && t.kind !== kindFilter) return false;
      return true;
    });
    return sortTemplates(base, sort);
  }, [templates, eventTypeFilter, kindFilter, sort]);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center space-y-3">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-heading">No planning templates yet</p>
        <p className="text-xs text-muted-foreground">Client Planning and Venue Planning are two separate checklists — start with whichever you need first.</p>
        <div className="flex justify-center gap-2 pt-1">
          <PlaybookStarterPicker existingTemplates={templates} />
          <PlaybookStarterPicker existingTemplates={templates} variant="import" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={eventTypeFilter} onValueChange={(v) => setEventTypeFilter(v as EventTypeFilter)} items={[{ value: "all", label: "All Event Types" }, ...EVENT_TYPES, OTHER_EVENT_TYPE]}>
            <SelectTrigger className="h-9 w-44 text-sm border-border">
              <SelectValue placeholder="All Event Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Event Types</SelectItem>
              {EVENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              <SelectItem value={OTHER_EVENT_TYPE.value}>Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)} items={[{ value: "all", label: "All Template Types" }, ...PLAYBOOK_KINDS]}>
            <SelectTrigger className="h-9 w-48 text-sm border-border">
              <SelectValue placeholder="All Template Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Template Types</SelectItem>
              {PLAYBOOK_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)} items={SORT_OPTIONS}>
          <SelectTrigger className="h-9 w-44 text-sm border-border">
            <SelectValue placeholder="Last Updated" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No templates match these filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id} template={t} busy={busyId === t.id}
              onRename={() => handleRename(t.id, t.name)}
              onDuplicate={() => handleDuplicate(t.id, t.name)}
              onSetDefault={() => handleSetDefault(t.id, t)}
              onArchiveToggle={() => handleArchiveToggle(t.id, t.isArchived)}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <PlaybookStarterPicker existingTemplates={templates} compact />
        <PlaybookStarterPicker existingTemplates={templates} compact variant="import" />
      </div>
    </div>
  );
}
