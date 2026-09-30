"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderStarterAgainAction,
  createEventOrderTemplateAction, deleteEventOrderTemplateAction,
  duplicateEventOrderTemplateAction, getEventOrderTemplateDetailAction,
  setEventOrderTemplateArchivedAction,
} from "@/app/(app)/library/event-order-templates/actions";
import {
  sendEventOrderTemplateAction,
  useEventOrderTemplateAction,
} from "@/app/(app)/events/[id]/event-order-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/leads/constants";
import { TemplateApplyChooser } from "@/components/event-order-templates/apply-event-order-template-sheet";
import {
  TemplateGroupAnswerChooser,
  initialAnswersForTemplate,
} from "@/components/event-order-templates/template-group-answer-chooser";
import { defaultApplySelections, type TemplateApplySelection } from "@/lib/event-order-templates/offerings";
import { templateHasSelectableGroups } from "@/lib/event-order-templates/selection-definition";
import { EVENT_ORDER_STARTER_MASTERS, type EventOrderStarterMasterKey } from "@/lib/event-order-templates/starters";
import { isEventOrderTemplateUnfinished } from "@/lib/library/template-readiness";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
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
          <p className="text-sm text-muted-foreground">A reusable Event Order template — sections and optional offerings, with or without prices. Applying it copies a snapshot into an event; it is not itself a client commitment.</p>
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

type UseStep = "pick" | "confirm";

function UseOrSendEventOrderSheet({
  template,
  clientGroups,
  open,
  onOpenChange,
  mode,
}: {
  template: EventOrderTemplate | null;
  clientGroups: TemplateApplyClientGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "use" | "send";
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<TemplateApplyEventTarget | null>(null);
  const [loading, startLoading] = React.useTransition();
  const [pending, startTransition] = React.useTransition();
  const [detail, setDetail] = React.useState<EventOrderTemplateWithDetails | null>(null);
  const [selections, setSelections] = React.useState<TemplateApplySelection[]>([]);
  const [answers, setAnswers] = React.useState<ChoicesAnswers>({});
  const [warnOpen, setWarnOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSelected(null);
      setDetail(null);
      setSelections([]);
      setAnswers({});
      setWarnOpen(false);
    }
  }, [open]);

  function pickEvent(ev: TemplateApplyEventTarget) {
    if (!template) return;
    setSelected(ev);
    setStep("confirm");
    startLoading(async () => {
      const loaded = await getEventOrderTemplateDetailAction(template.id);
      setDetail(loaded);
      setSelections(loaded ? defaultApplySelections(loaded.lines) : []);
      setAnswers(loaded ? initialAnswersForTemplate(loaded) : {});
    });
  }

  function requestApply() {
    if (!selected || !template || !detail) return;
    if (isEventOrderTemplateUnfinished(detail.lines.length, detail.groups?.length ?? 0)) {
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
        const result = await sendEventOrderTemplateAction(selected.id, template.id, {
          lineSelections: selections,
          answers,
        });
        if (result.ok) {
          toast.success("Sent to client for selections.");
          router.push(`/events/${selected.id}`);
          onOpenChange(false);
        } else {
          toast.error(result.message ?? "Could not send this template.");
        }
        return;
      }
      const result = await useEventOrderTemplateAction(selected.id, template.id, {
        lineSelections: selections,
        answers,
      });
      if (result.ok) {
        toast.success(
          templateHasSelectableGroups(detail!)
            ? "Template applied and selections finalized on the Event Order."
            : "Template applied to the event.",
        );
        router.push(`/events/${selected.id}#event-order`);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Could not apply this template.");
      }
    });
  }

  const title = mode === "send" ? LIBRARY_LABELS.sendToClient : "Use Template";
  const confirmCta = mode === "send"
    ? (pending ? "Sending…" : "Send to client")
    : (pending ? "Applying…" : "Apply to event");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{title}</SheetTitle>
          {step === "pick" ? (
            <p className="text-sm text-muted-foreground">
              {mode === "send"
                ? <>Choose a client event to send &ldquo;{template?.name}&rdquo; for selections.</>
                : <>Choose a client. This starts that booking&apos;s Event Order from &ldquo;{template?.name}&rdquo;.</>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === "send"
                ? "Fixed offerings apply now. Choice groups go to the client for selection — you finalize into the Event Order after they submit."
                : "Choose fixed offerings and fill any choice groups. This applies on the venue side — no client round-trip."}
            </p>
          )}
        </SheetHeader>

        {step === "pick" ? (
          <TemplateApplyTargetPicker
            groups={clientGroups}
            disabled={pending || loading}
            onSelectEvent={pickEvent}
          />
        ) : selected && template && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Template</span> · {template.name}</p>
              <p><span className="text-muted-foreground">Client</span> · {selected.clientDisplayName}</p>
              <p><span className="text-muted-foreground">Event</span> · {selected.name} · {selected.eventDate}</p>
            </div>
            {detail ? (
              <>
                <TemplateApplyChooser template={detail} selections={selections} onChange={setSelections} />
                {templateHasSelectableGroups(detail) ? (
                  <TemplateGroupAnswerChooser
                    template={detail}
                    answers={answers}
                    onChange={setAnswers}
                  />
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading offerings…</p>
            )}
            <p className="text-xs text-muted-foreground">
              If this event already has a finalized Event Order, applying is blocked. Open orders receive additional structure without replacing existing lines.
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("pick")}>Back</Button>
              <Button type="button" disabled={pending || !detail} onClick={requestApply}>
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
  template, archivedView, onUse, onSend, onDelete,
}: {
  template: EventOrderTemplate;
  archivedView?: boolean;
  onUse: () => void;
  onSend: () => void;
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
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/event-order-templates/${template.id}/preview`, emphasis: "preview" },
            { id: "restore", label: LIBRARY_LABELS.restore, onClick: handleArchiveToggle, emphasis: "edit" },
          ]
        : [
            { id: "preview", label: LIBRARY_LABELS.preview, href: `/library/event-order-templates/${template.id}/preview`, emphasis: "preview" },
            { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/event-order-templates/${template.id}`, emphasis: "edit" },
            { id: "use", label: LIBRARY_LABELS.useTemplate, onClick: onUse, emphasis: "use" },
            { id: "send", label: LIBRARY_LABELS.sendToClient, onClick: onSend, emphasis: "use" },
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
  clientGroups = [],
}: {
  templates: EventOrderTemplate[];
  missingStarterKeys?: EventOrderStarterMasterKey[];
  clientGroups?: TemplateApplyClientGroup[];
}) {
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);
  const [using, setUsing] = React.useState<EventOrderTemplate | null>(null);
  const [sending, setSending] = React.useState<EventOrderTemplate | null>(null);
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
        onUse={() => setUsing(t)}
        onSend={() => setSending(t)}
        onDelete={() => setDeleting(t)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Commercial build sheets — fixed offerings and selectable groups. Use applies on the venue side;
          Send lets the client choose. Editing a template never changes an Event Order already on a booking.
        </p>
        <div className="flex items-center gap-2">
          <StarterMenu missingKeys={missingStarterKeys} />
          <NewTemplateSheet />
        </div>
      </div>
      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No Event Order Templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to reuse how your venue delivers an event — from simple sections to fully priced offerings.</p>
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
      <UseOrSendEventOrderSheet
        mode="use"
        template={using}
        clientGroups={clientGroups}
        open={!!using}
        onOpenChange={(o) => { if (!o) setUsing(null); }}
      />
      <UseOrSendEventOrderSheet
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
