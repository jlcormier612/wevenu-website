"use client";

/**
 * Venue library for Questionnaires & Feedback starters.
 * Active list: Preview | Edit | Use Questionnaire.
 * Archived: Preview + Restore only (no Use).
 * Use = create/apply draft on an event — never sends to the client.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addQuestionnaireStarterAgainAction,
  applyQuestionnaireTemplateAction,
  createQuestionnaireTemplateAction,
  deleteQuestionnaireTemplateAction,
  duplicateQuestionnaireTemplateAction,
  provisionMissingQuestionnaireStartersAction,
  setQuestionnaireTemplateArchivedAction,
} from "@/app/(app)/events/[id]/questionnaire-actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/leads/constants";
import {
  QUESTIONNAIRE_FAMILY_MASTERS,
  getQuestionnaireMasterByKind,
  kindLabel,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";
import type { QuestionnaireTemplate } from "@/lib/questionnaire-templates/service";

export type QuestionnaireEventOption = {
  id: string;
  name: string;
  eventDate: string;
};

function NewQuestionnaireSheet() {
  const router = useRouter();
  const masterDefault = getQuestionnaireMasterByKind("final_details");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(masterDefault.name);
  const [description, setDescription] = React.useState(masterDefault.description);
  const [kind, setKind] = React.useState<QuestionnaireKind>("final_details");
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleKindChange(next: QuestionnaireKind) {
    setKind(next);
    const m = getQuestionnaireMasterByKind(next);
    setName(m.name);
    setDescription(m.description);
  }

  function handleCreate() {
    startTransition(async () => {
      const m = getQuestionnaireMasterByKind(kind);
      const included = m.fields.map((f) => f.id);
      const required = m.fields.filter((f) => f.required).map((f) => f.id);
      const result = await createQuestionnaireTemplateAction(name, description, kind, included, required);
      if (result.ok) {
        setOpen(false);
        setError("");
        toast.success("Questionnaire created.");
        router.push(`/library/questionnaire-templates/${result.template.id}`);
      } else {
        setError(result.message ?? "Could not create questionnaire.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>+ New questionnaire</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>New questionnaire</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Start from a Hello to Cheers form type, then customize questions on the next screen.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Based on</label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => handleKindChange(e.target.value as QuestionnaireKind)}
            >
              <option value="client_planning">Client Planning Questionnaire</option>
              <option value="final_details">Final Details</option>
              <option value="post_event_feedback">Post-Event Feedback</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Purpose</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>{LIBRARY_LABELS.cancel}</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleCreate}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create & edit"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type UseStep = "pick" | "confirm";

function UseQuestionnaireSheet({
  template,
  events,
  open,
  onOpenChange,
}: {
  template: QuestionnaireTemplate;
  events: QuestionnaireEventOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [step, setStep] = React.useState<UseStep>("pick");
  const [selected, setSelected] = React.useState<QuestionnaireEventOption | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setStep("pick");
      setSelected(null);
      setQ("");
    }
  }, [open]);

  const filtered = events.filter((e) => {
    if (!q.trim()) return true;
    return e.name.toLowerCase().includes(q.trim().toLowerCase());
  });

  function createDraft() {
    if (!selected) return;
    startTransition(async () => {
      const result = await applyQuestionnaireTemplateAction(template.id, selected.id);
      if (result.ok) {
        toast.success("Draft questionnaire created on the event. Review it, then send when ready.");
        router.push(`/events/${selected.id}#questionnaires`);
        onOpenChange(false);
      } else {
        toast.error(result.message ?? "Could not create questionnaire.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{LIBRARY_LABELS.useQuestionnaire}</SheetTitle>
          {step === "pick" ? (
            <p className="text-sm text-muted-foreground">
              Choose an event. This creates a <span className="font-medium text-foreground">draft</span>{" "}
              {kindLabel(template.kind)} on that event from &ldquo;{template.name}&rdquo;. It does{" "}
              <span className="font-medium text-foreground">not</span> email or notify the client.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Confirm what will happen before creating the working draft.
            </p>
          )}
        </SheetHeader>

        {step === "pick" ? (
          <>
            <Input
              placeholder="Search events…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mb-3"
            />
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
        ) : selected && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Template</span> · {template.name}</p>
              <p><span className="text-muted-foreground">Form type</span> · {kindLabel(template.kind)}</p>
              <p><span className="text-muted-foreground">Event</span> · {selected.name}</p>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Creates or updates the event&apos;s <span className="text-foreground">draft</span> questionnaire only.</li>
              <li>Does not send email, SMS, or portal notifications.</li>
              <li>If this form type was already sent for this event, creation is blocked so client answers stay safe.</li>
              <li>Next: review the draft on the event, preview as the client, then use Send Questionnaire when ready.</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("pick")}>Back</Button>
              <Button type="button" disabled={pending} onClick={createDraft}>
                {pending
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</>
                  : LIBRARY_LABELS.createQuestionnaire}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StarterMenu({ missingKeys }: { missingKeys: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" disabled={pending} />}>
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookPlus className="mr-1.5 h-4 w-4" />}
        Hello to Cheers starters
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {missingKeys.length > 0 && (
          <DropdownMenuItem onClick={() => startTransition(async () => {
            const r = await provisionMissingQuestionnaireStartersAction();
            if (r.ok) { toast.success(`Added ${(r.created ?? []).length} starter${(r.created ?? []).length === 1 ? "" : "s"}.`); router.refresh(); }
            else toast.error(r.message ?? "Could not add starters.");
          })}>
            Add missing starters ({missingKeys.length})
          </DropdownMenuItem>
        )}
        {QUESTIONNAIRE_FAMILY_MASTERS.map((m) => (
          <DropdownMenuItem key={m.key} onClick={() => startTransition(async () => {
            const r = await addQuestionnaireStarterAgainAction(m.key);
            if (r.ok) { toast.success("Starter added — your earlier customizations were left alone."); router.refresh(); }
            else toast.error(r.message ?? "Could not add starter.");
          })}>
            Add {m.name} again
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TemplateCard({
  template,
  events,
  archivedView,
  onDelete,
}: {
  template: QuestionnaireTemplate;
  events: QuestionnaireEventOption[];
  archivedView?: boolean;
  onDelete: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [useOpen, setUseOpen] = React.useState(false);
  const router = useRouter();
  const count = template.includedFields.length || (
    getQuestionnaireMasterByKind(template.kind).fields.length + template.customFields.length
  );

  const primaryActions = archivedView
    ? [
        {
          id: "preview",
          label: LIBRARY_LABELS.preview,
          href: `/library/questionnaire-templates/${template.id}/preview`,
          emphasis: "preview" as const,
        },
        {
          id: "restore",
          label: LIBRARY_LABELS.restore,
          onClick: () => startTransition(async () => {
            const result = await setQuestionnaireTemplateArchivedAction(template.id, false);
            if (!result.ok) toast.error(result.message ?? "Could not restore.");
            else { toast.success("Questionnaire restored."); router.refresh(); }
          }),
          emphasis: "edit" as const,
        },
      ]
    : [
        {
          id: "preview",
          label: LIBRARY_LABELS.preview,
          href: `/library/questionnaire-templates/${template.id}/preview`,
          emphasis: "preview" as const,
        },
        {
          id: "edit",
          label: LIBRARY_LABELS.edit,
          href: `/library/questionnaire-templates/${template.id}`,
          emphasis: "edit" as const,
        },
        {
          id: "use",
          label: LIBRARY_LABELS.useQuestionnaire,
          onClick: () => setUseOpen(true),
          emphasis: "use" as const,
        },
      ];

  return (
    <>
      <LibraryAssetCard
        layout="row"
        title={template.name}
        description={template.description}
        meta={`${count} questions · Updated ${formatRelative(template.updatedAt)}`}
        isStarter={Boolean(template.sourceMasterKey)}
        isArchived={template.isArchived}
        badges={<Badge variant="muted" className="text-[10px]">{kindLabel(template.kind)}</Badge>}
        primaryActions={primaryActions}
        overflowPending={pending}
        overflowItems={archivedView ? [] : [
          {
            id: "duplicate",
            label: LIBRARY_LABELS.duplicate,
            onClick: () => startTransition(async () => {
              const result = await duplicateQuestionnaireTemplateAction(template.id, `${template.name} (Copy)`);
              if (result.ok) {
                toast.success("Duplicated.");
                if (result.templateId) router.push(`/library/questionnaire-templates/${result.templateId}`);
                else router.refresh();
              } else toast.error(result.message ?? "Could not duplicate.");
            }),
            icon: <Copy className="mr-2 h-3.5 w-3.5" />,
          },
          {
            id: "archive",
            label: archiveToggleLabel(template.isArchived),
            onClick: () => startTransition(async () => {
              const result = await setQuestionnaireTemplateArchivedAction(template.id, !template.isArchived);
              if (!result.ok) toast.error(result.message ?? "Could not update.");
              else {
                toast.success(template.isArchived ? "Questionnaire restored." : "Questionnaire archived.");
                router.refresh();
              }
            }),
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
      {!archivedView && useOpen && (
        <UseQuestionnaireSheet
          template={template}
          events={events}
          open={useOpen}
          onOpenChange={setUseOpen}
        />
      )}
    </>
  );
}

export function QuestionnaireTemplateList({
  templates,
  missingStarterKeys = [],
  events = [],
}: {
  templates: QuestionnaireTemplate[];
  missingStarterKeys?: string[];
  events?: QuestionnaireEventOption[];
}) {
  const router = useRouter();
  const { active, archived } = partitionArchived(templates, (t) => t.isArchived);
  const [deleting, setDeleting] = React.useState<QuestionnaireTemplate | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);

  async function handleDeleteConfirmed() {
    if (!deleting) return;
    setDeletePending(true);
    const result = await deleteQuestionnaireTemplateAction(deleting.id);
    setDeletePending(false);
    if (result.ok) {
      toast.success("Questionnaire deleted.");
      setDeleting(null);
      router.refresh();
    } else {
      toast.error(result.message ?? "Could not delete questionnaire.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <StarterMenu missingKeys={missingStarterKeys} />
        <NewQuestionnaireSheet />
      </div>
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No questionnaires yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the Hello to Cheers starters, or create your own.</p>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No active questionnaires. Restore one from Archived, or create a new one.
            </p>
          ) : (
            <div className="space-y-2">
              {active.map((t) => (
                <TemplateCard key={t.id} template={t} events={events} onDelete={() => setDeleting(t)} />
              ))}
            </div>
          )}
          <LibraryArchivedSection count={archived.length}>
            <div className="space-y-2">
              {archived.map((t) => (
                <TemplateCard key={t.id} template={t} events={events} archivedView onDelete={() => setDeleting(t)} />
              ))}
            </div>
          </LibraryArchivedSection>
        </>
      )}
      <LibraryDeleteConfirmDialog
        open={!!deleting}
        itemName={deleting?.name ?? ""}
        itemLabel="questionnaire"
        consequenceNote="Questionnaires already sent or in progress on an event are unaffected."
        pending={deletePending}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
