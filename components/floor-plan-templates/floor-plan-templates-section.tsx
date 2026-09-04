"use client";

/**
 * The Floor Plan Template Library — card grid with Hello to Cheers starter
 * badge, Restore starters, and a real Floor Plan SVG preview (shape renderer).
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addFloorPlanStarterAgainAction } from "@/app/(app)/library/floor-plan-templates/actions";
import { applyTemplateAction } from "@/app/(app)/events/[id]/floor-plan-actions";
import {
  deleteTemplateAction, duplicateTemplateAction, renameTemplateAction, setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/floor-plan-templates/actions";
import { FloorPlanLayoutPreview } from "@/components/floor-plan/floor-plan-layout-preview";
import { FloorPlanTemplateStarterPicker } from "@/components/floor-plan-templates/floor-plan-template-starter-picker";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
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


export type FloorPlanEventOption = {
  id: string;
  name: string;
  eventDate: string;
};

type UseStep = "pick" | "confirm";

function UseFloorPlanSheet({
  template,
  events,
  open,
  onOpenChange,
}: {
  template: FloorPlanTemplateWithStats | null;
  events: FloorPlanEventOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<FloorPlanEventOption | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) { setStep("pick"); setSelected(null); setQ(""); }
  }, [open]);

  const filtered = events.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()));

  function apply() {
    if (!selected || !template) return;
    startTransition(async () => {
      const result = await applyTemplateAction(selected.id, template.id, template.name, template.spaceId ?? null);
      if (result.ok) {
        toast.success("Floor plan created on the event.");
        router.push(`/events/${selected.id}/floor-plans/${result.floorPlanId}`);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Could not create floor plan.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.useFloorPlan}</SheetTitle>
          {step === "pick" ? (
            <p className="text-sm text-muted-foreground">
              Choose an event. This creates a new floor plan on that event from
              &ldquo;{template?.name}&rdquo; — your original template is untouched.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Confirm before creating the floor plan.</p>
          )}
        </SheetHeader>

        {step === "pick" ? (
          <>
            <Input placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No events found.</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => { setSelected(ev); setStep("confirm"); }}
                      className="w-full rounded-md border border-border px-3 py-2.5 text-left hover:bg-muted/40 disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-heading">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">{ev.eventDate}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : selected && template && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Template</span> · {template.name}</p>
              <p><span className="text-muted-foreground">Event</span> · {selected.name}</p>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Creates a new floor plan on the event, starting from this layout.</li>
              <li>Your reusable template is never changed by editing the new copy.</li>
              <li>Does not send email, SMS, or portal notifications.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("pick")}>Back</Button>
              <Button type="button" disabled={pending} onClick={apply}>
                {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : LIBRARY_LABELS.useFloorPlan}
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
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle, onDelete, onUse, archivedView,
  canEdit = true, canDelete = true,
}: {
  template: FloorPlanTemplateWithStats;
  busy: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onUse: () => void;
  archivedView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const eventType = template.eventType ? eventTypeLabel(template.eventType) : "Any event type";
  const previewHref = `/library/floor-plan-templates/${template.id}/preview`;

  const primaryActions = archivedView
    ? [
        { id: "preview", label: LIBRARY_LABELS.preview, href: previewHref, emphasis: "preview" as const },
        ...(canEdit
          ? [{ id: "restore", label: LIBRARY_LABELS.restore, onClick: onArchiveToggle, emphasis: "edit" as const, disabled: busy }]
          : []),
      ]
    : [
        { id: "preview", label: LIBRARY_LABELS.preview, href: previewHref, emphasis: "preview" as const },
        ...(canEdit
          ? [{ id: "edit", label: LIBRARY_LABELS.edit, href: `/library/floor-plan-templates/${template.id}`, emphasis: "edit" as const }]
          : []),
        { id: "use", label: LIBRARY_LABELS.useFloorPlan, onClick: onUse, emphasis: "use" as const },
      ];

  const overflowItems = archivedView
    ? []
    : [
        ...(canEdit
          ? [
              { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: onDuplicate },
              { id: "rename", label: "Rename", onClick: onRename },
              ...(!template.isDefault ? [{ id: "default", label: "Set as Default", onClick: onSetDefault }] : []),
              { id: "archive", label: LIBRARY_LABELS.archive, onClick: onArchiveToggle, separatorBefore: true },
            ]
          : []),
        ...(canDelete
          ? [{
              id: "delete", label: LIBRARY_LABELS.delete, onClick: onDelete, destructive: true,
              icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
            }]
          : []),
      ];

  return (
    <LibraryAssetCard
      layout="row"
      title={template.name}
      isStarter={Boolean(template.sourceMasterKey)}
      isArchived={template.isArchived}
      badges={
        <>
          <Badge variant="outline" className="text-[10px]">{eventType}</Badge>
          {template.spaceName && <Badge variant="accent" className="text-[10px]">{template.spaceName}</Badge>}
          {template.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
        </>
      }
      meta={`${template.objectCount} item${template.objectCount !== 1 ? "s" : ""} · Updated ${formatRelative(template.updatedAt)}`}
      primaryActions={primaryActions}
      overflowPending={busy}
      overflowItems={overflowItems}
    >
      <Link
        href={previewHref}
        className="block rounded-lg border border-border/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
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
      </Link>
    </LibraryAssetCard>
  );
}

export function FloorPlanTemplatesSection({
  initialTemplates, spaces, venueId, events = [],
  canEdit = true, canDelete = true,
}: {
  initialTemplates: FloorPlanTemplateWithStats[];
  spaces: VenueSpace[];
  venueId: string;
  events?: FloorPlanEventOption[];
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [eventTypeFilter, setEventTypeFilter] = React.useState(ANY_EVENT_TYPE);
  const [using, setUsing] = React.useState<FloorPlanTemplateWithStats | null>(null);
  const [deleting, setDeleting] = React.useState<FloorPlanTemplateWithStats | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
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

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Template deleted.");
      setTemplates((p) => p.filter((t) => t.id !== deleting.id));
      setDeleting(null);
    } else {
      toast.error(result.message ?? "Could not delete template.");
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
        {canEdit && (
          <div className="flex justify-center gap-2 pt-1 flex-wrap">
            <StarterMenu missingKeys={missingStarterKeys} />
            <FloorPlanTemplateStarterPicker existingTemplates={activeTemplates} spaces={spaces} venueId={venueId} />
          </div>
        )}
      </div>
    );
  }

  function renderCard(t: FloorPlanTemplateWithStats, archivedView: boolean) {
    return (
      <TemplateCard
        key={t.id} template={t} busy={busyId === t.id} archivedView={archivedView}
        canEdit={canEdit}
        canDelete={canDelete}
        onRename={() => handleRename(t.id, t.name)}
        onDuplicate={() => handleDuplicate(t.id, t.name)}
        onSetDefault={() => handleSetDefault(t.id, t)}
        onArchiveToggle={() => handleArchiveToggle(t.id, t.isArchived)}
        onDelete={() => setDeleting(t)}
        onUse={() => setUsing(t)}
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
          {canEdit && (
            <>
              <StarterMenu missingKeys={missingStarterKeys} />
              <FloorPlanTemplateStarterPicker existingTemplates={activeTemplates} spaces={spaces} venueId={venueId} />
            </>
          )}
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
        <div className="space-y-2">
          {filteredActive.map((t) => renderCard(t, false))}
        </div>
      )}
      <LibraryArchivedSection count={filteredArchived.length}>
        <div className="space-y-2">
          {filteredArchived.map((t) => renderCard(t, true))}
        </div>
      </LibraryArchivedSection>
      <UseFloorPlanSheet
        template={using}
        events={events}
        open={!!using}
        onOpenChange={(o) => { if (!o) setUsing(null); }}
      />
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="template"
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
