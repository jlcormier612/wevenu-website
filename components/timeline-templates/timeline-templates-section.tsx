"use client";

/**
 * The Timeline Template Library — a card grid, one card per template
 * (Timeline Templates, 2026-07-10). Includes Hello to Cheers starter badge,
 * Restore starters, and a real activity preview (titles + day grouping).
 */

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookPlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addTimelineStarterAgainAction } from "@/app/(app)/library/timeline-templates/actions";
import { applyTimelineTemplateAction } from "@/app/(app)/timeline-templates/booking-actions";
import {
  deleteTemplateAction, duplicateTemplateAction, renameTemplateAction, setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/timeline-templates/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
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

export type TimelineEventOption = {
  id: string;
  name: string;
  eventDate: string;
  startTime: string | null;
};

type UseStep = "pick" | "confirm";

function UseTimelineSheet({
  template,
  events,
  open,
  onOpenChange,
}: {
  template: TimelineTemplateWithStats | null;
  events: TimelineEventOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<TimelineEventOption | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) { setStep("pick"); setSelected(null); setQ(""); }
  }, [open]);

  const filtered = events.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()));

  function apply() {
    if (!selected || !template) return;
    startTransition(async () => {
      const result = await applyTimelineTemplateAction(selected.id, template.id, selected.startTime);
      if (result.ok) {
        toast.success("Timeline items added to the event.");
        router.push(`/events/${selected.id}#timeline`);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Could not apply timeline.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.useTimeline}</SheetTitle>
          {step === "pick" ? (
            <p className="text-sm text-muted-foreground">
              Choose an event. This adds &ldquo;{template?.name}&rdquo;&apos;s activities to that
              event&apos;s Timeline — it does not send or notify anyone.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Confirm before adding these activities.</p>
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
              <li>Adds this template&apos;s activities to the event&apos;s Timeline.</li>
              <li>If the Timeline already has items, these are added alongside them.</li>
              <li>Does not send email, SMS, or portal notifications.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("pick")}>Back</Button>
              <Button type="button" disabled={pending} onClick={apply}>
                {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Adding…</> : LIBRARY_LABELS.useTimeline}
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
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle, onDelete, onPreview, onUse, archivedView,
}: {
  template: TimelineTemplateWithStats;
  busy: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onUse: () => void;
  archivedView?: boolean;
}) {
  const eventType = template.eventType ? eventTypeLabel(template.eventType) : "Any event type";

  const primaryActions = archivedView
    ? [
        { id: "preview", label: LIBRARY_LABELS.preview, onClick: onPreview, emphasis: "preview" as const },
        { id: "restore", label: LIBRARY_LABELS.restore, onClick: onArchiveToggle, emphasis: "edit" as const, disabled: busy },
      ]
    : [
        { id: "preview", label: LIBRARY_LABELS.preview, onClick: onPreview, emphasis: "preview" as const },
        { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/timeline-templates/${template.id}`, emphasis: "edit" as const },
        { id: "use", label: LIBRARY_LABELS.useTimeline, onClick: onUse, emphasis: "use" as const },
      ];

  return (
    <LibraryAssetCard
      layout="grid"
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
      meta={`${template.itemCount} item${template.itemCount !== 1 ? "s" : ""} · Updated ${formatRelative(template.updatedAt)}`}
      primaryActions={primaryActions}
      overflowPending={busy}
      overflowItems={archivedView ? [] : [
        { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: onDuplicate },
        { id: "rename", label: "Rename", onClick: onRename },
        ...(!template.isDefault ? [{ id: "default", label: "Set as Default", onClick: onSetDefault }] : []),
        { id: "archive", label: LIBRARY_LABELS.archive, onClick: onArchiveToggle, separatorBefore: true },
        {
          id: "delete", label: LIBRARY_LABELS.delete, onClick: onDelete, destructive: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    >
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
    </LibraryAssetCard>
  );
}

export function TimelineTemplatesSection({
  initialTemplates, spaces, missingStarterKeys = [], events = [],
}: {
  initialTemplates: TimelineTemplateWithStats[];
  spaces: VenueSpace[];
  missingStarterKeys?: TimelineStarterMasterKey[];
  events?: TimelineEventOption[];
}) {
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [previewing, setPreviewing] = React.useState<TimelineTemplateWithStats | null>(null);
  const [using, setUsing] = React.useState<TimelineTemplateWithStats | null>(null);
  const [deleting, setDeleting] = React.useState<TimelineTemplateWithStats | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
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
        onDelete={() => setDeleting(t)}
        onUse={() => setUsing(t)}
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
      <UseTimelineSheet
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
