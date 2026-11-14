"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import {
  addEventOrderTemplateLineAction,
  removeEventOrderTemplateLineAction,
  updateEventOrderTemplateLineAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { EventOrderTemplateChoiceGroups } from "@/components/event-order-templates/event-order-template-choice-groups";
import { OfferingEditorSheet } from "@/components/event-order-templates/offering-editor-sheet";
import { PackageChoicesPanel } from "@/components/event-order-templates/package-choices-panel";
import { SectionFloorPlanDefault } from "@/components/event-order-templates/section-floor-plan-default";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibrarySaveStatus, useLibrarySaveStatus } from "@/components/library/library-save-status";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  sectionCompletenessIssues,
  groupsForSection,
} from "@/lib/event-order-templates/section-workspace";
import { formatTemplateOfferingPrice, linesForSection } from "@/lib/event-order-templates/offerings";
import {
  editorLevelCopy,
  sectionEditorHref,
  templateOverviewHref,
  templatePreviewHref,
} from "@/lib/event-order-templates/editor-presentation";
import type {
  AddTemplateLineInput,
  EventOrderTemplateLine,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import type { OfferingChoiceGroup } from "@/lib/offerings/choice-groups";
import type { OfferingWithCategory } from "@/lib/offerings/types";

export type SectionEditorFocus = {
  choice?: string | null;
  offering?: string | null;
  category?: string | null;
};

export function EventOrderSectionEditor({
  template,
  section,
  catalogOfferings = [],
  catalogChoiceGroups = [],
  focus = {},
}: {
  template: EventOrderTemplateWithDetails;
  section: EventOrderTemplateSection;
  catalogOfferings?: OfferingWithCategory[];
  catalogChoiceGroups?: OfferingChoiceGroup[];
  focus?: SectionEditorFocus;
}) {
  const router = useRouter();
  const saveUi = useLibrarySaveStatus();
  const [editor, setEditor] = React.useState<{
    line: EventOrderTemplateLine | null;
    defaultIncluded: boolean;
  } | null>(null);
  const [editorPending, startEditor] = React.useTransition();

  const lines = linesForSection(template.lines, section.id);
  const included = lines.filter((l) => l.includedByDefault);
  const addOns = lines.filter((l) => !l.includedByDefault);
  const sectionGroups = groupsForSection(template.groups, section.id);
  const issues = sectionCompletenessIssues(sectionGroups, template.options);
  const focusedIssue = issues[0] ?? null;

  function onPersist(phase: "saving" | "saved" | "error", message?: string) {
    if (phase === "saving") saveUi.markSaving();
    else if (phase === "saved") saveUi.markSaved();
    else {
      saveUi.markError();
      if (message) toast.error(message);
    }
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

  const breadcrumb = sectionEditorBreadcrumb(template, section, focus);
  const choiceName = focus.choice
    ? template.groups.find((g) => g.id === focus.choice)?.name ?? null
    : null;
  const offeringName = focus.offering
    ? template.options.find((o) => o.id === focus.offering)?.label ?? null
    : null;
  const categoryName = focus.category
    ? template.groups.find((g) => g.id === focus.category)?.name ?? null
    : null;
  const level = editorLevelCopy({
    sectionName: section.name,
    choiceName,
    offeringName,
    categoryName,
  });
  const backHref = focus.category
    ? sectionEditorHref(template.id, section.id, { choice: focus.choice, offering: focus.offering })
    : focus.offering
      ? sectionEditorHref(template.id, section.id, { choice: focus.choice })
      : focus.choice
        ? sectionEditorHref(template.id, section.id)
        : templateOverviewHref(template.id);

  return (
    <div
      className="htc-hospitality-page space-y-4 sm:space-y-5 overflow-x-hidden"
      data-testid="eo-section-editor"
    >
      <nav aria-label="Section location" className="text-xs text-muted-foreground" data-testid="eo-section-breadcrumb">
        <Link href={templateOverviewHref(template.id)} className="hover:text-foreground hover:underline">
          {template.name}
        </Link>
        {breadcrumb.map((crumb) => (
          <span key={crumb.href}>
            <span aria-hidden> / </span>
            <Link href={crumb.href} className="hover:text-foreground hover:underline">
              {crumb.label}
            </Link>
          </span>
        ))}
      </nav>

      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2">
        <CollectionBackLink href={backHref} label={level.backLabel} />
        <div className="flex flex-wrap items-center gap-2">
          <LibrarySaveStatus status={saveUi.status} model="explicit" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="eo-section-preview-as-client"
            render={<Link href={templatePreviewHref(template.id)} />}
          >
            Preview as Client
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-heading text-2xl text-heading">{level.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{level.prompt}</p>
        {focusedIssue ? (
          <p className="mt-1 text-sm font-medium text-heading" data-testid="eo-section-attention">
            {plainIssueMessage(focusedIssue.message)}
          </p>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6">
      {focus.choice ? null : (
      <section className="space-y-3" data-testid={`eo-guided-step-fixed-${section.id}`}>
        <div>
          <h2 className="text-base font-semibold text-heading">What&apos;s included</h2>
          <p className="text-sm text-muted-foreground">Items provided as part of the event.</p>
        </div>
        <TemplateLinesBlock
          lines={included}
          addTestId={`eo-add-offering-${section.id}`}
          addLabel="Add included item"
          onAdd={() => setEditor({ line: null, defaultIncluded: true })}
          onEdit={(line) => setEditor({ line, defaultIncluded: true })}
          onRemove={removeLine}
        />
      </section>
      )}

      <section className="space-y-3" data-testid={`eo-guided-step-choices-${section.id}`}>
        {focus.choice ? null : (
        <div>
          <h2 className="text-base font-semibold text-heading">What clients can choose</h2>
        </div>
        )}
        <PackageChoicesPanel
          template={template}
          catalogOfferings={catalogOfferings}
          catalogChoiceGroups={catalogChoiceGroups}
          sectionId={section.id}
          sectionName={section.name}
          onPersist={onPersist}
          presentation="progressive"
          focus={{
            choiceId: focus.choice ?? null,
            optionId: focus.offering ?? null,
            categoryId: focus.category ?? null,
          }}
          baseHref={sectionEditorHref(template.id, section.id)}
        />
      </section>

      {focus.choice ? null : (
      <AdvancedSettings
        template={template}
        section={section}
        addOns={addOns}
        catalogOfferings={catalogOfferings}
        onPersist={onPersist}
        onAddAddOn={() => setEditor({ line: null, defaultIncluded: false })}
        onEditAddOn={(line) => setEditor({ line, defaultIncluded: false })}
        onRemoveAddOn={removeLine}
      />
      )}

      </div>

      <OfferingEditorSheet
        open={editor !== null}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        sectionId={section.id}
        sectionName={section.name}
        line={editor?.line ?? null}
        defaultIncluded={editor?.defaultIncluded}
        catalogOfferings={catalogOfferings}
        pending={editorPending}
        onSave={persistLine}
      />
    </div>
  );
}

function plainIssueMessage(message: string): string {
  if (/needs at least one choice/i.test(message)) return message;
  if (/no follow-up options/i.test(message)) return "Add at least one option to this client selection.";
  if (/no options yet/i.test(message)) {
    const named = message.match(/^“([^”]+)” has no options yet/);
    return named?.[1] ? `Add at least one option to ${named[1]}.` : "Add at least one option.";
  }
  return message.replace(/^“[^”]+”\s/, "");
}

function sectionEditorBreadcrumb(
  template: EventOrderTemplateWithDetails,
  section: EventOrderTemplateSection,
  focus: SectionEditorFocus,
): { href: string; label: string }[] {
  const crumbs = [
    { href: sectionEditorHref(template.id, section.id), label: section.name },
  ];
  if (focus.choice) {
    const group = template.groups.find((g) => g.id === focus.choice);
    crumbs.push({
      href: sectionEditorHref(template.id, section.id, { choice: focus.choice }),
      label: group?.name ?? "Selection",
    });
  }
  if (focus.offering) {
    const option = template.options.find((o) => o.id === focus.offering);
    crumbs.push({
      href: sectionEditorHref(template.id, section.id, {
        choice: focus.choice,
        offering: focus.offering,
      }),
      label: option?.label ?? "Offering",
    });
  }
  if (focus.category) {
    const category = template.groups.find((g) => g.id === focus.category);
    crumbs.push({
      href: sectionEditorHref(template.id, section.id, {
        choice: focus.choice,
        offering: focus.offering,
        category: focus.category,
      }),
      label: category?.name ?? "Category",
    });
  }
  return crumbs;
}

function TemplateLinesBlock({
  lines,
  addTestId,
  addLabel,
  includedLabel = "Included",
  onAdd,
  onEdit,
  onRemove,
}: {
  lines: EventOrderTemplateLine[];
  addTestId: string;
  addLabel: string;
  includedLabel?: string;
  onAdd: () => void;
  onEdit: (line: EventOrderTemplateLine) => void;
  onRemove: (lineId: string) => void | Promise<void>;
}) {
  return (
    <div className="space-y-2">
      {lines.length > 0 ? (
        <ul className="space-y-1.5">
          {lines.map((line) => (
            <li
              key={line.id}
              className="htc-working-row flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
              data-testid={`eo-package-item-${line.id}`}
              data-included-by-default={line.includedByDefault ? "true" : "false"}
            >
              <div className="min-w-0">
                <p className="text-sm text-heading">{line.description}</p>
                {line.descriptionDetail ? (
                  <p className="text-xs text-muted-foreground">{line.descriptionDetail}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {includedLabel}
                  {line.offeringId ? "" : " · one-off item"}
                  {" · "}
                  {formatTemplateOfferingPrice(line)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(line)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void onRemove(line.id)}>
                  Remove
                </Button>
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

function AdvancedSettings({
  template,
  section,
  addOns,
  catalogOfferings,
  onPersist,
  onAddAddOn,
  onEditAddOn,
  onRemoveAddOn,
}: {
  template: EventOrderTemplateWithDetails;
  section: EventOrderTemplateSection;
  addOns: EventOrderTemplateLine[];
  catalogOfferings: OfferingWithCategory[];
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
  onAddAddOn: () => void;
  onEditAddOn: (line: EventOrderTemplateLine) => void;
  onRemoveAddOn: (lineId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <details
      className="rounded-md border border-border bg-card px-4 py-3 text-sm"
      data-testid={`eo-specialist-selection-rules-${section.id}`}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-medium text-heading">Advanced settings</summary>
      {open ? (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Staff-only extras, floor-plan defaults, and specialized limits.
          </p>
          <SectionFloorPlanDefault templateId={template.id} section={section} onPersist={onPersist} />
          <div className="space-y-2" data-testid={`eo-guided-step-addons-${section.id}`}>
            <h3 className="text-sm font-medium text-heading">Staff-only extras</h3>
            <p className="text-xs text-muted-foreground">
              Extra items billed on top of the package when you apply this template. These are not
              client selections.
            </p>
            <TemplateLinesBlock
              lines={addOns}
              addTestId={`eo-add-addon-${section.id}`}
              addLabel="Add extra item"
              includedLabel="Staff-only extra"
              onAdd={onAddAddOn}
              onEdit={onEditAddOn}
              onRemove={onRemoveAddOn}
            />
          </div>
          <EventOrderTemplateChoiceGroups
            template={template}
            catalogOfferings={catalogOfferings}
            onPersist={onPersist}
            lockedSectionId={section.id}
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
