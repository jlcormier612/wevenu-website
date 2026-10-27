"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  addEventOrderTemplateGroupAction,
  addEventOrderTemplateSectionAction,
  removeEventOrderTemplateGroupAction,
  removeEventOrderTemplateSectionAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { ConditionalChoicePreview } from "@/components/event-order-templates/event-order-template-choice-groups";
import { EventOrderTemplateChoiceGroups } from "@/components/event-order-templates/event-order-template-choice-groups";
import { OfferingEditorSheet } from "@/components/event-order-templates/offering-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONFIG_PATTERNS,
  SUGGESTED_CATEGORIES,
  branchGuideForSection,
  buildReviewSummary,
  canonicalSectionNameForSuggested,
  defaultGroupInputForPattern,
  emptyDependentGroupInput,
  matchSuggestedCategory,
  nextConfigureSubstep,
  patternsPayloadFromDrafts,
  prevConfigureSubstep,
  sectionNeedsChoiceConfiguration,
  seedPatternDraftsFromTemplate,
  selectedCategoryKeysFromTemplate,
  togglePatternInDraft,
  type CategoryConfigureSubstep,
  type ConfigPatternId,
  type PatternDraftBySection,
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
import {
  addEventOrderTemplateLineAction,
  removeEventOrderTemplateLineAction,
  updateEventOrderTemplateLineAction,
} from "@/app/(app)/library/event-order-templates/actions";
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
  const [substep, setSubstep] = React.useState<CategoryConfigureSubstep>("patterns");
  const [patternDraftBySection, setPatternDraftBySection] = React.useState<PatternDraftBySection>(
    () =>
      seedPatternDraftsFromTemplate(
        template,
        [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id),
        {},
      ),
  );
  const [pending, startTransition] = React.useTransition();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingLine, setEditingLine] = React.useState<EventOrderTemplateLine | null>(null);
  const [editorPending, startEditor] = React.useTransition();

  const sectionsOrdered = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const sectionIdsKey = sectionsOrdered.map((s) => s.id).join("|");
  const activeSection = sectionsOrdered[categoryIndex] ?? null;
  const patternDraft: ConfigPatternId[] = activeSection
    ? (patternDraftBySection[activeSection.id] ?? [])
    : [];
  /** All categories' pattern picks — used when Continue must include every section. */
  const allCategoryPatternPayload = patternsPayloadFromDrafts(
    patternDraftBySection,
    sectionsOrdered.map((s) => s.id),
  );

  React.useEffect(() => {
    const ids = sectionIdsKey.length > 0 ? sectionIdsKey.split("|") : [];
    // seedPatternDraftsFromTemplate never overwrites an existing section draft, so
    // template refreshes and category tab changes cannot discard unpersisted picks.
    setPatternDraftBySection((prev) => seedPatternDraftsFromTemplate(template, ids, prev));
  }, [sectionIdsKey, template]);

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
      // Keep if name is in desired list (canonical rename edge)
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
        // Also treat alias match as exists (e.g. section "Bar" for "Bar Service")
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
      setSubstep("patterns");
      setPhase(desiredNames.length === 0 ? "review" : "configure");
      router.refresh();
    });
  }

  function togglePattern(id: ConfigPatternId) {
    if (!activeSection) return;
    setPatternDraftBySection((prev) => togglePatternInDraft(prev, activeSection.id, id));
  }

  async function ensureRootGroupForPatterns() {
    if (!activeSection) return true;
    const needsChoice = sectionNeedsChoiceConfiguration(patternDraft);
    if (!needsChoice) return true;
    const roots = rootGroupsInList(groupsForSection(template.groups, activeSection.id));
    if (roots.length > 0) return true;
    const pattern =
      patternDraft.find((p) => p === "choose_one")
      ?? patternDraft.find((p) => p === "choose_many")
      ?? patternDraft.find((p) => p === "optional_add");
    if (!pattern) return true;
    const input = defaultGroupInputForPattern(pattern, activeSection.id, activeSection.name);
    if (!input) return true;
    onPersist("saving");
    const r = await addEventOrderTemplateGroupAction(template.id, input);
    if (!r.ok) {
      onPersist("error", r.message ?? "Could not create choice group.");
      return false;
    }
    onPersist("saved");
    router.refresh();
    return true;
  }

  async function advanceFromSubstep() {
    if (!activeSection) return;
    if (substep === "patterns") {
      if (patternDraft.length === 0) {
        toast.error(
          `Select at least one way clients will experience ${activeSection.name}, or go back and skip the category.`,
        );
        return;
      }
      const next = nextConfigureSubstep("patterns", patternDraft);
      if (next === "done") {
        goNextCategory();
        return;
      }
      if (next === "choices" || next === "branches") {
        const ok = await ensureRootGroupForPatterns();
        if (!ok) return;
      }
      setSubstep(next);
      return;
    }
    if (substep === "fixed") {
      const next = nextConfigureSubstep("fixed", patternDraft);
      if (next === "done") {
        goNextCategory();
        return;
      }
      if (next === "choices" || next === "branches") {
        const ok = await ensureRootGroupForPatterns();
        if (!ok) return;
      }
      setSubstep(next);
      return;
    }
    if (substep === "choices") {
      const roots = rootGroupsInList(groupsForSection(template.groups, activeSection.id));
      const emptyRoot = roots.find(
        (g) => template.options.filter((o) => o.groupId === g.id).length === 0,
      );
      if (emptyRoot) {
        toast.error(`Add at least one option to “${emptyRoot.name}” before continuing.`);
        return;
      }
      const next = nextConfigureSubstep("choices", patternDraft);
      if (next === "done") {
        goNextCategory();
        return;
      }
      setSubstep(next);
      return;
    }
    if (substep === "branches") {
      goNextCategory();
    }
  }

  function goNextCategory() {
    if (categoryIndex >= sectionsOrdered.length - 1) {
      setPhase("review");
      return;
    }
    setCategoryIndex((i) => i + 1);
    setSubstep("patterns");
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
      setSubstep("patterns");
      return;
    }
    if (phase === "configure" && activeSection) {
      const prev = prevConfigureSubstep(substep, patternDraft);
      if (prev === "categories") {
        if (categoryIndex > 0) {
          setCategoryIndex((i) => i - 1);
          setSubstep("patterns");
        } else {
          setPhase("categories");
        }
        return;
      }
      setSubstep(prev);
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

  async function removeEmptyDependent(groupId: string, name: string) {
    if (!confirm(`Remove empty follow-up “${name}”? Clients will not see a branch for this parent.`)) {
      return;
    }
    onPersist("saving");
    const r = await removeEventOrderTemplateGroupAction(template.id, groupId);
    if (!r.ok) onPersist("error", r.message ?? "Could not remove.");
    else {
      onPersist("saved");
      router.refresh();
    }
  }

  async function addFollowUpForOption(optionId: string) {
    if (!activeSection) return;
    const option = template.options.find((o) => o.id === optionId);
    if (!option) return;
    const existing = branchGuideForSection(template, activeSection.id)
      .find((b) => b.optionId === optionId);
    if (existing && existing.dependents.length > 0) {
      toast.message("Follow-up choices already exist for this option.");
      return;
    }
    onPersist("saving");
    const r = await addEventOrderTemplateGroupAction(
      template.id,
      emptyDependentGroupInput(activeSection.id, option),
    );
    if (!r.ok) onPersist("error", r.message ?? "Could not create follow-up group.");
    else {
      onPersist("saved");
      router.refresh();
    }
  }

  const review = buildReviewSummary(template);
  const progressLabel = (() => {
    if (phase === "categories") return "Step 1 of 7 — What you offer";
    if (phase === "configure" && activeSection) {
      const catN = categoryIndex + 1;
      const catTotal = sectionsOrdered.length || 1;
      const subLabels: Record<CategoryConfigureSubstep, string> = {
        patterns: "How clients choose",
        fixed: "Included items",
        choices: "Main choices",
        branches: "Follow-up choices",
      };
      return `Category ${catN}/${catTotal}: ${activeSection.name} — ${subLabels[substep]}`;
    }
    if (phase === "review") return "Review complete setup";
    return "Preview client experience";
  })();

  return (
    <div
      className="space-y-6"
      data-testid="eo-guided-setup-wizard"
      data-pattern-payload={JSON.stringify(allCategoryPatternPayload)}
    >
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Guided Event Order setup
        </p>
        <p className="mt-1 text-sm font-medium text-heading" data-testid="eo-guided-progress">
          {progressLabel}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer plain questions about what you offer and how clients choose. Ordinary setup stays in
          these steps — specialist selection rules are only for unusual cases.
        </p>
      </div>

      {phase === "categories" ? (
        <section className="space-y-4" data-testid="eo-guided-step-categories">
          <div>
            <h2 className="font-heading text-xl text-heading">What does your venue offer?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select only the commercial categories you provide or want clients to configure through
              this Event Order. Skip categories you do not manage — for example, outside catering or
              bar. Skipping does not block other Event Order features.
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
              Add a category you define yourself (for example a specialty service). It is not forced into
              Catering, Bar, Rentals, or Services.
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
                  setSubstep("patterns");
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          {substep === "patterns" ? (
            <div className="space-y-4" data-testid="eo-guided-step-patterns">
              <h2 className="font-heading text-xl text-heading">
                How should clients make their selections?
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose what clients need to select, what they receive automatically, and which
                additional choices or questions appear along the way. Pick every pattern that applies
                for {activeSection.name} — patterns can be combined.
              </p>
              <div className="space-y-2">
                {CONFIG_PATTERNS.map((p) => {
                  const on = patternDraft.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`eo-guided-pattern-${p.id}`}
                      aria-pressed={on}
                      onClick={() => togglePattern(p.id)}
                      className={`w-full rounded-lg border p-4 text-left ${
                        on ? "border-heading bg-heading/5" : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-heading">{p.title}</p>
                        {on ? <Check className="h-4 w-4 text-heading" /> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{p.clientExperience}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {substep === "fixed" ? (
            <div className="space-y-4" data-testid="eo-guided-step-fixed">
              <h2 className="font-heading text-xl text-heading">
                Included items for {activeSection.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Clients receive these items or services as part of their package. They don&apos;t need
                to select them — and they are not presented as optional extras.
              </p>
              <div
                className="space-y-2 rounded-md border border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground"
                data-testid="eo-guided-item-source-help"
              >
                <p>
                  <span className="font-medium text-heading">Offerings</span> — products and services
                  your venue provides or sells, such as catering packages, bar service, rentals, and
                  upgrades. You can use the same Offering in multiple event orders.
                </p>
                <p>
                  <span className="font-medium text-heading">Inventory</span> — tracks physical items
                  your venue owns or manages, such as chairs, tables, and ceremony arbors. Inventory
                  can support floor plan placement and usage reporting. It is not a source for lines
                  here.
                </p>
                <p>
                  <span className="font-medium text-heading">Custom / template-only line</span> — add an
                  item or service directly to this event order when you don&apos;t need it in your
                  reusable Offerings list.
                </p>
                <p>
                  Linking an Offering to Inventory (elsewhere) does not reserve stock or guarantee
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
          ) : null}

          {substep === "choices" ? (
            <div className="space-y-4" data-testid="eo-guided-step-choices">
              <h2 className="font-heading text-xl text-heading">
                Main client-facing choices — {activeSection.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Define the options clients see first. Select a reusable Offering or add a custom /
                template-only option. Prices come from your catalog or what you enter — we never invent
                them. Additional prices for optional extras must be visible before a client chooses.
              </p>
              {patternDraft.includes("choose_one") ? (
                <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  After you add primary options (for example Plated Dinner and Buffet Dinner), the next
                  step asks what happens when a client selects each option — including follow-up choices
                  that appear only for that option.
                </p>
              ) : null}
              <EventOrderTemplateChoiceGroups
                template={template}
                catalogOfferings={catalogOfferings}
                onPersist={onPersist}
                lockedSectionId={activeSection.id}
                compact
                showPreview={false}
                nestBranches={false}
                rootsOnly
                guidedOrdinary
              />
            </div>
          ) : null}

          {substep === "branches" ? (
            <div className="space-y-4" data-testid="eo-guided-step-branches">
              <h2 className="font-heading text-xl text-heading">
                Follow-up choices for {activeSection.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                For each primary option, choose what happens next. Follow-up lists appear only when that
                option is selected — for example, plated entrée choices after Plated Dinner, not after
                Buffet Dinner.
              </p>
              {branchGuideForSection(template, activeSection.id).map((branch) => (
                <div
                  key={branch.optionId}
                  className="rounded-lg border border-border p-4 space-y-3"
                  data-testid={`eo-guided-branch-${branch.optionId}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-heading">
                        What happens when a client selects this option?
                      </p>
                      <p className="text-sm text-heading">“{branch.optionLabel}”</p>
                      <p className="text-xs text-muted-foreground">From “{branch.parentGroupName}”</p>
                    </div>
                    {branch.incomplete ? (
                      <Badge variant="outline" className="border-amber-600 text-amber-800">
                        Incomplete
                      </Badge>
                    ) : null}
                  </div>
                  {branch.dependents.length === 0 ? (
                    <div className="flex flex-wrap gap-2" data-testid={`eo-guided-followup-actions-${branch.optionId}`}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        data-testid={`eo-guided-followup-none-${branch.optionId}`}
                      >
                        Nothing else — this is a complete choice.
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`eo-guided-add-followup-${branch.optionId}`}
                        onClick={() => void addFollowUpForOption(branch.optionId)}
                      >
                        Show additional options.
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Showing additional options when the client selects “{branch.optionLabel}”.
                      </p>
                      {branch.dependents.map((d) => {
                        const optCount = template.options.filter((o) => o.groupId === d.id).length;
                        return (
                          <div key={d.id} className="rounded-md border border-border/80 p-3">
                            <p className="text-sm font-medium text-heading">{d.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Triggered by “{branch.optionLabel}”
                              {optCount === 0
                                ? " — no options yet. Add options below or remove this follow-up."
                                : ` · ${optCount} option(s)`}
                            </p>
                            {optCount === 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="mt-2"
                                onClick={() => void removeEmptyDependent(d.id, d.name)}
                              >
                                Remove empty follow-up
                              </Button>
                            ) : null}
                          </div>
                        );
                      })}
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
                  )}
                </div>
              ))}
              {branchGuideForSection(template, activeSection.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add main choices in the previous step before configuring follow-ups.
                </p>
              ) : null}
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
              onClick={() => void advanceFromSubstep()}
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
          <p className="text-sm text-muted-foreground">
            Organized in the order a client will encounter each commercial category. Included items,
            primary choices, follow-ups under the option that triggers them, and optional extras with
            their additional prices. This reflects saved server state — unsaved pattern drafts are not
            shown as persisted. Return to a category to edit.
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
                      setSubstep("patterns");
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
            Interactive preview of the saved template. Try commercial-category paths such as{" "}
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

      {/* Specialist controls only — ordinary setup lives in guided steps above */}
      <details
        className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground"
        data-testid="eo-specialist-selection-rules"
      >
        <summary className="cursor-pointer font-medium text-heading">Specialist selection rules</summary>
        <p className="mt-2 mb-3">
          Unusual cross-group relationships, unassigned groups, and other specialist controls. You can
          complete ordinary included items, primary choices, follow-ups, and optional extras without
          opening this section.
        </p>
        {activeSection ? (
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
        ) : (
          <p>Select or create a category in Step 1 first.</p>
        )}
      </details>
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
