"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderStarterAgainAction,
  createEventOrderTemplateAction, deleteEventOrderTemplateAction,
  duplicateEventOrderTemplateAction, setEventOrderTemplateArchivedAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { partitionArchived } from "@/components/library/partition-archived";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/leads/constants";
import { EVENT_ORDER_STARTER_MASTERS, type EventOrderStarterMasterKey } from "@/lib/event-order-templates/starters";
import type { EventOrderTemplate } from "@/lib/event-order-templates/types";

function NewTemplateSheet() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createEventOrderTemplateAction({ name, description });
      if (result.ok) {
        setOpen(false); setName(""); setDescription(""); setError("");
        toast.success("Template created.");
        router.push(`/library/event-order-templates/${result.templateId}`);
      } else setError(result.errors?.name ?? result.message ?? "Could not create template.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button type="button" onClick={() => setOpen(true)}>+ New Template</Button>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>New Event Order Template</SheetTitle>
          <p className="text-sm text-muted-foreground">A reusable starting point — sections and standard lines you can apply to any event, then customize.</p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding — Ceremony &amp; Reception" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-heading">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleCreate}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StarterMenu({ missingKeys }: { missingKeys: EventOrderStarterMasterKey[] }) {
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
        {EVENT_ORDER_STARTER_MASTERS.filter((m) => missingKeys.includes(m.key)).map((m) => (
          <DropdownMenuItem
            key={m.key}
            onClick={() => startTransition(async () => {
              const r = await addEventOrderStarterAgainAction(m.key);
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

function TemplateCard({ template, archivedView }: { template: EventOrderTemplate; archivedView?: boolean }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleArchiveToggle() {
    setPendingId(template.id);
    const result = await setEventOrderTemplateArchivedAction(template.id, !template.isArchived);
    setPendingId(null);
    if (!result.ok) toast.error(result.message ?? "Could not update template.");
    else toast.success(template.isArchived ? "Template restored." : "Template archived.");
  }

  async function handleDuplicate() {
    setPendingId(template.id);
    const result = await duplicateEventOrderTemplateAction(template.id, `${template.name} (Copy)`);
    setPendingId(null);
    if (result.ok) { toast.success("Template duplicated."); router.push(`/library/event-order-templates/${result.templateId}`); }
    else toast.error(result.message ?? "Could not duplicate template.");
  }

  async function handleDelete() {
    if (!confirm(`Delete "${template.name}"? This can't be undone. Events already created from it are unaffected.`)) return;
    setPendingId(template.id);
    const result = await deleteEventOrderTemplateAction(template.id);
    setPendingId(null);
    if (result.ok) toast.success("Template deleted.");
    else toast.error(result.message ?? "Could not delete template.");
  }

  return (
    <LibraryAssetCard
      layout="row"
      title={template.name}
      description={template.description}
      meta={`Updated ${formatRelative(template.updatedAt)}`}
      href={archivedView ? undefined : `/library/event-order-templates/${template.id}`}
      isStarter={Boolean(template.sourceMasterKey)}
      isArchived={template.isArchived}
      primaryActions={archivedView
        ? [{ id: "restore", label: LIBRARY_LABELS.restore, onClick: handleArchiveToggle, emphasis: "edit" }]
        : [{ id: "edit", label: LIBRARY_LABELS.edit, href: `/library/event-order-templates/${template.id}`, emphasis: "edit" }]}
      overflowPending={pendingId === template.id}
      overflowItems={archivedView ? [] : [
        { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: handleDuplicate, icon: <Copy className="mr-2 h-3.5 w-3.5" /> },
        {
          id: "archive",
          label: archiveToggleLabel(template.isArchived),
          onClick: handleArchiveToggle,
          icon: template.isArchived ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> : <Archive className="mr-2 h-3.5 w-3.5" />,
        },
        {
          id: "delete",
          label: LIBRARY_LABELS.delete,
          onClick: handleDelete,
          destructive: true,
          separatorBefore: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    />
  );
}

export function EventOrderTemplateList({
  templates,
  missingStarterKeys = [],
}: {
  templates: EventOrderTemplate[];
  missingStarterKeys?: EventOrderStarterMasterKey[];
}) {
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Editing a template never changes an Event Order already on a booking, and never shares with the client.
        </p>
        <div className="flex items-center gap-2">
          <StarterMenu missingKeys={missingStarterKeys} />
          <NewTemplateSheet />
        </div>
      </div>
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No Event Order Templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to reuse the same starting point — sections and standard lines — for every event that fits it.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((t) => <TemplateCard key={t.id} template={t} />)}
        </div>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="space-y-2">
          {archived.map((t) => <TemplateCard key={t.id} template={t} archivedView />)}
        </div>
      </LibraryArchivedSection>
    </div>
  );
}
