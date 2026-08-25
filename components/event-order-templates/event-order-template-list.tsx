"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderStarterAgainAction,
  createEventOrderTemplateAction, deleteEventOrderTemplateAction,
  duplicateEventOrderTemplateAction, getEventOrderTemplateDetailAction, setEventOrderTemplateArchivedAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { ensureEventOrderAction } from "@/app/(app)/events/[id]/event-order-actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
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
import type { EventOrderTemplate, EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

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

export type EventOrderEventOption = { id: string; name: string; eventDate: string };

function TemplatePreviewSheet({
  templateId,
  templateName,
  open,
  onOpenChange,
}: {
  templateId: string | null;
  templateName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<EventOrderTemplateWithDetails | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !templateId) { setDetail(null); return; }
    setLoading(true);
    getEventOrderTemplateDetailAction(templateId).then((d) => { setDetail(d); setLoading(false); });
  }, [open, templateId]);

  const sections = detail ? [...detail.sections].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const unsectioned = detail ? detail.lines.filter((l) => !l.sectionId).sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>{templateName}</SheetTitle>
          <p className="text-xs text-muted-foreground">Event Order Template</p>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !detail || (sections.length === 0 && unsectioned.length === 0) ? (
            <p className="text-sm text-muted-foreground">No sections or lines yet.</p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-4">
              {sections.map((s) => {
                const lines = detail.lines.filter((l) => l.sectionId === s.id).sort((a, b) => a.sortOrder - b.sortOrder);
                return (
                  <div key={s.id} className="space-y-1.5">
                    <p className="text-xs font-medium text-heading">{s.name}</p>
                    <ul className="space-y-1">
                      {lines.map((l) => (
                        <li key={l.id} className="text-sm text-foreground">· {l.description}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {unsectioned.length > 0 && (
                <ul className="space-y-1">
                  {unsectioned.map((l) => (
                    <li key={l.id} className="text-sm text-foreground">· {l.description}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href={`/library/event-order-templates/${templateId}`} />}>
              Open editor
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type UseStep = "pick" | "confirm";

function UseEventOrderSheet({
  template,
  events,
  open,
  onOpenChange,
}: {
  template: EventOrderTemplate | null;
  events: EventOrderEventOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<EventOrderEventOption | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) { setStep("pick"); setSelected(null); setQ(""); }
  }, [open]);

  const filtered = events.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()));

  function apply() {
    if (!selected || !template) return;
    startTransition(async () => {
      const result = await ensureEventOrderAction(selected.id, template.id);
      if (result.ok) {
        toast.success("Event Order set up on the event.");
        router.push(`/events/${selected.id}#event-order`);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Could not set up the Event Order.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Use Template</SheetTitle>
          {step === "pick" ? (
            <p className="text-sm text-muted-foreground">
              Choose an event. This starts that event&apos;s Event Order from
              &ldquo;{template?.name}&rdquo;.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Confirm before setting up the Event Order.</p>
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
              <li>Starts this event&apos;s Event Order from this template&apos;s sections and lines.</li>
              <li>If this event already has an Event Order, this opens it instead — it never overwrites existing work.</li>
              <li>Does not send email, SMS, or portal notifications.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("pick")}>Back</Button>
              <Button type="button" disabled={pending} onClick={apply}>
                {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Setting up…</> : "Use Template"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TemplateCard({
  template, archivedView, onPreview, onUse, onDelete,
}: {
  template: EventOrderTemplate;
  archivedView?: boolean;
  onPreview: () => void;
  onUse: () => void;
  onDelete: () => void;
}) {
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
        ? [
            { id: "preview", label: LIBRARY_LABELS.preview, onClick: onPreview, emphasis: "preview" },
            { id: "restore", label: LIBRARY_LABELS.restore, onClick: handleArchiveToggle, emphasis: "edit" },
          ]
        : [
            { id: "preview", label: LIBRARY_LABELS.preview, onClick: onPreview, emphasis: "preview" },
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/event-order-templates/${template.id}`, emphasis: "edit" },
            { id: "use", label: LIBRARY_LABELS.useTemplate, onClick: onUse, emphasis: "use" },
          ]}
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
          onClick: onDelete,
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
  events = [],
}: {
  templates: EventOrderTemplate[];
  missingStarterKeys?: EventOrderStarterMasterKey[];
  events?: EventOrderEventOption[];
}) {
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);
  const [previewing, setPreviewing] = React.useState<EventOrderTemplate | null>(null);
  const [using, setUsing] = React.useState<EventOrderTemplate | null>(null);
  const [deleting, setDeleting] = React.useState<EventOrderTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteEventOrderTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Template deleted.");
      setDeleting(null);
    } else {
      toast.error(result.message ?? "Could not delete template.");
    }
  }

  function renderCard(t: EventOrderTemplate, archivedView: boolean) {
    return (
      <TemplateCard
        key={t.id} template={t} archivedView={archivedView}
        onPreview={() => setPreviewing(t)}
        onUse={() => setUsing(t)}
        onDelete={() => setDeleting(t)}
      />
    );
  }

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
          {active.map((t) => renderCard(t, false))}
        </div>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="space-y-2">
          {archived.map((t) => renderCard(t, true))}
        </div>
      </LibraryArchivedSection>
      <TemplatePreviewSheet
        templateId={previewing?.id ?? null}
        templateName={previewing?.name ?? ""}
        open={!!previewing}
        onOpenChange={(o) => { if (!o) setPreviewing(null); }}
      />
      <UseEventOrderSheet
        template={using}
        events={events}
        open={!!using}
        onOpenChange={(o) => { if (!o) setUsing(null); }}
      />
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="template"
        consequenceNote="Events already created from it are unaffected."
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
