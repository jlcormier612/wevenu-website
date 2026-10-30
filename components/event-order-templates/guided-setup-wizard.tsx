"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateSectionAction,
  removeEventOrderTemplateSectionAction,
  addEventOrderTemplateLineAction,
  removeEventOrderTemplateLineAction,
  updateEventOrderTemplateLineAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { EventOrderTemplateChoiceGroups } from "@/components/event-order-templates/event-order-template-choice-groups";
import { OfferingEditorSheet } from "@/components/event-order-templates/offering-editor-sheet";
import { PackageChoicesPanel } from "@/components/event-order-templates/package-choices-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SUGGESTED_CATEGORIES,
  buildReviewSummary,
  canonicalSectionNameForSuggested,
  selectedCategoryKeysFromTemplate,
} from "@/lib/event-order-templates/guided-setup";
import { formatTemplateOfferingPrice, linesForSection } from "@/lib/event-order-templates/offerings";
import { groupsForSection } from "@/lib/event-order-templates/section-workspace";
import type {
  AddTemplateLineInput,
  EventOrderTemplateLine,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import type { OfferingChoiceGroup } from "@/lib/offerings/choice-groups";
import type { OfferingWithCategory } from "@/lib/offerings/types";

type Props = {
  template: EventOrderTemplateWithDetails;
  catalogOfferings?: OfferingWithCategory[];
  catalogChoiceGroups?: OfferingChoiceGroup[];
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
};

type EditorTarget = {
  section: EventOrderTemplateSection;
  line: EventOrderTemplateLine | null;
  defaultIncluded: boolean;
};

/** One scrolling page: each section shows Included, Couple chooses, and Add-ons. */
export function GuidedSetupWizard({
  template,
  catalogOfferings = [],
  catalogChoiceGroups = [],
  onPersist,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [editor, setEditor] = React.useState<EditorTarget | null>(null);
  const [editorPending, startEditor] = React.useTransition();
  const [addingSection, setAddingSection] = React.useState(template.sections.length === 0);
  const [customDraft, setCustomDraft] = React.useState("");

  const sectionsOrdered = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const existing = selectedCategoryKeysFromTemplate(template.sections);
  const remainingSuggested = SUGGESTED_CATEGORIES.filter((c) => !existing.suggested.includes(c.key));
  const review = buildReviewSummary(template);
  const warningsBySection = new Map(review.map((r) => [r.sectionId, r.incompleteMessages]));

  function openPackageCategories() {
    setCustomDraft("");
    setAddingSection(true);
  }

  function addSection(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (sectionsOrdered.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That section is already on this template.");
      return;
    }
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateSectionAction(template.id, trimmed, null);
      if (!r.ok) {
        onPersist("error", r.message ?? "Could not add section.");
        return;
      }
      onPersist("saved");
      setCustomDraft("");
      setAddingSection(false);
      router.refresh();
    });
  }

  function removeSection(section: EventOrderTemplateSection) {
    const hasContent =
      linesForSection(template.lines, section.id).length > 0
      || groupsForSection(template.groups, section.id).length > 0;
    const msg = hasContent
      ? `Remove “${section.name}” and its items from this template? Event Orders already created are not changed.`
      : `Remove “${section.name}” from this template?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      onPersist("saving");
      const r = await removeEventOrderTemplateSectionAction(template.id, section.id);
      if (!r.ok) onPersist("error", r.message ?? "Could not remove section.");
      else {
        onPersist("saved");
        router.refresh();
      }
    });
  }

  async function persistLine(input: AddTemplateLineInput) {
    const editingLine = editor?.line ?? null;
    return await new Promise<boolean>((resolve) => {
      startEditor(async () => {
        onPersist("saving");
        const result = editingLine
          ? await updateEventOrderTemplateLineAction(template.id, editingLine.id, input)
          : await addEventOrderTemplateLineAction(template.id, input);
        if (result.ok) {
          onPersist("saved");
          resolve(true);
          router.refresh();
        } else {
          onPersist("error", "message" in result ? result.message : "Could not save.");
          resolve(false);
        }
      });
    });
  }

  async function removeLine(lineId: string) {
    onPersist("saving");
    const r = await removeEventOrderTemplateLineAction(template.id, lineId);
    if (!r.ok) onPersist("error", r.message);
    else {
      onPersist("saved");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6" data-testid="eo-guided-setup-wizard">
      <div className="space-y-6" data-testid="eo-guided-step-workspace">
        {sectionsOrdered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No sections yet. Add the first thing you sell, like Catering or Bar Service.
          </p>
        ) : null}
        {sectionsOrdered.map((section) => {
          const lines = linesForSection(template.lines, section.id);
          const included = lines.filter((l) => l.includedByDefault);
          const addOns = lines.filter((l) => !l.includedByDefault);
          const warnings = warningsBySection.get(section.id) ?? [];
          return (
            <section
              key={section.id}
              className="rounded-lg border border-border p-4 space-y-5"
              data-testid={`eo-guided-configure-${section.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-lg text-heading">{section.name}</h2>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  aria-label={`Remove ${section.name}`}
                  data-testid={`eo-guided-remove-section-${section.id}`}
                  onClick={() => removeSection(section)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {warnings.map((m) => (
                <p key={m} className="text-sm text-amber-800" data-testid="eo-guided-review-warning">{m}</p>
              ))}

              <TemplateLinesBlock
                title="Included"
                hint="Always on the package, covered by the package price."
                testId={`eo-guided-step-fixed-${section.id}`}
                addTestId={`eo-add-offering-${section.id}`}
                addLabel="Add included item"
                lines={included}
                onAdd={() => setEditor({ section, line: null, defaultIncluded: true })}
                onEdit={(line) => setEditor({ section, line, defaultIncluded: true })}
                onRemove={removeLine}
              />

              <div className="space-y-2" data-testid={`eo-guided-step-choices-${section.id}`}>
                <h3 className="text-sm font-semibold text-heading">Couple chooses</h3>
                <PackageChoicesPanel
                  template={template}
                  catalogOfferings={catalogOfferings}
                  catalogChoiceGroups={catalogChoiceGroups}
                  sectionId={section.id}
                  sectionName={section.name}
                  onPersist={onPersist}
                />
              </div>

              <TemplateLinesBlock
                title="Add-ons"
                hint="Extras billed on top of the package price. Pick which ones to include when you apply the template."
                testId={`eo-guided-step-addons-${section.id}`}
                addTestId={`eo-add-addon-${section.id}`}
                addLabel="Add add-on"
                lines={addOns}
                onAdd={() => setEditor({ section, line: null, defaultIncluded: false })}
                onEdit={(line) => setEditor({ section, line, defaultIncluded: false })}
                onRemove={removeLine}
              />

              <SpecialistRules template={template} sectionId={section.id} catalogOfferings={catalogOfferings} onPersist={onPersist} />
            </section>
          );
        })}
      </div>

      {addingSection ? (
        <section className="space-y-3 rounded-lg border border-dashed border-border p-4" data-testid="eo-guided-step-categories">
          <h2 className="text-sm font-semibold text-heading">Add section</h2>
          {remainingSuggested.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {remainingSuggested.map((cat) => (
                <Button
                  key={cat.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  data-testid={`eo-guided-category-${cat.key}`}
                  onClick={() => addSection(canonicalSectionNameForSuggested(cat.key) || cat.name)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {cat.name}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Input
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSection(customDraft); }}
              placeholder="Or name your own section"
              className="max-w-xs"
              data-testid="eo-guided-custom-category-input"
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || !customDraft.trim()}
              data-testid="eo-guided-custom-category-add"
              onClick={() => addSection(customDraft)}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
            {sectionsOrdered.length > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setAddingSection(false)}>Cancel</Button>
            ) : null}
          </div>
        </section>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="eo-guided-edit-package-categories"
          onClick={() => openPackageCategories()}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add section
        </Button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground" data-testid="eo-guided-preview-non-sending">
          Preview only — no send, no finalize.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="eo-guided-goto-preview"
          render={<Link href={`/library/event-order-templates/${template.id}/preview`} />}
        >
          Preview the couple&apos;s view
        </Button>
      </div>

      <OfferingEditorSheet
        open={editor !== null}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        sectionId={editor?.section.id ?? null}
        sectionName={editor?.section.name ?? null}
        line={editor?.line ?? null}
        defaultIncluded={editor?.defaultIncluded}
        catalogOfferings={catalogOfferings}
        pending={editorPending}
        onSave={persistLine}
      />
    </div>
  );
}

function SpecialistRules({
  template,
  sectionId,
  catalogOfferings,
  onPersist,
}: {
  template: EventOrderTemplateWithDetails;
  sectionId: string;
  catalogOfferings: OfferingWithCategory[];
  onPersist: Props["onPersist"];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <details
      className="text-sm text-muted-foreground"
      data-testid={`eo-specialist-selection-rules-${sectionId}`}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Specialist selection rules</summary>
      {open ? (
        <div className="mt-3">
          <EventOrderTemplateChoiceGroups
            template={template}
            catalogOfferings={catalogOfferings}
            onPersist={onPersist}
            lockedSectionId={sectionId}
            compact
            showPreview={false}
            nestBranches
            specialistMode
          />
        </div>
      ) : null}
    </details>
  );
}

function TemplateLinesBlock({
  title,
  hint,
  testId,
  addTestId,
  addLabel,
  lines,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  hint: string;
  testId: string;
  addTestId: string;
  addLabel: string;
  lines: EventOrderTemplateLine[];
  onAdd: () => void;
  onEdit: (line: EventOrderTemplateLine) => void;
  onRemove: (lineId: string) => void | Promise<void>;
}) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <div>
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {lines.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              data-testid={`eo-package-item-${line.id}`}
              data-included-by-default={line.includedByDefault ? "true" : "false"}
            >
              <div className="min-w-0">
                <p className="text-sm text-heading">{line.description}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTemplateOfferingPrice(line)}
                  {line.offeringId ? "" : " · one-off item"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(line)}>Edit</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void onRemove(line.id)}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={onAdd} data-testid={addTestId}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}
