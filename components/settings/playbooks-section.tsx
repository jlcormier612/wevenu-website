"use client";

/**
 * The Planning Template Library. A real, filterable, sortable card grid —
 * every template shows what it is, what type it is, how big it is, and when
 * it last changed. Each card's action menu is the one place to Edit,
 * Duplicate, Rename, Set as Default, or Archive it (Planning Templates
 * Library Rebuild, 2026-07-10). Archived templates live in a separate
 * Archived section (Preview/Restore). They remain excluded from booking-
 * apply flows via getTemplates()'s default.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTemplateAction, duplicateTemplateAction, renameTemplateAction,
  setTemplateArchivedAction, setTemplateDefaultAction,
} from "@/app/(app)/playbooks/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlaybookApplyPreviewSheet } from "@/components/playbooks/playbook-apply-preview-sheet";
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

export type PlaybookEventOption = { id: string; name: string; eventDate: string };

type UseStep = "pick" | "apply";

function UsePlaybookFlow({
  template,
  events,
  open,
  onOpenChange,
}: {
  template: PlaybookTemplateWithStats | null;
  events: PlaybookEventOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = React.useState("");
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<PlaybookEventOption | null>(null);

  React.useEffect(() => {
    if (open) { setStep("pick"); setSelected(null); setQ(""); }
  }, [open]);

  const filtered = events.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()));

  if (step === "apply" && selected && template) {
    return (
      <PlaybookApplyPreviewSheet
        open={open}
        onOpenChange={onOpenChange}
        templateId={template.id}
        kind={template.kind}
        eventId={selected.id}
        eventDate={selected.eventDate}
        canApply
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.useTemplate}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Choose an event. You&apos;ll see what&apos;s included before applying &ldquo;{template?.name}&rdquo;.
          </p>
        </SheetHeader>
        <Input placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" />
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No events found.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => { setSelected(ev); setStep("apply"); }}
                  className="w-full rounded-md border border-border px-3 py-2.5 text-left hover:bg-muted/40"
                >
                  <p className="text-sm font-medium text-heading">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">{ev.eventDate}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TemplateCard({
  template, busy, onRename, onDuplicate, onSetDefault, onArchiveToggle, onDelete, onUse, archivedView,
}: {
  template: PlaybookTemplateWithStats;
  busy: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onUse: () => void;
  archivedView?: boolean;
}) {
  const eventType = template.eventType ? eventTypeLabel(template.eventType) : "All event types";

  const primaryActions = archivedView
    ? [
        { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/playbooks/${template.id}/preview`, emphasis: "preview" as const },
        { id: "restore", label: LIBRARY_LABELS.restore, onClick: onArchiveToggle, emphasis: "edit" as const, disabled: busy },
      ]
    : [
        { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/playbooks/${template.id}/preview`, emphasis: "preview" as const },
        { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/playbooks/${template.id}`, emphasis: "edit" as const },
        { id: "use", label: LIBRARY_LABELS.useTemplate, onClick: onUse, emphasis: "use" as const },
      ];

  return (
    <LibraryAssetCard
      layout="row"
      title={template.name}
      isArchived={template.isArchived}
      badges={
        <>
          <Badge variant="outline" className="text-[10px]">{eventType}</Badge>
          <Badge variant="accent" className="text-[10px]">{playbookKindLabel(template.kind)}</Badge>
          {template.isDefault && <Badge variant="muted" className="text-[10px]">Default</Badge>}
        </>
      }
      meta={`${template.taskCount} task${template.taskCount !== 1 ? "s" : ""} · Updated ${formatRelative(template.updatedAt)}`}
      primaryActions={primaryActions}
      overflowPending={busy}
      overflowItems={archivedView ? [] : [
        { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: onDuplicate },
        { id: "rename", label: "Rename", onClick: onRename },
        ...(!template.isDefault ? [{ id: "default", label: "Set as Default", onClick: onSetDefault }] : []),
        { id: "archive", label: archiveToggleLabel(template.isArchived), onClick: onArchiveToggle, separatorBefore: true },
        {
          id: "delete", label: LIBRARY_LABELS.delete, onClick: onDelete, destructive: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    />
  );
}

export function PlaybooksSection({
  initialTemplates, events = [],
}: { initialTemplates: PlaybookTemplateWithStats[]; events?: PlaybookEventOption[] }) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = React.useState<EventTypeFilter>("all");
  const [kindFilter, setKindFilter] = React.useState<KindFilter>("all");
  const [sort, setSort] = React.useState<SortKey>("updated");
  const [using, setUsing] = React.useState<PlaybookTemplateWithStats | null>(null);
  const [deleting, setDeleting] = React.useState<PlaybookTemplateWithStats | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function withBusy(id: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusyId(id);
    const result = await fn();
    setBusyId(null);
    if (!result.ok) toast.error(result.message ?? "Something went wrong.");
    return result;
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
      toast.success(isArchived ? "Template restored." : "Template archived.");
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

      {(() => {
        const { active, archived } = partitionArchived(filtered, (t) => t.isArchived);
        return (
          <>
            {active.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active templates match these filters.</p>
            ) : (
              <div className="space-y-2">
                {active.map((t) => (
                  <TemplateCard
                    key={t.id} template={t} busy={busyId === t.id}
                    onRename={() => handleRename(t.id, t.name)}
                    onDuplicate={() => handleDuplicate(t.id, t.name)}
                    onSetDefault={() => handleSetDefault(t.id, t)}
                    onArchiveToggle={() => handleArchiveToggle(t.id, t.isArchived)}
                    onDelete={() => setDeleting(t)}
                    onUse={() => setUsing(t)}
                  />
                ))}
              </div>
            )}
            <LibraryArchivedSection count={archived.length}>
              <div className="space-y-2">
                {archived.map((t) => (
                  <TemplateCard
                    key={t.id} template={t} busy={busyId === t.id} archivedView
                    onRename={() => handleRename(t.id, t.name)}
                    onDuplicate={() => handleDuplicate(t.id, t.name)}
                    onSetDefault={() => handleSetDefault(t.id, t)}
                    onArchiveToggle={() => handleArchiveToggle(t.id, t.isArchived)}
                    onDelete={() => setDeleting(t)}
                    onUse={() => setUsing(t)}
                  />
                ))}
              </div>
            </LibraryArchivedSection>
          </>
        );
      })()}

      <div className="flex gap-2 pt-2 border-t border-border/60">
        <PlaybookStarterPicker existingTemplates={templates.filter((t) => !t.isArchived)} compact />
        <PlaybookStarterPicker existingTemplates={templates.filter((t) => !t.isArchived)} compact variant="import" />
      </div>

      <UsePlaybookFlow
        template={using}
        events={events}
        open={!!using}
        onOpenChange={(o) => { if (!o) setUsing(null); }}
      />
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="template"
        consequenceNote="Checklists already applied to events are unaffected."
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
