"use client";

/**
 * The Floor Plan Template Library — card grid with Hello to Cheers starter
 * badge, Restore starters, and a real Floor Plan SVG preview (shape renderer).
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Eye, Loader2, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { addFloorPlanStarterAgainAction } from "@/app/(app)/library/floor-plan-templates/actions";
import {
  duplicateTemplateAction, renameTemplateAction, setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/floor-plan-templates/actions";
import { FloorPlanLayoutPreview } from "@/components/floor-plan/floor-plan-layout-preview";
import { FloorPlanTemplateStarterPicker } from "@/components/floor-plan-templates/floor-plan-template-starter-picker";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { VenueSpace } from "@/lib/availability/types";
import { EVENT_TYPES, eventTypeLabel, formatRelative } from "@/lib/leads/constants";
import {
  FLOOR_PLAN_STARTER_MASTERS,
  getFloorPlanStarterMaster,
  type FloorPlanStarterMasterKey,
} from "@/lib/floor-plan-templates/starters";
import type { FloorPlanTemplateWithStats } from "@/lib/floor-plan-templates/types";

const ANY_EVENT_TYPE = "__any__";

function sortTemplates(templates: FloorPlanTemplateWithStats[]): FloorPlanTemplateWithStats[] {
  return [...templates].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function TemplatePreviewSheet({
  template,
  open,
  onOpenChange,
}: {
  template: FloorPlanTemplateWithStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const master = template?.sourceMasterKey
    ? getFloorPlanStarterMaster(template.sourceMasterKey)
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>{template?.name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>Floor Plan Template</span>
            {template?.sourceMasterKey && <Badge variant="muted">Starter</Badge>}
            {template && (
              <span>
                · {template.objectCount} {template.objectCount === 1 ? "element" : "elements"}
              </span>
            )}
          </div>
        </SheetHeader>
        {template && (
          <div className="px-4 pb-6 space-y-4">
            {(master?.description ?? null) && (
              <p className="text-sm text-muted-foreground">{master?.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Illustrative starting layout — resize the room to your real space on your copy after you open the editor.
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <FloorPlanLayoutPreview
                planName={template.name}
                roomWidthFt={template.roomWidthFt}
                roomDepthFt={template.roomDepthFt}
                backgroundImageUrl={template.backgroundImageUrl}
                backgroundImageOpacity={template.backgroundImageOpacity}
                objects={template.previewObjects}
                maxHeightClassName="max-h-[55vh]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" render={<Link href={`/library/floor-plan-templates/${template.id}`} />}>
                Open editor
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StarterMenu({ missingKeys }: { missingKeys: FloorPlanStarterMasterKey[] }) {
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
        {FLOOR_PLAN_STARTER_MASTERS.filter((m) => missingKeys.includes(m.key)).map((m) => (
          <DropdownMenuItem
            key={m.key}
            onClick={() => startTransition(async () => {
              const r = await addFloorPlanStarterAgainAction(m.key);
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
  template: FloorPlanTemplateWithStats;
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
      className={`group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors ${template.isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-heading">{template.name}</p>
        {!archivedView && (
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label="Template actions" />}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onPreview}><Eye className="mr-2 h-3.5 w-3.5" />Preview</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/library/floor-plan-templates/${template.id}`)}>Edit</DropdownMenuItem>
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

      <div
        className="rounded-lg border border-border/60 overflow-hidden cursor-pointer"
        onClick={onPreview}
      >
        <FloorPlanLayoutPreview
          planName={template.name}
          roomWidthFt={template.roomWidthFt}
          roomDepthFt={template.roomDepthFt}
          backgroundImageUrl={template.backgroundImageUrl}
          backgroundImageOpacity={template.backgroundImageOpacity}
          objects={template.previewObjects}
          className="overflow-hidden bg-[#F7F5F1] p-1"
          maxHeightClassName="max-h-28"
        />
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

      <p className="mt-auto text-xs text-muted-foreground">
        {template.objectCount} item{template.objectCount !== 1 ? "s" : ""} · Updated {formatRelative(template.updatedAt)}
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" variant="ghost" onClick={onPreview}>{LIBRARY_LABELS.preview}</Button>
        {archivedView ? (
          <Button type="button" size="sm" variant="outline" onClick={onArchiveToggle} disabled={busy}>
            {LIBRARY_LABELS.restore}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" render={<Link href={`/library/floor-plan-templates/${template.id}`} />}>
            {LIBRARY_LABELS.edit}
          </Button>
        )}
      </div>
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
  const [previewing, setPreviewing] = React.useState<FloorPlanTemplateWithStats | null>(null);
  const router = useRouter();

  React.useEffect(() => { setTemplates(initialTemplates); }, [initialTemplates]);

  const presentKeys = new Set(
    templates.map((t) => t.sourceMasterKey).filter((k): k is string => Boolean(k)),
  );
  const missingStarterKeys = FLOOR_PLAN_STARTER_MASTERS
    .map((m) => m.key)
    .filter((k) => !presentKeys.has(k));

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
      toast.success(isArchived ? "Template restored." : "Template archived.");
    }
  }

  const sorted = React.useMemo(() => sortTemplates(templates), [templates]);
  const filtered = React.useMemo(() => sorted.filter((t) => {
    if (eventTypeFilter !== ANY_EVENT_TYPE && t.eventType !== eventTypeFilter) return false;
    if (search.trim() && !t.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [sorted, search, eventTypeFilter]);
  const { active: filteredActive, archived: filteredArchived } = React.useMemo(
    () => partitionArchived(filtered, (t) => t.isArchived),
    [filtered],
  );
  const activeTemplates = React.useMemo(() => templates.filter((t) => !t.isArchived), [templates]);

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center space-y-3">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-heading">No floor plan templates yet</p>
        <p className="text-xs text-muted-foreground">Reusable room layouts a venue builds once and applies to any booking.</p>
        <div className="flex justify-center gap-2 pt-1 flex-wrap">
          <StarterMenu missingKeys={missingStarterKeys} />
          <FloorPlanTemplateStarterPicker existingTemplates={activeTemplates} spaces={spaces} venueId={venueId} />
        </div>
      </div>
    );
  }

  function renderCard(t: FloorPlanTemplateWithStats, archivedView: boolean) {
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
        <div className="flex flex-wrap items-center gap-2">
          <StarterMenu missingKeys={missingStarterKeys} />
          <FloorPlanTemplateStarterPicker existingTemplates={activeTemplates} spaces={spaces} venueId={venueId} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Edit reusable layouts here. Applying a floor plan to a booking happens on the event — not as a client send from the Library.
      </p>
      {filteredActive.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {filtered.length === 0 ? "No templates match your search." : "No active floor plan templates match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredActive.map((t) => renderCard(t, false))}
        </div>
      )}
      <LibraryArchivedSection count={filteredArchived.length}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArchived.map((t) => renderCard(t, true))}
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
