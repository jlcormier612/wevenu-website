"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addInventoryTemplateStarterAgainAction,
  createInventoryTemplateAction,
  deleteInventoryTemplateAction,
  duplicateInventoryTemplateAction,
  ensureEventInventoryAction,
  getInventoryTemplateDetailAction,
  sendInventoryTemplateAction,
  setInventoryTemplateArchivedAction,
} from "@/app/(app)/events/[id]/event-inventory-actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { IncompleteTemplateWarningDialog } from "@/components/library/incomplete-template-warning-dialog";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import {
  TemplateApplyTargetPicker,
  type TemplateApplyClientGroup,
  type TemplateApplyEventTarget,
} from "@/components/library/template-apply-target-picker";
import { partitionArchived } from "@/components/library/partition-archived";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { InventoryTemplate } from "@/lib/event-inventory/types";
import { isInventoryTemplateUnfinished } from "@/lib/library/template-readiness";
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


type UseStep = "pick" | "confirm";

function UseOrSendInventoryTemplateSheet({
  template,
  clientGroups,
  open,
  onOpenChange,
  mode,
}: {
  template: InventoryTemplate | null;
  clientGroups: TemplateApplyClientGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "use" | "send";
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<TemplateApplyEventTarget | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [itemCount, setItemCount] = React.useState<number | null>(null);
  const [warnOpen, setWarnOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSelected(null);
      setItemCount(null);
      setWarnOpen(false);
    }
  }, [open]);

  function pickEvent(ev: TemplateApplyEventTarget) {
    if (!template) return;
    setSelected(ev);
    setStep("confirm");
    startTransition(async () => {
      const detail = await getInventoryTemplateDetailAction(template.id);
      setItemCount(detail?.items.length ?? 0);
    });
  }

  function requestApply() {
    if (!selected || !template || itemCount == null) return;
    if (isInventoryTemplateUnfinished(itemCount)) {
      setWarnOpen(true);
      return;
    }
    runApply();
  }

  function runApply() {
    if (!selected || !template) return;
    setWarnOpen(false);
    startTransition(async () => {
      if (mode === "send") {
        const result = await sendInventoryTemplateAction(selected.id, template.id);
        if (result.ok) {
          toast.success("Inventory set up and shared with the client.");
          router.push(`/events/${selected.id}#inventory`);
          onOpenChange(false);
        } else {
          toast.error(result.message ?? "Could not send inventory.");
        }
        return;
      }
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

  const title = mode === "send" ? LIBRARY_LABELS.sendToClient : "Use Template";
  const confirmCta = mode === "send"
    ? (pending ? "Sending…" : "Send to client")
    : (pending ? "Setting up…" : "Use Template");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{title}</SheetTitle>
          {step === "pick" ? (
            <p className="text-sm text-muted-foreground">
              {mode === "send"
                ? <>Choose a client event to apply &ldquo;{template?.name}&rdquo; and share for client review.</>
                : <>Choose a client. This starts that booking&apos;s inventory list from &ldquo;{template?.name}&rdquo;.</>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === "send"
                ? "Applies the template (if needed) and shares the event inventory for client portal review — not an invoice."
                : "Confirm before setting up inventory."}
            </p>
          )}
        </SheetHeader>

        {step === "pick" ? (
          <TemplateApplyTargetPicker
            groups={clientGroups}
            disabled={pending}
            onSelectEvent={pickEvent}
          />
        ) : selected && template && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Template</span> · {template.name}</p>
              <p><span className="text-muted-foreground">Client</span> · {selected.clientDisplayName}</p>
              <p><span className="text-muted-foreground">Event</span> · {selected.name} · {selected.eventDate}</p>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Starts this event&apos;s inventory list from this template&apos;s items.</li>
              <li>If this event already has an inventory list, this opens it instead — it never overwrites existing work.</li>
              {mode === "send" ? (
                <li>Shares the list to the client portal for review (read-only). Billable items still use Event Order / Invoice.</li>
              ) : (
                <li>Does not send email, SMS, or portal notifications.</li>
              )}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("pick")}>Back</Button>
              <Button type="button" disabled={pending || itemCount == null} onClick={requestApply}>
                {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{confirmCta}</> : confirmCta}
              </Button>
            </div>
          </div>
        )}
        <IncompleteTemplateWarningDialog
          open={warnOpen}
          pending={pending}
          onGoBack={() => setWarnOpen(false)}
          onApplyAnyway={runApply}
        />
      </SheetContent>
    </Sheet>
  );
}

function TemplateCard({
  template, archivedView, onUse, onSend, onDelete, onDuplicate,
}: {
  template: InventoryTemplate;
  archivedView?: boolean;
  onUse: () => void;
  onSend: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
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
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/inventory-templates/${template.id}/preview`, emphasis: "preview" },
            { id: "restore", label: LIBRARY_LABELS.restore, onClick: toggleArchive, emphasis: "edit" },
          ]
        : [
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/inventory-templates/${template.id}/preview`, emphasis: "preview" },
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/inventory-templates/${template.id}`, emphasis: "edit" },
            { id: "use", label: LIBRARY_LABELS.useTemplate, onClick: onUse, emphasis: "use" },
            { id: "send", label: LIBRARY_LABELS.sendToClient, onClick: onSend, emphasis: "use" },
          ]}
      overflowPending={pending}
      overflowItems={archivedView ? [] : [
        {
          id: "duplicate",
          label: LIBRARY_LABELS.duplicate,
          onClick: onDuplicate,
          icon: <Copy className="mr-2 h-3.5 w-3.5" />,
        },
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
  clientGroups = [],
}: {
  templates: InventoryTemplate[];
  missingStarterKeys?: InventoryTemplateStarterKey[];
  clientGroups?: TemplateApplyClientGroup[];
}) {
  const router = useRouter();
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);
  const [using, setUsing] = React.useState<InventoryTemplate | null>(null);
  const [sending, setSending] = React.useState<InventoryTemplate | null>(null);
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
        onUse={() => setUsing(t)}
        onSend={() => setSending(t)}
        onDelete={() => setDeleting(t)}
        onDuplicate={() => {
          void (async () => {
            const result = await duplicateInventoryTemplateAction(t.id, `${t.name} (Copy)`);
            if (result.ok) {
              toast.success("Template duplicated.");
              router.push(`/library/inventory-templates/${result.templateId}`);
            } else {
              toast.error(result.message ?? result.errors?.name ?? "Could not duplicate.");
            }
          })();
        }}
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
        Reusable packing lists. Use applies on the venue side; Send applies and shares for client portal review.
        Billable inventory still uses Event Order / Invoice — not a parallel payment stack.
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
      <UseOrSendInventoryTemplateSheet
        mode="use"
        template={using}
        clientGroups={clientGroups}
        open={!!using}
        onOpenChange={(o) => { if (!o) setUsing(null); }}
      />
      <UseOrSendInventoryTemplateSheet
        mode="send"
        template={sending}
        clientGroups={clientGroups}
        open={!!sending}
        onOpenChange={(o) => { if (!o) setSending(null); }}
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
