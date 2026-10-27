"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateSectionAction,
  removeEventOrderTemplateSectionAction,
  addEventOrderTemplateLineAction,
  removeEventOrderTemplateLineAction,
  updateEventOrderTemplateLineAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { ConditionalChoicePreview } from "@/components/event-order-templates/event-order-template-choice-groups";
import { EventOrderTemplateChoiceGroups } from "@/components/event-order-templates/event-order-template-choice-groups";
import { OfferingEditorSheet } from "@/components/event-order-templates/offering-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SUGGESTED_CATEGORIES,
  buildReviewSummary,
  canonicalSectionNameForSuggested,
  matchSuggestedCategory,
  selectedCategoryKeysFromTemplate,
  type CategoryConfigureSubstep,
  type SuggestedCategoryKey,
  type WizardPhase,
} from "@/lib/event-order-templates/guided-setup";
import { formatTemplateOfferingPrice, linesForSection } from "@/lib/event-order-templates/offerings";
import { groupsForSection, rootGroupsInList } from "@/lib/event-order-templates/section-workspace";
import type {
  AddTemplateLineInput,
  EventOrderTemplateLine,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

type Props = {
  template: EventOrderTemplateWithDetails;
  catalogOfferings?: OfferingWithCategory[];
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
};

export function GuidedSetupWizard({
  template,
  catalogOfferings = [],
  onPersist,
}: Props) {
  const router = useRouter();
  const existing = selectedCategoryKeysFromTemplate(template.sections);
  const [phase, setPhase] = React.useState<WizardPhase>(() =>
    template.sections.length === 0 ? "categories" : "configure",
  );
  const [suggestedSelected, setSuggestedSelected] = React.useState<SuggestedCategoryKey[]>(
    () => existing.suggested,
  );
  const [customNames, setCustomNames] = React.useState<string[]>(() => existing.customNames);
  const [customDraft, setCustomDraft] = React.useState("");
  const [categoryIndex, setCategoryIndex] = React.useState(0);
  const [substep, setSubstep] = React.useState<CategoryConfigureSubstep>("workspace");
  const [pending, startTransition] = React.useTransition();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingLine, setEditingLine] = React.useState<EventOrderTemplateLine | null>(null);
  const [editorPending, startEditor] = React.useTransition();
  const [specialistOpen, setSpecialistOpen] = React.useState(false);

  const sectionsOrdered = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeSection = sectionsOrdered[categoryIndex] ?? null;

  React.useEffect(() => {
    if (categoryIndex >= sectionsOrdered.length && sectionsOrdered.length > 0) {
      setCategoryIndex(sectionsOrdered.length - 1);
    }
  }, [categoryIndex, sectionsOrdered.length]);

  function toggleSuggested(key: SuggestedCategoryKey) {
    setSuggestedSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function addCustomCategory() {
    const name = customDraft.trim();
    if (!name) return;
    if (customNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      toast.error("That category is already listed.");
      return;
    }
    if (SUGGESTED_CATEGORIES.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Use the suggested card for that category instead.");
      return;
    }
    setCustomNames((prev) => [...prev, name]);
    setCustomDraft("");
  }

  async function syncCategoriesAndContinue() {
    const desiredNames = [
      ...suggestedSelected.map((k) => canonicalSectionNameForSuggested(k)).filter(Boolean),
      ...customNames,
    ];
    const desiredNorm = new Set(desiredNames.map((n) => n.toLowerCase()));

    const toRemove = sectionsOrdered.filter((s) => {
      const match = matchSuggestedCategory(s.name);
      if (match && suggestedSelected.includes(match.key)) return false;
      if (customNames.some((n) => n.toLowerCase() === s.name.toLowerCase())) return false;
      if (desiredNorm.has(s.name.toLowerCase())) return false;
      return true;
    });

    for (const s of toRemove) {
      const hasContent =
        linesForSection(template.lines, s.id).length > 0
        || groupsForSection(template.groups, s.id).length > 0;
      const msg = hasContent
        ? `Remove “${s.name}” and its configured items from this template? Event Orders already created are not changed.`
        : `Remove “${s.name}” from this template setup?`;
      if (!confirm(msg)) return;
    }

    startTransition(async () => {
      onPersist("saving");
      for (const s of toRemove) {
        const r = await removeEventOrderTemplateSectionAction(template.id, s.id);
        if (!r.ok) {
          onPersist("error", r.message ?? "Could not remove category.");
          return;
        }
      }
      for (const name of desiredNames) {
        const exists = template.sections.some(
          (s) => s.name.toLowerCase() === name.toLowerCase()
            || matchSuggestedCategory(s.name)?.name.toLowerCase() === name.toLowerCase(),
        );
        const aliasExists = template.sections.some((s) => {
          const m = matchSuggestedCategory(s.name);
          const want = matchSuggestedCategory(name);
          return Boolean(m && want && m.key === want.key);
        });
        if (exists || aliasExists) continue;
        const r = await addEventOrderTemplateSectionAction(template.id, name, null);
        if (!r.ok) {
          onPersist("error", r.message ?? "Could not add category.");
          return;
        }
      }
      onPersist("saved");
      setCategoryIndex(0);
      setSubstep("workspace");
      setPhase(desiredNames.length === 0 ? "review" : "configure");
      router.refresh();
    });
  }

  function goNextCategory() {
    if (categoryIndex >= sectionsOrdered.length - 1) {
      setPhase("review");
      return;
    }
    setCategoryIndex((i) => i + 1);
    setSubstep("workspace");
  }

  function advanceFromWorkspace() {
    if (!activeSection) return;
    const roots = rootGroupsInList(groupsForSection(template.groups, activeSection.id));
    const emptyRoot = roots.find(
      (g) => template.options.filter((o) => o.groupId === g.id).length === 0,
    );
    if (emptyRoot) {
      toast.error(`Add at least one option to “${emptyRoot.name}” before continuing.`);
      return;
    }
    goNextCategory();
  }

  function goBack() {
    if (phase === "preview") {
      setPhase("review");
      return;
    }
    if (phase === "review") {
      if (sectionsOrdered.length === 0) {
        setPhase("categories");
        return;
      }
      setPhase("configure");
      setCategoryIndex(Math.max(0, sectionsOrdered.length - 1));
      setSubstep("workspace");
      return;
    }
    if (phase === "configure" && activeSection) {
      if (categoryIndex > 0) {
        setCategoryIndex((i) => i - 1);
        setSubstep("workspace");
      } else {
        setPhase("categories");
      }
      return;
    }
    setPhase("categories");
  }

  async function persistLine(input: AddTemplateLineInput) {
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

  const review = buildReviewSummary(template);
  const progressLabel = (() => {
    if (phase === "categories") return "What you offer";
    if (phase === "configure" && activeSection) {
      const catN = categoryIndex + 1;
      const catTotal = sectionsOrdered.length || 1;
      return `Category ${catN} of ${catTotal}: ${activeSection.name}`;
    }
    if (phase === "review") return "Review complete setup";
    return "Preview client experience";
  })();

  return (
    <div className="space-y-6" data-testid="eo-guided-setup-wizard">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Event Order package setup
        </p>
        <p className="mt-1 text-sm font-medium text-heading" data-testid="eo-guided-progress">
          {progressLabel}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what the package includes, then configure each category in place — included items,
          couple choices, and follow-ups under each option. Specialist rules stay available for unusual
          cases.
        </p>
      </div>

      {phase === "categories" ? (
        <section className="space-y-4" data-testid="eo-guided-step-categories">
          <div>
            <h2 className="font-heading text-xl text-heading">What does this package include?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select the commercial categories you provide through this Event Order. Skip categories you
              do not manage — for example, outside catering or bar. You will configure included items and
              couple choices inside each category next.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {SUGGESTED_CATEGORIES.map((cat) => {
              const on = suggestedSelected.includes(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  data-testid={`eo-guided-category-${cat.key}`}
                  aria-pressed={on}
                  onClick={() => toggleSuggested(cat.key)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    on
                      ? "border-heading bg-heading/5 ring-1 ring-heading"
                      : "border-border bg-background hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-heading">{cat.name}</p>
                    {on ? <Check className="h-4 w-4 shrink-0 text-heading" /> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                </button>
              );
            })}
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
            <Label>Other / custom category</Label>
            <p className="text-xs text-muted-foreground">
              Add a category you define yourself (for example a specialty service).
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                placeholder="Category name"
                data-testid="eo-guided-custom-category-input"
              />
              <Button type="button" variant="outline" onClick={addCustomCategory} data-testid="eo-guided-custom-category-add">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {customNames.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {customNames.map((n) => (
                  <li key={n}>
                    <Badge variant="secondary" className="gap-2">
                      {n}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setCustomNames((prev) => prev.filter((x) => x !== n))}
                      >
                        Remove
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="ghost" disabled>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              disabled={pending}
              data-testid="eo-guided-categories-continue"
              onClick={() => void syncCategoriesAndContinue()}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "configure" && activeSection ? (
        <section className="space-y-4" data-testid={`eo-guided-configure-${activeSection.id}`}>
          <div className="flex flex-wrap gap-2">
            {sectionsOrdered.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  i === categoryIndex
                    ? "border-heading bg-heading text-background"
                    : i < categoryIndex
                      ? "border-border bg-muted/40 text-heading"
                      : "border-border text-muted-foreground"
                }`}
                onClick={() => {
                  setCategoryIndex(i);
                  setSubstep("workspace");
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          {substep === "workspace" ? (
            <div className="space-y-8" data-testid="eo-guided-step-workspace">
              <div>
                <h2 className="font-heading text-xl text-heading">
                  Set up {activeSection.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add items included automatically, then the main choices couples make. Follow-up
                  categories belong under each option — for example sides under Buffet and entrée under
                  Plated dinner. Set how many they must choose right on each category.
                </p>
              </div>

              <div className="space-y-4" data-testid="eo-guided-step-fixed">
                <h3 className="font-heading text-lg text-heading">
                  Included in {activeSection.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Clients receive these as part of the package. They do not need to select them.
                </p>
                <div
                  className="space-y-2 rounded-md border border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground"
                  data-testid="eo-guided-item-source-help"
                >
                  <p>
                    <span className="font-medium text-heading">Offerings</span> — reusable products and
                    services you sell across event orders.
                  </p>
                  <p>
                    <span className="font-medium text-heading">Inventory</span> — tracks physical items.
                    It is not a source for lines here.
                  </p>
                  <p>
                    <span className="font-medium text-heading">Custom / template-only</span> — add an item
                    only on this template when you do not need it in Offerings.
                  </p>
                  <p>
                    Linking an Offering to Inventory elsewhere does not reserve stock or guarantee
                    availability.
                  </p>
                </div>
                <FixedLinesPanel
                  template={template}
                  sectionId={activeSection.id}
                  onEdit={(line) => {
                    setEditingLine(line);
                    setEditorOpen(true);
                  }}
                  onAdd={() => {
                    setEditingLine(null);
                    setEditorOpen(true);
                  }}
                  onRemove={async (lineId) => {
                    onPersist("saving");
                    const r = await removeEventOrderTemplateLineAction(template.id, lineId);
                    if (!r.ok) onPersist("error", r.message);
                    else {
                      onPersist("saved");
                      router.refresh();
                    }
                  }}
                />
              </div>

              <div className="space-y-4" data-testid="eo-guided-step-choices">
                <h3 className="font-heading text-lg text-heading">
                  Choices for {activeSection.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Add major choices from your Offerings catalog for this category (the styles or
                  packages you actually sell). Under each major choice, add follow-up menu categories
                  and associated catalog items — not a second generic “choices” question.
                </p>
                <EventOrderTemplateChoiceGroups
                  template={template}
                  catalogOfferings={catalogOfferings}
                  onPersist={onPersist}
                  lockedSectionId={activeSection.id}
                  compact
                  showPreview={false}
                  nestBranches
                  guidedOrdinary
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={goBack} data-testid="eo-guided-back">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              disabled={pending}
              data-testid="eo-guided-continue"
              onClick={() => advanceFromWorkspace()}
            >
              Continue
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {phase === "review" ? (
        <section className="space-y-4" data-testid="eo-guided-step-review">
          <h2 className="font-heading text-xl text-heading">Review your complete setup</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Included items, primary choices, follow-ups under the option that triggers them, and optional
            extras. Return to a category to edit.
          </p>
          {review.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No categories selected. Clients will not see commercial category choices from this
              template until you add some.
            </p>
          ) : null}
          {review.map((cat) => (
            <div key={cat.sectionId} className="rounded-lg border border-border p-4 space-y-3" data-testid={`eo-guided-review-${cat.sectionId}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-heading text-lg text-heading">{cat.name}</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const idx = sectionsOrdered.findIndex((s) => s.id === cat.sectionId);
                    if (idx >= 0) {
                      setCategoryIndex(idx);
                      setSubstep("workspace");
                      setPhase("configure");
                    }
                  }}
                >
                  Edit category
                </Button>
              </div>
              {cat.incompleteMessages.map((m) => (
                <p key={m} className="text-sm text-amber-800" data-testid="eo-guided-review-warning">
                  {m} — use Edit category to finish this configuration.
                </p>
              ))}
              {cat.fixedLines.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Included items and services
                  </p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {cat.fixedLines.map((l) => (
                      <li key={l.id}>
                        {l.description}
                        {l.included ? " · included (not an extra charge)" : ""}
                        {l.catalog ? " · Offering" : " · template-only"}
                        {!l.included && l.price != null ? ` · $${l.price}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {cat.groups.map((g) => (
                <ReviewGroupBlock key={g.id} group={g} depth={0} />
              ))}
              {cat.previewPathHint ? (
                <p className="text-xs text-muted-foreground" data-testid={`eo-guided-review-path-${cat.sectionId}`}>
                  {cat.previewPathHint}
                </p>
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setPhase("categories")}>
                Change categories
              </Button>
              <Button type="button" data-testid="eo-guided-goto-preview" onClick={() => setPhase("preview")}>
                Preview client experience
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {phase === "preview" ? (
        <section className="space-y-4" data-testid="eo-guided-step-preview">
          <h2 className="font-heading text-xl text-heading">Preview the client experience</h2>
          <p className="text-sm text-muted-foreground">
            Interactive preview of the saved template. Try paths such as{" "}
            <span className="font-medium text-heading">Catering → Plated Dinner → Entrée choice</span>.
            This preview does not send an Event Order to a client and does not finalize anything.
          </p>
          <p
            className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
            data-testid="eo-guided-preview-non-sending"
          >
            Preview only — no send, no finalize.
          </p>
          {review.some((c) => c.incompleteMessages.length > 0) ? (
            <p className="rounded-md border border-amber-600/40 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="eo-guided-preview-incomplete">
              Some follow-up lists are still empty. Return to setup to finish them or remove empty branches
              so clients do not see incomplete choices. Incomplete configuration does not block this
              preview, and preview still does not send or finalize.
            </p>
          ) : null}
          <div className="rounded-lg border border-border p-4" data-testid="eo-template-client-preview">
            <ConditionalChoicePreview template={template} />
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline" onClick={goBack} data-testid="eo-guided-preview-back">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to review
            </Button>
            <Button
              type="button"
              variant="outline"
              render={<Link href={`/library/event-order-templates/${template.id}/preview`} />}
            >
              Full-page preview
            </Button>
          </div>
        </section>
      ) : null}

      <OfferingEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        sectionId={activeSection?.id ?? null}
        sectionName={activeSection?.name ?? null}
        line={editingLine}
        catalogOfferings={catalogOfferings}
        pending={editorPending}
        onSave={persistLine}
      />

      {phase !== "preview" ? (
        <details
          className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground"
          data-testid="eo-specialist-selection-rules"
          open={specialistOpen}
          onToggle={(e) => setSpecialistOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer font-medium text-heading">Specialist selection rules</summary>
          <p className="mt-2 mb-3">
            Unusual cross-group relationships, unassigned groups, and other specialist controls. Ordinary
            included items, primary choices, and under-option follow-ups do not require this section.
          </p>
          {specialistOpen && activeSection ? (
            <EventOrderTemplateChoiceGroups
              template={template}
              catalogOfferings={catalogOfferings}
              onPersist={onPersist}
              lockedSectionId={activeSection.id}
              compact
              showPreview={false}
              nestBranches
              specialistMode
            />
          ) : specialistOpen ? (
            <p>Select or create a category first.</p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

function ReviewGroupBlock({
  group,
  depth,
}: {
  group: ReturnType<typeof buildReviewSummary>[number]["groups"][number];
  depth: number;
}) {
  return (
    <div
      className={`rounded-md border border-border/70 p-3 text-sm ${depth > 0 ? "ml-3 border-l-4 border-l-heading/25" : ""}`}
      data-testid={`eo-guided-review-group-${group.id}`}
      data-dependent={group.isDependent ? "true" : "false"}
    >
      <p className="font-medium text-heading">
        {depth > 0 ? "Follow-up: " : ""}
        {group.name}
        {group.incomplete ? " — incomplete" : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        {group.selectionMode === "single" ? "Choose one" : "Choose multiple"}
        {group.required ? " · required" : " · optional"}
        {group.dependsOnLabels.length > 0
          ? ` · shown after: ${group.dependsOnLabels.join(", ")}`
          : ""}
      </p>
      <ul className="mt-1 space-y-2">
        {group.options.map((o) => (
          <li key={o.id}>
            <span>
              {o.label}
              {o.isIncluded
                ? " · included"
                : o.unitPrice != null
                  ? ` · additional $${o.unitPrice}`
                  : ""}
              {o.catalog ? " · Offering" : " · template-only"}
            </span>
            {o.followUps.length > 0 ? (
              <div className="mt-2 space-y-2">
                {o.followUps.map((fu) => (
                  <ReviewGroupBlock key={fu.id} group={fu} depth={depth + 1} />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FixedLinesPanel({
  template,
  sectionId,
  onEdit,
  onAdd,
  onRemove,
}: {
  template: EventOrderTemplateWithDetails;
  sectionId: string;
  onEdit: (line: EventOrderTemplateLine) => void;
  onAdd: () => void;
  onRemove: (lineId: string) => void | Promise<void>;
}) {
  const offerings = linesForSection(template.lines, sectionId);
  return (
    <div className="space-y-3">
      {offerings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No included items yet.</p>
      ) : (
        offerings.map((line) => (
          <div key={line.id} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium text-heading">{line.description}</p>
            <p className="text-xs text-muted-foreground">
              {line.offeringId ? "From catalog" : "Template-only"} · {formatTemplateOfferingPrice(line)}
            </p>
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onEdit(line)}>Edit</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void onRemove(line.id)}>Remove</Button>
            </div>
          </div>
        ))
      )}
      <Button type="button" size="sm" variant="outline" onClick={onAdd} data-testid={`eo-add-offering-${sectionId}`}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add included item
      </Button>
    </div>
  );
}
