"use client";

/**
 * Venue library for the Questionnaire Family starters.
 * Customer-facing names only — no engineering terminology.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { BookPlus, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addQuestionnaireStarterAgainAction,
  createQuestionnaireTemplateAction,
  duplicateQuestionnaireTemplateAction,
  provisionMissingQuestionnaireStartersAction,
  setQuestionnaireTemplateArchivedAction,
  updateQuestionnaireTemplateAction,
} from "@/app/(app)/events/[id]/questionnaire-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

function FieldConfigEditor({
  kind, included, required, onChange,
}: {
  kind: QuestionnaireKind;
  included: string[];
  required: string[];
  onChange: (included: string[], required: string[]) => void;
}) {
  const master = getQuestionnaireMasterByKind(kind);
  return (
    <div className="space-y-2 rounded-sm border border-border p-3 max-h-[50vh] overflow-y-auto">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-center text-xs font-medium text-muted-foreground">
        <span>Question</span><span>Show</span><span>Require</span>
      </div>
      {master.fields.map((field) => {
        const isIncluded = included.includes(field.id);
        const isRequired = required.includes(field.id);
        return (
          <div key={field.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-start">
            <div>
              <p className="text-sm text-heading leading-snug">{field.label}</p>
              <p className="text-[11px] text-muted-foreground">{field.section}</p>
            </div>
            <Checkbox checked={isIncluded} onCheckedChange={(v) => {
              const on = v === true;
              const nextIncluded = on ? [...included, field.id] : included.filter((f) => f !== field.id);
              const nextRequired = on ? required : required.filter((f) => f !== field.id);
              onChange(nextIncluded, nextRequired);
            }} />
            <Checkbox checked={isRequired} disabled={!isIncluded} onCheckedChange={(v) => {
              onChange(included, v === true ? [...required, field.id] : required.filter((f) => f !== field.id));
            }} />
          </div>
        );
      })}
    </div>
  );
}

function TemplateSheet({
  template, defaultKind = "final_details", renderTrigger, children,
}: {
  template?: QuestionnaireTemplate;
  defaultKind?: QuestionnaireKind;
  renderTrigger: React.ReactElement;
  children: React.ReactNode;
}) {
  const masterDefault = getQuestionnaireMasterByKind(template?.kind ?? defaultKind);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(template?.name ?? masterDefault.name);
  const [description, setDescription] = React.useState(template?.description ?? masterDefault.description);
  const [kind, setKind] = React.useState<QuestionnaireKind>(template?.kind ?? defaultKind);
  const [included, setIncluded] = React.useState<string[]>(
    template?.includedFields?.length ? template.includedFields : masterDefault.fields.map((f) => f.id),
  );
  const [required, setRequired] = React.useState<string[]>(
    template?.requiredFields?.length ? template.requiredFields : masterDefault.fields.filter((f) => f.required).map((f) => f.id),
  );
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleKindChange(next: QuestionnaireKind) {
    setKind(next);
    if (!template) {
      const m = getQuestionnaireMasterByKind(next);
      setName(m.name);
      setDescription(m.description);
      setIncluded(m.fields.map((f) => f.id));
      setRequired(m.fields.filter((f) => f.required).map((f) => f.id));
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = template
        ? await updateQuestionnaireTemplateAction(template.id, name, description, kind, included, required)
        : await createQuestionnaireTemplateAction(name, description, kind, included, required);
      if (result.ok) {
        setOpen(false); setError("");
        toast.success(template ? "Template updated." : "Template created.");
      } else setError(result.message ?? "Could not save template.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={renderTrigger}>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{template ? "Edit planning form" : "New planning form"}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Choose which questions clients see. Existing working forms already sent to couples are not changed.
          </p>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading">Which form</label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={kind}
              disabled={!!template?.sourceMasterKey}
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
          <FieldConfigEditor kind={kind} included={included} required={required} onChange={(i, r) => { setIncluded(i); setRequired(r); }} />
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" disabled={!name.trim() || pending} onClick={handleSave}>
            {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Saving…</> : template ? "Save" : "Create"}
          </Button>
        </div>
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

function TemplateCard({ template }: { template: QuestionnaireTemplate }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <TemplateSheet template={template} renderTrigger={<button type="button" className="min-w-0 flex-1 text-left" />}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-heading">{template.name}</p>
            {template.sourceMasterKey && <Badge variant="muted" className="text-[10px]">Starter</Badge>}
            <Badge variant="muted" className="text-[10px]">{kindLabel(template.kind)}</Badge>
          </div>
          {template.description && <p className="text-sm text-muted-foreground truncate">{template.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">{template.includedFields.length} questions · Updated {formatRelative(template.updatedAt)}</p>
        </TemplateSheet>
        <div className="flex items-center gap-2 shrink-0">
          {template.isArchived && <Badge variant="muted">Archived</Badge>}
          <Button type="button" variant="ghost" size="sm" disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await duplicateQuestionnaireTemplateAction(template.id, `${template.name} (Copy)`);
              if (result.ok) { toast.success("Copy created."); router.refresh(); }
              else toast.error(result.message ?? "Could not duplicate.");
            })}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await setQuestionnaireTemplateArchivedAction(template.id, !template.isArchived);
              if (!result.ok) toast.error(result.message ?? "Could not update.");
              else router.refresh();
            })}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : template.isArchived ? "Unarchive" : "Archive"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuestionnaireTemplateList({
  templates,
  missingStarterKeys = [],
}: {
  templates: QuestionnaireTemplate[];
  missingStarterKeys?: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <StarterMenu missingKeys={missingStarterKeys} />
        <TemplateSheet renderTrigger={<Button />}>+ New form</TemplateSheet>
      </div>
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No planning forms yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the Hello to Cheers starters, or create your own.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => <TemplateCard key={t.id} template={t} />)}
        </div>
      )}
    </div>
  );
}
