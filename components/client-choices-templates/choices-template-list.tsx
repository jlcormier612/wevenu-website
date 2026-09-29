"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createClientChoicesFromTemplateAction } from "@/app/(app)/events/[id]/client-choices-actions";
import {
  createChoicesTemplateAction,
  deleteChoicesTemplateAction,
  duplicateChoicesTemplateAction,
  getChoicesTemplateDetailAction,
  setChoicesTemplateArchivedAction,
} from "@/app/(app)/library/choices-templates/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ChoicesTemplate } from "@/lib/client-choices-templates/types";
import { isChoicesTemplateUnfinished } from "@/lib/library/template-readiness";
import { formatRelative } from "@/lib/leads/constants";

export type ChoicesEventOption = { id: string; name: string; eventDate: string };

type UseStep = "pick" | "confirm";

function UseChoicesTemplateSheet({
  template,
  clientGroups,
  open,
  onOpenChange,
}: {
  template: ChoicesTemplate | null;
  clientGroups: TemplateApplyClientGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<TemplateApplyEventTarget | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [readiness, setReadiness] = React.useState<{ groups: number; options: number } | null>(null);
  const [warnOpen, setWarnOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSelected(null);
      setReadiness(null);
      setWarnOpen(false);
    }
  }, [open]);

  function pickEvent(ev: TemplateApplyEventTarget) {
    if (!template) return;
    setSelected(ev);
    setStep("confirm");
    startTransition(async () => {
      const detail = await getChoicesTemplateDetailAction(template.id);
      setReadiness({
        groups: detail?.groups.length ?? 0,
        options: detail?.options.length ?? 0,
      });
    });
  }

  function requestApply() {
    if (!template || !selected || !readiness) return;
    if (isChoicesTemplateUnfinished(readiness.groups, readiness.options)) {
      setWarnOpen(true);
      return;
    }
    runApply();
  }

  function runApply() {
    if (!template || !selected) return;
    setWarnOpen(false);
    startTransition(async () => {
      const result = await createClientChoicesFromTemplateAction(selected.id, template.id);
      if (!result.ok) {
        toast.error(result.message ?? "Could not create choices.");
        return;
      }
      toast.success("Client Choices created for this event.");
      onOpenChange(false);
      router.push(`/events/${selected.id}`);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.useTemplate}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Choose a client. This creates that booking&apos;s own Client Choices from &ldquo;{template?.name}&rdquo; — the Library template stays unchanged.
          </p>
        </SheetHeader>
        {step === "pick" ? (
          <TemplateApplyTargetPicker
            groups={clientGroups}
            disabled={pending}
            onSelectEvent={pickEvent}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Template</span> · {template?.name}</p>
              <p><span className="text-muted-foreground">Client</span> · {selected?.clientDisplayName}</p>
              <p><span className="text-muted-foreground">Event</span> · {selected?.name} · {selected?.eventDate}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("pick")} disabled={pending}>Back</Button>
              <Button type="button" onClick={requestApply} disabled={pending || !readiness}>
                {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : LIBRARY_LABELS.useTemplate}
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
  template, busy, archivedView, onUse, onDuplicate, onArchiveToggle, onDelete,
}: {
  template: ChoicesTemplate;
  busy: boolean;
  archivedView?: boolean;
  onUse: () => void;
  onDuplicate: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <LibraryAssetCard
      layout="row"
      title={template.name}
      description={template.description}
      meta={`Updated ${formatRelative(template.updatedAt)}`}
      href={archivedView ? undefined : `/library/choices-templates/${template.id}`}
      isArchived={template.isArchived}
      primaryActions={archivedView
        ? [
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/choices-templates/${template.id}/preview`, emphasis: "preview" },
            { id: "restore", label: LIBRARY_LABELS.restore, onClick: onArchiveToggle, emphasis: "edit" },
          ]
        : [
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/choices-templates/${template.id}/preview`, emphasis: "preview" },
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/choices-templates/${template.id}`, emphasis: "edit" },
            { id: "use", label: LIBRARY_LABELS.useTemplate, onClick: onUse, emphasis: "use" },
          ]}
      overflowPending={busy}
      overflowItems={archivedView ? [] : [
        { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: onDuplicate, icon: <Copy className="mr-2 h-3.5 w-3.5" /> },
        { id: "archive", label: archiveToggleLabel(template.isArchived), onClick: onArchiveToggle, separatorBefore: true },
        {
          id: "delete", label: LIBRARY_LABELS.delete, onClick: onDelete, destructive: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        },
      ]}
    />
  );
}

export function ChoicesTemplateList({
  templates,
  clientGroups = [],
}: {
  templates: ChoicesTemplate[];
  clientGroups?: TemplateApplyClientGroup[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [creating, startCreate] = React.useTransition();
  const [using, setUsing] = React.useState<ChoicesTemplate | null>(null);
  const [deleting, setDeleting] = React.useState<ChoicesTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);

  function handleCreate() {
    startCreate(async () => {
      const result = await createChoicesTemplateAction({ name, description });
      if (!result.ok) {
        toast.error(result.errors?.name ?? result.message ?? "Could not create template.");
        return;
      }
      toast.success("Choices template created.");
      setOpen(false);
      setName("");
      setDescription("");
      router.push(`/library/choices-templates/${result.templateId}`);
    });
  }

  async function handleDuplicate(t: ChoicesTemplate) {
    setPendingId(t.id);
    const result = await duplicateChoicesTemplateAction(t.id, `${t.name} (Copy)`);
    setPendingId(null);
    if (result.ok) {
      toast.success("Template duplicated.");
      router.push(`/library/choices-templates/${result.templateId}`);
    } else {
      toast.error(result.message ?? "Could not duplicate.");
    }
  }

  async function handleArchiveToggle(t: ChoicesTemplate) {
    setPendingId(t.id);
    await setChoicesTemplateArchivedAction(t.id, !t.isArchived);
    setPendingId(null);
    toast.success(t.isArchived ? "Template restored." : "Template archived.");
    router.refresh();
  }

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteChoicesTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Template deleted.");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(result.message ?? "Could not delete.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Reusable menus, bar packages, rentals, and other client choices — create once, send per event.
        </p>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New template
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No Choices templates yet. Create one such as “Wedding Dinner Selection”.
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              busy={pendingId === t.id}
              onUse={() => setUsing(t)}
              onDuplicate={() => handleDuplicate(t)}
              onArchiveToggle={() => handleArchiveToggle(t)}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </div>
      )}

      <LibraryArchivedSection count={archived.length}>
        <div className="space-y-2">
          {archived.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              busy={pendingId === t.id}
              archivedView
              onUse={() => setUsing(t)}
              onDuplicate={() => handleDuplicate(t)}
              onArchiveToggle={() => handleArchiveToggle(t)}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </div>
      </LibraryArchivedSection>

      <UseChoicesTemplateSheet
        template={using}
        clientGroups={clientGroups}
        open={!!using}
        onOpenChange={(o) => { if (!o) setUsing(null); }}
      />

      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="template"
        consequenceNote="Client Choices already sent for events are unaffected."
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle>New Choices template</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wedding Dinner Selection" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <Button type="button" onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
