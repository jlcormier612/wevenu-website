"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addInventoryTemplateStarterAgainAction,
  createInventoryTemplateAction,
  deleteInventoryTemplateAction,
  ensureEventInventoryAction,
  getInventoryTemplateDetailAction,
  setInventoryTemplateArchivedAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryTemplate, InventoryTemplateWithItems } from "@/lib/event-inventory/types";
import { INVENTORY_TEMPLATE_STARTER_MASTERS, type InventoryTemplateStarterKey } from "@/lib/inventory/starters";
import { formatRelative } from "@/lib/leads/constants";

function CreateTemplateSheet() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createInventoryTemplateAction(name, description);
      if (result.ok) { setOpen(false); setName(""); setDescription(""); setError(""); toast.success("Template created."); }
      else setError(result.errors?.name ?? result.message ?? "Could not create template.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>+ New Template</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>New Inventory Template</SheetTitle>
          <p className="text-sm text-muted-foreground">A reusable list of what you typically use for this kind of event.</p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Our Standard Wedding Inventory" autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Description</label>
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

function StarterMenu({ missingKeys }: { missingKeys: InventoryTemplateStarterKey[] }) {
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
        {INVENTORY_TEMPLATE_STARTER_MASTERS.filter((m) => missingKeys.includes(m.key)).map((m) => (
          <DropdownMenuItem
            key={m.key}
            onClick={() => startTransition(async () => {
              const r = await addInventoryTemplateStarterAgainAction(m.key);
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
  const [detail, setDetail] = React.useState<InventoryTemplateWithItems | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !templateId) { setDetail(null); return; }
    setLoading(true);
    getInventoryTemplateDetailAction(templateId).then((d) => { setDetail(d); setLoading(false); });
  }, [open, templateId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>{templateName}</SheetTitle>
          <p className="text-xs text-muted-foreground">Inventory Template</p>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !detail || detail.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <ul className="space-y-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-background p-4">
              {detail.items.map((item) => (
                <li key={item.id} className="text-sm text-foreground">
                  · {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href={`/library/inventory-templates/${templateId}`} />}>
              Open editor
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type UseStep = "pick" | "confirm";

function UseInventoryTemplateSheet({
  template,
  events,
  open,
  onOpenChange,
}: {
  template: InventoryTemplate | null;
  events: { id: string; name: string; eventDate: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<{ id: string; name: string; eventDate: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) { setStep("pick"); setSelected(null); setQ(""); }
  }, [open]);

  const filtered = events.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()));

  function apply() {
    if (!selected || !template) return;
    startTransition(async () => {
      const result = await ensureEventInventoryAction(selected.id, template.id);
      if (result.ok) {
        toast.success("Inventory set up on the event.");
        router.push(`/events/${selected.id}#inventory`);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Could not set up inventory.");
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
              Choose an event. This starts that event&apos;s inventory list from
              &ldquo;{template?.name}&rdquo;.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Confirm before setting up inventory.</p>
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
              <li>Starts this event&apos;s inventory list from this template&apos;s items.</li>
              <li>If this event already has an inventory list, this opens it instead — it never overwrites existing work.</li>
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
  template: InventoryTemplate;
  archivedView?: boolean;
  onPreview: () => void;
  onUse: () => void;
  onDelete: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  function toggleArchive() {
    startTransition(async () => {
      const result = await setInventoryTemplateArchivedAction(template.id, !template.isArchived);
      if (!result.ok) toast.error(result.message ?? "Could not update.");
      else toast.success(template.isArchived ? "Template restored." : "Template archived.");
    });
  }
  return (
    <LibraryAssetCard
      layout="row"
      title={template.name}
      description={template.description}
      meta={`Updated ${formatRelative(template.updatedAt)}`}
      href={archivedView ? undefined : `/library/inventory-templates/${template.id}`}
      isStarter={Boolean(template.sourceMasterKey)}
      isArchived={template.isArchived}
      primaryActions={archivedView
        ? [
            { id: "preview", label: LIBRARY_LABELS.preview, onClick: onPreview, emphasis: "preview" },
            { id: "restore", label: LIBRARY_LABELS.restore, onClick: toggleArchive, emphasis: "edit" },
          ]
        : [
            { id: "preview", label: LIBRARY_LABELS.preview, onClick: onPreview, emphasis: "preview" },
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/inventory-templates/${template.id}`, emphasis: "edit" },
            { id: "use", label: LIBRARY_LABELS.useTemplate, onClick: onUse, emphasis: "use" },
          ]}
      overflowPending={pending}
      overflowItems={archivedView ? [] : [
        {
          id: "archive",
          label: archiveToggleLabel(template.isArchived),
          onClick: toggleArchive,
          icon: template.isArchived
            ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
            : <Archive className="mr-2 h-3.5 w-3.5" />,
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

export function InventoryTemplateList({
  templates,
  missingStarterKeys = [],
  events = [],
}: {
  templates: InventoryTemplate[];
  missingStarterKeys?: InventoryTemplateStarterKey[];
  events?: { id: string; name: string; eventDate: string }[];
}) {
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);
  const [previewing, setPreviewing] = React.useState<InventoryTemplate | null>(null);
  const [using, setUsing] = React.useState<InventoryTemplate | null>(null);
  const [deleting, setDeleting] = React.useState<InventoryTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteInventoryTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Template deleted.");
      setDeleting(null);
    } else {
      toast.error(result.message ?? "Could not delete template.");
    }
  }

  function renderCard(t: InventoryTemplate, archivedView: boolean) {
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
      <div className="flex justify-end gap-2 flex-wrap">
        <StarterMenu missingKeys={missingStarterKeys} />
        <CreateTemplateSheet />
      </div>
      <p className="text-xs text-muted-foreground">
        Templates are reusable packing lists. Applying one to an event happens on the booking — not as a client send from the Library.
      </p>
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No inventory templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to reuse across events, or restore a Hello to Cheers starter.</p>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active inventory templates.</p>
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
        </>
      )}
      <TemplatePreviewSheet
        templateId={previewing?.id ?? null}
        templateName={previewing?.name ?? ""}
        open={!!previewing}
        onOpenChange={(o) => { if (!o) setPreviewing(null); }}
      />
      <UseInventoryTemplateSheet
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
