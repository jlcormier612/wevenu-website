"use client";

/**
 * The Floor Plan Template Library — a card grid, one card per template
 * (Floor Plan Template Library task). Mirrors the Timeline Template
 * Library's card shape. Archived templates stay visible here (muted,
 * sorted last) so there's a way back via Unarchive — they only disappear
 * from the (not-yet-built) booking-apply flow, per getTemplates()'s
 * archived-exclusion default.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  duplicateTemplateAction, renameTemplateAction, setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/floor-plan-templates/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloorPlanTemplateStarterPicker } from "@/components/floor-plan-templates/floor-plan-template-starter-picker";
import type { VenueSpace } from "@/lib/availability/types";
import { EVENT_TYPES, eventTypeLabel, formatRelative } from "@/lib/leads/constants";
import type { FloorPlanTemplateWithStats } from "@/lib/floor-plan-templates/types";

const ANY_EVENT_TYPE = "__any__";

function sortTemplates(templates: FloorPlanTemplateWithStats[]): FloorPlanTemplateWithStats[] {
  return [...templates].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1; // archived always last
    return a.name.localeCompare(b.name);
  });
}

function TemplateCard({
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle,
}: {
  template: FloorPlanTemplateWithStats;
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
      onClick={() => router.push(`/library/floor-plan-templates/${template.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/library/floor-plan-templates/${template.id}`); }}
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

      {template.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={template.backgroundImageUrl} alt="" className="h-24 w-full rounded-lg border border-border/60 object-cover" />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">{eventType}</Badge>
        {template.spaceName && <Badge variant="accent" className="text-[10px]">{template.spaceName}</Badge>}
        {template.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
        {template.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
      </div>

      <p className="mt-auto text-xs text-muted-foreground">
        {template.objectCount} item{template.objectCount !== 1 ? "s" : ""} · Updated {formatRelative(template.updatedAt)}
      </p>
    </div>
  );
}

export function FloorPlanTemplatesSection({
  initialTemplates, spaces, venueId,
}: { initialTemplates: FloorPlanTemplateWithStats[]; spaces: VenueSpace[]; venueId: string }) {
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState(ANY_EVENT_TYPE);
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
      router.push(`/library/floor-plan-templates/${(result as { templateId?: string }).templateId}`);
    }
  }

  async function handleRename(id: string, currentName: string) {
    const name = window.prompt("Rename template", currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    const result = await withBusy(id, () => renameTemplateAction(id, name.trim()));
    if (result.ok) setTemplates((p) => p.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)));
  }

  async function handleSetDefault(id: string, template: FloorPlanTemplateWithStats) {
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
  const filtered = React.useMemo(() => sorted.filter((t) => {
    if (eventTypeFilter !== ANY_EVENT_TYPE && t.eventType !== eventTypeFilter) return false;
    if (search.trim() && !t.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [sorted, search, eventTypeFilter]);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center space-y-3">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-heading">No floor plan templates yet</p>
        <p className="text-xs text-muted-foreground">Reusable room layouts a venue builds once and applies to any booking.</p>
        <div className="flex justify-center pt-1"><FloorPlanTemplateStarterPicker existingTemplates={templates} spaces={spaces} venueId={venueId} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name…"
            className="h-9 w-56 text-sm"
          />
          <Select
            value={eventTypeFilter}
            onValueChange={setEventTypeFilter}
            items={[{ value: ANY_EVENT_TYPE, label: "All event types" }, ...EVENT_TYPES]}
          >
            <SelectTrigger className="h-9 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_EVENT_TYPE}>All event types</SelectItem>
              {EVENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <FloorPlanTemplateStarterPicker existingTemplates={templates} spaces={spaces} venueId={venueId} />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No templates match your search.</p>
        </div>
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
    </div>
  );
}
