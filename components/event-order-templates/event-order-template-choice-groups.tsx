"use client";

/**
 * Choice groups / options authoring for Event Order Templates
 * (commercial build sheet — absorbs Choices Template authoring).
 * Increment 1: depends_on_option_ids authoring + conditional preview.
 * Increment 2: explicit Offering attach / clear on existing options.
 */
import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  addEventOrderTemplateGroupAction,
  addEventOrderTemplateOptionAction,
  removeEventOrderTemplateGroupAction,
  removeEventOrderTemplateOptionAction,
  updateEventOrderTemplateGroupAction,
  updateEventOrderTemplateOptionAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { CategorizedOfferingSelect } from "@/components/event-order-templates/categorized-offering-select";
import { ChoicesDefinitionView } from "@/components/client-choices/choices-definition-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import {
  attachOfferingPreservingSnapshot,
  choicesOptionDraftFromOffering,
  clearOfferingLinkPreservingSnapshot,
  optionCatalogLinkStatus,
  offeringsAvailableForAttach,
  updateOptionFieldsPreservingOfferingLink,
} from "@/lib/client-choices-templates/option-catalog";
import {
  formatDependsOnSummary,
  isDependentGroup,
  parentOptionCandidates,
  sanitizeDependsOnOptionIds,
} from "@/lib/event-order-templates/group-dependencies";
import { optionsForGroup } from "@/lib/event-order-templates/offerings";
import {
  defaultAnswersFromEventOrderTemplate,
  selectionDefinitionFromEventOrderTemplate,
} from "@/lib/event-order-templates/selection-definition";
import {
  dependentGroupsForOption,
  groupsForSection,
  sectionCompletenessIssues,
} from "@/lib/event-order-templates/section-workspace";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

type OptionMode = "idle" | "catalog" | "custom";
type OptionPanel = "idle" | "link" | "edit";

function formatOptionPrice(o: { isIncluded: boolean; unitPrice: number | null }): string {
  if (o.isIncluded) return "Included";
  if (o.unitPrice != null) return `$${o.unitPrice.toFixed(2)}`;
  return "Unpriced";
}

function groupRulesLabel(g: EventOrderTemplateGroup): string {
  const mode = g.selectionMode === "single" ? "Pick one" : "Pick many";
  const req = g.minSelect > 0 ? "required" : "optional";
  const qty = g.allowQuantity ? " · quantities" : "";
  return `${mode} · ${req}${qty}`;
}

function DependsOnPicker({
  candidates,
  selectedIds,
  onChange,
  disabled,
  idPrefix,
}: {
  candidates: ReturnType<typeof parentOptionCandidates>;
  selectedIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const selected = new Set(selectedIds);
  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add options to another group first, then you can make this group appear only when one of those options is chosen.
      </p>
    );
  }
  return (
    <div className="space-y-2" data-testid={`${idPrefix}-depends-on-picker`}>
      <p className="text-xs text-muted-foreground">
        Show this group only when the client selects at least one of these options (any selected option activates it). Leave unchecked to always show the group.
      </p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-border bg-muted/10 p-2">
        {candidates.map((c) => {
          const inputId = `${idPrefix}-dep-${c.id}`;
          const checked = selected.has(c.id);
          return (
            <li key={c.id}>
              <label htmlFor={inputId} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  id={inputId}
                  type="checkbox"
                  className="mt-0.5"
                  disabled={disabled}
                  checked={checked}
                  onChange={() => {
                    if (checked) onChange(selectedIds.filter((id) => id !== c.id));
                    else onChange([...selectedIds, c.id]);
                  }}
                />
                <span>
                  <span className="font-medium text-heading">{c.label}</span>
                  <span className="block text-[0.7rem] text-muted-foreground">{c.groupName}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ConditionalChoicePreview({
  template,
}: {
  template: EventOrderTemplateWithDetails;
}) {
  const definition = React.useMemo(
    () => selectionDefinitionFromEventOrderTemplate(template),
    [template],
  );
  const hasDeps = template.groups.some((g) => isDependentGroup(g));
  const [answers, setAnswers] = React.useState<ChoicesAnswers>(() =>
    defaultAnswersFromEventOrderTemplate(template),
  );

  React.useEffect(() => {
    setAnswers(defaultAnswersFromEventOrderTemplate(template));
  }, [template]);

  if (!hasDeps) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="eo-choice-preview-no-deps">
        No follow-up choices yet. When a primary option shows additional options, you can preview that
        reveal behavior here. Preview does not send or finalize an Event Order.
      </p>
    );
  }

  const rootGroups = [...template.groups]
    .filter((g) => !isDependentGroup(g))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function toggleOption(group: EventOrderTemplateGroup, optionId: string) {
    setAnswers((prev) => {
      const current = prev[group.id]?.optionIds ?? [];
      let nextIds: string[];
      if (group.selectionMode === "single") {
        nextIds = current.includes(optionId) ? [] : [optionId];
      } else if (current.includes(optionId)) {
        nextIds = current.filter((id) => id !== optionId);
      } else {
        nextIds = [...current, optionId];
      }
      return { ...prev, [group.id]: { optionIds: nextIds } };
    });
  }

  return (
    <div className="space-y-4" data-testid="eo-choice-conditional-preview">
      <p className="text-sm text-muted-foreground">
        Try parent selections below. Follow-up choices appear the same way they will for the client.
        This preview does not send or finalize an Event Order.
      </p>
      <div className="space-y-3 rounded-md border border-border bg-muted/10 p-3">
        {rootGroups.map((g) => {
          const opts = optionsForGroup(template.options, g.id);
          if (opts.length === 0) return null;
          const selected = new Set(answers[g.id]?.optionIds ?? []);
          return (
            <div key={g.id} className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {g.name}
              </p>
              <ul className="flex flex-wrap gap-2">
                {opts.map((o) => {
                  const on = selected.has(o.id);
                  return (
                    <li key={o.id}>
                      <Button
                        type="button"
                        size="sm"
                        variant={on ? "default" : "outline"}
                        aria-pressed={on}
                        data-testid={`eo-preview-parent-${o.id}`}
                        onClick={() => toggleOption(g, o.id)}
                      >
                        {o.label}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <ChoicesDefinitionView
        definition={definition}
        answers={answers}
        mode="preview"
        testId="eo-template-choices-preview"
      />
    </div>
  );
}

export function EventOrderTemplateChoiceGroups({
  template,
  catalogOfferings,
  onPersist,
  lockedSectionId,
  showUnassignedOnly = false,
  compact = false,
  showPreview = true,
  nestBranches = true,
  rootsOnly = false,
  guidedOrdinary = false,
  specialistMode = false,
}: {
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
  /** When set, only groups for this section are shown and new groups inherit it. */
  lockedSectionId?: string | null;
  /** Show only groups with no section assignment. */
  showUnassignedOnly?: boolean;
  compact?: boolean;
  showPreview?: boolean;
  /** Nest dependent groups under their parent options within this section. */
  nestBranches?: boolean;
  /** Guided “main choices” step — hide dependents until the branch step. */
  rootsOnly?: boolean;
  /** Ordinary guided flow — occasional settings under “More settings”. */
  guidedOrdinary?: boolean;
  /** Specialist selection rules — full dependency and unassigned tooling. */
  specialistMode?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [groupName, setGroupName] = React.useState("");
  const [groupSectionId, setGroupSectionId] = React.useState<string>(
    lockedSectionId ?? "",
  );
  const [groupMode, setGroupMode] = React.useState<"single" | "multi">("single");
  const [groupRequired, setGroupRequired] = React.useState(true);
  const [groupAllowQuantity, setGroupAllowQuantity] = React.useState(false);
  const [groupMaxSelect, setGroupMaxSelect] = React.useState("");
  const [groupDependsOn, setGroupDependsOn] = React.useState<string[]>([]);

  const [editingDepsGroupId, setEditingDepsGroupId] = React.useState<string | null>(null);
  const [editingDepsIds, setEditingDepsIds] = React.useState<string[]>([]);
  const [moreSettingsGroupId, setMoreSettingsGroupId] = React.useState<string | null>(null);
  const [moreRequired, setMoreRequired] = React.useState(true);
  const [moreMode, setMoreMode] = React.useState<"single" | "multi">("single");
  const [moreAllowQuantity, setMoreAllowQuantity] = React.useState(false);
  const [moreMaxSelect, setMoreMaxSelect] = React.useState("");

  React.useEffect(() => {
    if (lockedSectionId) setGroupSectionId(lockedSectionId);
    else if (showUnassignedOnly) setGroupSectionId("");
  }, [lockedSectionId, showUnassignedOnly]);

  const available = offeringsAvailableForAttach(catalogOfferings) as OfferingWithCategory[];
  const offeringById = React.useMemo(
    () => new Map(catalogOfferings.map((o) => [o.id, o])),
    [catalogOfferings],
  );

  const [optionMode, setOptionMode] = React.useState<OptionMode>("idle");
  const [optionGroupId, setOptionGroupId] = React.useState<string>("");
  const [optionOfferingId, setOptionOfferingId] = React.useState<string>("");
  const [optionLabel, setOptionLabel] = React.useState("");
  const [optionIncluded, setOptionIncluded] = React.useState(true);
  const [optionPrice, setOptionPrice] = React.useState("");
  const [optionDefault, setOptionDefault] = React.useState(false);

  const [optionPanel, setOptionPanel] = React.useState<OptionPanel>("idle");
  const [panelOptionId, setPanelOptionId] = React.useState<string>("");
  const [linkOfferingId, setLinkOfferingId] = React.useState("");
  const [editLabel, setEditLabel] = React.useState("");
  const [editIncluded, setEditIncluded] = React.useState(true);
  const [editPrice, setEditPrice] = React.useState("");
  const [editDefault, setEditDefault] = React.useState(false);

  const lockedSectionName = lockedSectionId
    ? template.sections.find((s) => s.id === lockedSectionId)?.name ?? null
    : null;
  const optionGroupSectionName = React.useMemo(() => {
    const g = template.groups.find((x) => x.id === optionGroupId);
    if (!g?.sectionId) return lockedSectionName;
    return template.sections.find((s) => s.id === g.sectionId)?.name ?? lockedSectionName;
  }, [template.groups, template.sections, optionGroupId, lockedSectionName]);

  const scopedGroups = React.useMemo(() => {
    if (showUnassignedOnly) return groupsForSection(template.groups, null);
    if (lockedSectionId) return groupsForSection(template.groups, lockedSectionId);
    return [...template.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [template.groups, lockedSectionId, showUnassignedOnly]);

  const groups = (nestBranches || rootsOnly)
    ? scopedGroups.filter((g) => !isDependentGroup(g))
    : scopedGroups;
  const completeness = sectionCompletenessIssues(scopedGroups, template.options);
  const addGroupCandidates = parentOptionCandidates(template.groups, template.options, null);

  function refresh() {
    router.refresh();
  }

  function resetOptionForm() {
    setOptionMode("idle");
    setOptionOfferingId("");
    setOptionLabel("");
    setOptionPrice("");
    setOptionIncluded(true);
    setOptionDefault(false);
  }

  function pickOffering(id: string) {
    const off = available.find((o) => o.id === id);
    setOptionOfferingId(id);
    if (!off) return;
    const draft = choicesOptionDraftFromOffering(off);
    setOptionLabel(draft.label);
    setOptionIncluded(draft.isIncluded);
    setOptionPrice(draft.unitPrice != null ? String(draft.unitPrice) : "");
  }

  function submitOption(offeringId: string | null) {
    if (!optionGroupId || !optionLabel.trim()) return;
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateOptionAction(template.id, {
        groupId: optionGroupId,
        offeringId,
        label: optionLabel,
        isIncluded: optionIncluded,
        unitPrice: optionIncluded ? "0" : (optionPrice.trim() || null),
        isDefault: optionDefault,
      });
      if (!r.ok) onPersist("error", r.errors?.label ?? r.message ?? "Could not add option.");
      else {
        onPersist("saved");
        resetOptionForm();
        refresh();
      }
    });
  }

  function beginEditDeps(g: EventOrderTemplateGroup) {
    setEditingDepsGroupId(g.id);
    setEditingDepsIds([...(g.dependsOnOptionIds ?? [])]);
  }

  function openMoreSettings(g: EventOrderTemplateGroup) {
    setMoreSettingsGroupId(g.id);
    setMoreRequired(g.minSelect > 0);
    setMoreMode(g.selectionMode);
    setMoreAllowQuantity(g.allowQuantity);
    setMoreMaxSelect(g.maxSelect != null ? String(g.maxSelect) : "");
  }

  function saveMoreSettings(g: EventOrderTemplateGroup) {
    const maxParsed = moreMaxSelect.trim() === "" ? null : Number(moreMaxSelect);
    const maxSelect =
      moreMode === "single"
        ? 1
        : maxParsed != null && Number.isFinite(maxParsed) && maxParsed > 0
          ? maxParsed
          : null;
    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateGroupAction(template.id, g.id, {
        sectionId: g.sectionId,
        name: g.name,
        instructions: g.instructions ?? undefined,
        selectionMode: moreMode,
        minSelect: moreRequired ? 1 : 0,
        maxSelect,
        allowQuantity: moreAllowQuantity,
        dependsOnOptionIds: g.dependsOnOptionIds ?? [],
      });
      if (!r.ok) {
        onPersist("error", r.message ?? "Could not update group settings.");
        return;
      }
      onPersist("saved");
      setMoreSettingsGroupId(null);
      refresh();
    });
  }

  function saveDeps(g: EventOrderTemplateGroup) {
    const nextDeps = sanitizeDependsOnOptionIds(
      editingDepsIds,
      template.options,
      g.id,
    );
    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateGroupAction(template.id, g.id, {
        sectionId: g.sectionId,
        name: g.name,
        instructions: g.instructions ?? undefined,
        selectionMode: g.selectionMode,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        allowQuantity: g.allowQuantity,
        dependsOnOptionIds: nextDeps,
      });
      if (!r.ok) {
        onPersist("error", r.errors?.dependsOnOptionIds ?? r.message ?? "Could not update when this group appears.");
        return;
      }
      onPersist("saved");
      setEditingDepsGroupId(null);
      setEditingDepsIds([]);
      refresh();
    });
  }

  function closeOptionPanel() {
    setOptionPanel("idle");
    setPanelOptionId("");
    setLinkOfferingId("");
  }

  function beginLinkOffering(o: EventOrderTemplateOption) {
    setOptionPanel("link");
    setPanelOptionId(o.id);
    setLinkOfferingId(o.offeringId && offeringById.get(o.offeringId) && !offeringById.get(o.offeringId)!.isArchived
      ? o.offeringId
      : "");
  }

  function beginEditOption(o: EventOrderTemplateOption) {
    setOptionPanel("edit");
    setPanelOptionId(o.id);
    setEditLabel(o.label);
    setEditIncluded(o.isIncluded);
    setEditPrice(o.unitPrice != null ? String(o.unitPrice) : "");
    setEditDefault(o.isDefault);
  }

  function persistOptionWrite(o: EventOrderTemplateOption, input: Parameters<typeof updateEventOrderTemplateOptionAction>[2]) {
    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateOptionAction(template.id, o.id, input);
      if (!r.ok) {
        onPersist("error", r.errors?.label ?? r.message ?? "Could not update option.");
        return;
      }
      onPersist("saved");
      closeOptionPanel();
      refresh();
    });
  }

  function renderGroupCard(g: EventOrderTemplateGroup, depth: number) {
            const opts = optionsForGroup(template.options, g.id);
            const sectionName = g.sectionId
              ? template.sections.find((s) => s.id === g.sectionId)?.name
              : null;
            const dependent = isDependentGroup(g);
            const dependsSummary = formatDependsOnSummary(g.dependsOnOptionIds, template.options);
            const editing = editingDepsGroupId === g.id;
            const candidates = parentOptionCandidates(template.groups, template.options, g.id);
            const emptyDependent = dependent && opts.length === 0;
            return (
              <li
                key={g.id}
                className={`rounded-lg border bg-background p-4 space-y-2 ${
                  emptyDependent ? "border-amber-500/60" : "border-border"
                } ${depth > 0 ? "ml-3 border-l-4 border-l-heading/30 sm:ml-5" : ""}`}
                data-testid={`eo-choice-group-${g.id}`}
                data-dependent={dependent ? "true" : "false"}
                data-branch-depth={depth}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {depth > 0 ? (
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Follow-up branch
                      </p>
                    ) : null}
                    <p className="text-sm font-medium text-heading">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {groupRulesLabel(g)}
                      {sectionName && !lockedSectionId ? ` · ${sectionName}` : ""}
                    </p>
                    <p
                      className="mt-1 text-xs font-medium text-heading"
                      data-testid={`eo-depends-summary-${g.id}`}
                    >
                      {dependsSummary}
                    </p>
                    {emptyDependent ? (
                      <p
                        className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-xs text-heading"
                        data-testid={`eo-incomplete-branch-${g.id}`}
                      >
                        Incomplete: no follow-up options configured. Clients will see an empty branch when
                        the parent option is selected. Add options below — nothing is invented automatically.
                      </p>
                    ) : null}
                    {g.instructions ? (
                      <p className="mt-1 text-sm text-muted-foreground">{g.instructions}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Remove ${g.name}`}
                    onClick={() => startTransition(async () => {
                      if (!confirm(`Remove “${g.name}” and its options from this template?`)) return;
                      onPersist("saving");
                      const r = await removeEventOrderTemplateGroupAction(template.id, g.id);
                      if (!r.ok) onPersist("error", r.message ?? "Could not remove group.");
                      else { onPersist("saved"); refresh(); }
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {guidedOrdinary ? (
                  <details
                    className="rounded-md border border-border/70 bg-muted/10 p-2"
                    data-testid={`eo-more-settings-${g.id}`}
                    open={moreSettingsGroupId === g.id}
                    onToggle={(e) => {
                      const open = (e.target as HTMLDetailsElement).open;
                      if (open) openMoreSettings(g);
                      else if (moreSettingsGroupId === g.id) setMoreSettingsGroupId(null);
                    }}
                  >
                    <summary className="cursor-pointer text-xs font-medium text-heading">
                      More settings
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-[0.7rem] text-muted-foreground">
                        Occasional group settings. Required means clients must pick before continuing.
                        Quantities let clients choose how many of an option. Maximum selection limits
                        multi-select lists.
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`eo-more-mode-${g.id}`}
                            checked={moreMode === "single"}
                            onChange={() => setMoreMode("single")}
                          />
                          Choose one
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`eo-more-mode-${g.id}`}
                            checked={moreMode === "multi"}
                            onChange={() => setMoreMode("multi")}
                          />
                          Choose multiple
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={moreRequired}
                            onChange={(e) => setMoreRequired(e.target.checked)}
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={moreAllowQuantity}
                            onChange={(e) => setMoreAllowQuantity(e.target.checked)}
                          />
                          Allow quantity
                        </label>
                      </div>
                      {moreMode === "multi" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Maximum selections (optional)</Label>
                          <Input
                            value={moreMaxSelect}
                            onChange={(e) => setMoreMaxSelect(e.target.value)}
                            placeholder="No maximum"
                            inputMode="numeric"
                            data-testid={`eo-more-max-${g.id}`}
                          />
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        data-testid={`eo-more-settings-save-${g.id}`}
                        onClick={() => saveMoreSettings(g)}
                      >
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save settings
                      </Button>
                    </div>
                  </details>
                ) : null}

                {!guidedOrdinary || specialistMode ? (
                  editing ? (
                    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        When this group appears
                      </p>
                      <DependsOnPicker
                        idPrefix={`edit-${g.id}`}
                        candidates={candidates}
                        selectedIds={editingDepsIds}
                        disabled={pending}
                        onChange={setEditingDepsIds}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          data-testid={`eo-save-deps-${g.id}`}
                          onClick={() => saveDeps(g)}
                        >
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            setEditingDepsGroupId(null);
                            setEditingDepsIds([]);
                          }}
                        >
                          Cancel
                        </Button>
                        {(g.dependsOnOptionIds?.length ?? 0) > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            data-testid={`eo-clear-deps-${g.id}`}
                            onClick={() => setEditingDepsIds([])}
                          >
                            Always show (clear)
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      data-testid={`eo-edit-deps-${g.id}`}
                      onClick={() => beginEditDeps(g)}
                    >
                      {dependent ? "Edit when this appears" : "Only show when…"}
                    </Button>
                  )
                ) : dependent ? (
                  <p className="text-xs text-muted-foreground">
                    {dependsSummary === "Always shown"
                      ? "Follow-up choice group."
                      : dependsSummary.replace(/^Depends on:\s*/i, "Shown after the client selects ")}
                  </p>
                ) : null}

                <ul className="space-y-1 pl-1">
                  {opts.length === 0 && !dependent ? (
                    <li
                      className="text-sm text-muted-foreground"
                      data-testid={`eo-group-empty-${g.id}`}
                    >
                      No options yet.
                    </li>
                  ) : null}
                  {opts.map((o) => {
                      const linked = o.offeringId ? offeringById.get(o.offeringId) : null;
                      const linkStatus = optionCatalogLinkStatus(o, linked);
                      const panelOpen = panelOptionId === o.id;
                      const branchGroups = nestBranches
                        ? dependentGroupsForOption(scopedGroups, o.id)
                        : [];
                      return (
                        <li
                          key={o.id}
                          className="space-y-2 rounded-md border border-transparent px-1 py-1 text-sm hover:border-border/60"
                          data-testid={`eo-option-${o.id}`}
                          data-catalog-kind={linkStatus.kind}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="font-medium text-heading">{o.label}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {formatOptionPrice(o)}
                                {o.isDefault ? " · Default" : ""}
                              </span>
                              <span
                                className="block text-[0.7rem] text-muted-foreground"
                                data-testid={`eo-option-catalog-status-${o.id}`}
                              >
                                {linkStatus.summary}
                              </span>
                              {linkStatus.labelDiffersFromOffering && linkStatus.offeringName ? (
                                <span className="block text-[0.7rem] text-muted-foreground">
                                  Customer label differs from catalog name “{linkStatus.offeringName}”
                                </span>
                              ) : null}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              aria-label={`Remove ${o.label}`}
                              onClick={() => startTransition(async () => {
                                onPersist("saving");
                                const r = await removeEventOrderTemplateOptionAction(template.id, o.id);
                                if (!r.ok) onPersist("error", r.message ?? "Could not remove option.");
                                else { onPersist("saved"); refresh(); }
                              })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {panelOpen && optionPanel === "link" ? (
                            <div
                              className="space-y-2 rounded-md border border-dashed border-border p-3"
                              data-testid={`eo-option-link-panel-${o.id}`}
                            >
                              <p className="text-xs text-muted-foreground">
                                Choose a catalog Offering deliberately. This keeps the option’s current
                                label and price — catalog prices are not refreshed automatically.
                              </p>
                              {available.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No active Offerings available. Keep this option template-only, or create
                                  an Offering in the catalog first.
                                </p>
                              ) : (
                                <CategorizedOfferingSelect
                                  offerings={available}
                                  sectionName={
                                    g.sectionId
                                      ? template.sections.find((s) => s.id === g.sectionId)?.name ?? null
                                      : lockedSectionName
                                  }
                                  value={linkOfferingId}
                                  onChange={setLinkOfferingId}
                                  testId={`eo-option-link-select-${o.id}`}
                                  disabled={pending}
                                />
                              )}
                              {linkStatus.kind === "catalog-archived" || linkStatus.kind === "catalog-missing" ? (
                                <p className="text-xs text-muted-foreground">
                                  The current link is preserved until you choose a different active Offering
                                  or unlink. Archived offerings cannot be selected for a new attach.
                                </p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={pending || !linkOfferingId}
                                  data-testid={`eo-option-link-save-${o.id}`}
                                  onClick={() => {
                                    if (!linkOfferingId) return;
                                    persistOptionWrite(o, attachOfferingPreservingSnapshot(o, linkOfferingId));
                                  }}
                                >
                                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Save catalog link
                                </Button>
                                {o.offeringId ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={pending}
                                    data-testid={`eo-option-unlink-${o.id}`}
                                    onClick={() => {
                                      persistOptionWrite(o, clearOfferingLinkPreservingSnapshot(o));
                                    }}
                                  >
                                    Unlink (template-only)
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={closeOptionPanel}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {panelOpen && optionPanel === "edit" ? (
                            <div
                              className="space-y-2 rounded-md border border-dashed border-border p-3"
                              data-testid={`eo-option-edit-panel-${o.id}`}
                            >
                              <p className="text-xs text-muted-foreground">
                                Edit customer-facing label and price. Catalog link stays{" "}
                                {o.offeringId ? "attached" : "template-only"}.
                              </p>
                              <Input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                placeholder="Customer-facing label"
                                data-testid={`eo-option-edit-label-${o.id}`}
                              />
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editIncluded}
                                  onChange={(e) => setEditIncluded(e.target.checked)}
                                />
                                Included ($0)
                              </label>
                              {!editIncluded ? (
                                <Input
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  placeholder="Unit price"
                                />
                              ) : null}
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editDefault}
                                  onChange={(e) => setEditDefault(e.target.checked)}
                                />
                                Pre-selected (default)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={pending || !editLabel.trim()}
                                  data-testid={`eo-option-edit-save-${o.id}`}
                                  onClick={() => {
                                    const priceNum = editIncluded
                                      ? 0
                                      : editPrice.trim() === ""
                                        ? null
                                        : Number(editPrice);
                                    persistOptionWrite(
                                      o,
                                      updateOptionFieldsPreservingOfferingLink(o, {
                                        label: editLabel,
                                        isIncluded: editIncluded,
                                        unitPrice: editIncluded
                                          ? 0
                                          : priceNum != null && Number.isFinite(priceNum)
                                            ? priceNum
                                            : null,
                                        isDefault: editDefault,
                                      }),
                                    );
                                  }}
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={closeOptionPanel}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : null}

                          {!panelOpen || optionPanel === "idle" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                data-testid={`eo-option-link-${o.id}`}
                                onClick={() => beginLinkOffering(o)}
                              >
                                {o.offeringId ? "Change catalog link" : "Link Offering"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                data-testid={`eo-option-edit-${o.id}`}
                                onClick={() => beginEditOption(o)}
                              >
                                Edit label / price
                              </Button>
                            </div>
                          ) : null}

                          {branchGroups.length > 0 ? (
                            <ul className="mt-2 space-y-2" data-testid={`eo-option-branches-${o.id}`}>
                              {branchGroups.map((branch) => renderGroupCard(branch, depth + 1))}
                            </ul>
                          ) : nestBranches && !dependent ? (
                            <p className="text-[0.7rem] text-muted-foreground">
                              No follow-up branch on this option yet. Add a choice group that depends on “{o.label}”.
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </li>
            );
  }

  return (
    <section className="space-y-4" data-testid="eo-choice-groups-panel">
      {!compact ? (
        <div>
          <h2 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-heading">
            Choice groups
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Selectable commercial groups for this section. Fixed offerings stay above. Options may link to a
            catalog Offering explicitly, or stay template-only — never matched by name.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Client choice structure
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Required and optional groups for this category. Dependent branches nest under the parent option that reveals them.
          </p>
        </div>
      )}

      {completeness.length > 0 ? (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-heading"
          data-testid="eo-section-completeness"
        >
          <p className="font-medium">Incomplete configuration</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {completeness.map((issue) => (
              <li key={issue.groupId}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {groups.length === 0 && !(nestBranches && scopedGroups.some((g) => isDependentGroup(g))) ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {showUnassignedOnly
            ? "No unassigned choice groups."
            : "No choice groups in this section yet. Add a group when clients should pick among options."}
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => renderGroupCard(g, 0))}
          {nestBranches
            ? (() => {
                const nestedIds = new Set<string>();
                const walk = (groupIds: string[]) => {
                  for (const gid of groupIds) {
                    for (const o of optionsForGroup(template.options, gid)) {
                      for (const d of dependentGroupsForOption(scopedGroups, o.id)) {
                        if (nestedIds.has(d.id)) continue;
                        nestedIds.add(d.id);
                        walk([d.id]);
                      }
                    }
                  }
                };
                walk(groups.map((g) => g.id));
                const orphans = scopedGroups.filter(
                  (g) => isDependentGroup(g) && !nestedIds.has(g.id),
                );
                if (orphans.length === 0) return null;
                return (
                  <li className="space-y-2" data-testid="eo-orphan-dependent-groups">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Dependent groups (parent option outside this view)
                    </p>
                    <ul className="space-y-3">
                      {orphans.map((g) => renderGroupCard(g, 1))}
                    </ul>
                  </li>
                );
              })()
            : null}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Add choice group</p>
        <Input
          placeholder="Group name (e.g. Dinner service)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          data-testid="eo-add-group-name"
        />
        {lockedSectionId || showUnassignedOnly ? (
          <p className="text-xs text-muted-foreground" data-testid="eo-add-group-section-locked">
            {lockedSectionName
              ? `Adds to section “${lockedSectionName}”.`
              : "Adds without a section (unassigned)."}
          </p>
        ) : (
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={groupSectionId}
            onChange={(e) => setGroupSectionId(e.target.value)}
          >
            <option value="">No section</option>
            {template.sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="eo-group-mode"
              checked={groupMode === "single"}
              onChange={() => setGroupMode("single")}
            />
            Pick one
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="eo-group-mode"
              checked={groupMode === "multi"}
              onChange={() => setGroupMode("multi")}
            />
            Pick many
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={groupRequired}
              onChange={(e) => setGroupRequired(e.target.checked)}
            />
            Required
          </label>
        </div>
        {guidedOrdinary && !specialistMode ? (
          <details className="rounded-md border border-border/60 p-2" data-testid="eo-add-group-more-settings">
            <summary className="cursor-pointer text-xs font-medium text-heading">More settings</summary>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={groupAllowQuantity}
                  onChange={(e) => setGroupAllowQuantity(e.target.checked)}
                />
                Allow quantity
              </label>
              {groupMode === "multi" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Maximum selections (optional)</Label>
                  <Input
                    value={groupMaxSelect}
                    onChange={(e) => setGroupMaxSelect(e.target.value)}
                    placeholder="No maximum"
                    inputMode="numeric"
                  />
                </div>
              ) : null}
            </div>
          </details>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">When this group appears (optional)</p>
            <DependsOnPicker
              idPrefix="add-group"
              candidates={addGroupCandidates}
              selectedIds={groupDependsOn}
              disabled={pending}
              onChange={setGroupDependsOn}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={groupAllowQuantity}
                onChange={(e) => setGroupAllowQuantity(e.target.checked)}
              />
              Allow quantity
            </label>
          </div>
        )}
        <Button
          type="button"
          size="sm"
          disabled={pending || !groupName.trim()}
          data-testid="eo-add-choice-group"
          onClick={() => startTransition(async () => {
            onPersist("saving");
            const dependsOnOptionIds =
              guidedOrdinary && !specialistMode
                ? []
                : sanitizeDependsOnOptionIds(
                    groupDependsOn,
                    template.options,
                    null,
                  );
            const maxParsed = groupMaxSelect.trim() === "" ? null : Number(groupMaxSelect);
            const resolvedSectionId = lockedSectionId
              ?? (showUnassignedOnly ? null : (groupSectionId || null));
            const r = await addEventOrderTemplateGroupAction(template.id, {
              sectionId: resolvedSectionId,
              name: groupName,
              selectionMode: groupMode,
              minSelect: groupRequired ? 1 : 0,
              maxSelect:
                groupMode === "single"
                  ? 1
                  : maxParsed != null && Number.isFinite(maxParsed) && maxParsed > 0
                    ? maxParsed
                    : null,
              allowQuantity: groupAllowQuantity,
              dependsOnOptionIds,
            });
            if (!r.ok) onPersist("error", r.errors?.name ?? r.message ?? "Could not add group.");
            else {
              onPersist("saved");
              setGroupName("");
              setGroupDependsOn([]);
              setGroupAllowQuantity(false);
              setGroupMaxSelect("");
              refresh();
            }
          })}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add group
        </Button>
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Add option</p>
        <p className="text-xs text-muted-foreground">
          Prefer a reusable Offering when the choice is something you sell across event orders. Use a
          custom / template-only option when it belongs only on this template. Offerings are not Inventory —
          linking them elsewhere does not reserve stock. New catalog picks snapshot label and price once;
          later catalog edits do not rewrite this option.
        </p>
        <select
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={optionGroupId}
          onChange={(e) => setOptionGroupId(e.target.value)}
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        {optionMode === "idle" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!optionGroupId || available.length === 0}
              onClick={() => setOptionMode("catalog")}
            >
              + Select Offering
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!optionGroupId}
              onClick={() => setOptionMode("custom")}
            >
              + Add template-only option
            </Button>
            {available.length === 0 ? (
              <p className="w-full text-xs text-muted-foreground">
                No active Offerings yet — add a template-only option, or create Offerings first.
              </p>
            ) : null}
          </div>
        ) : null}

        {optionMode === "catalog" ? (
          <div className="space-y-2">
            <Label className="text-sm">Select Offering</Label>
            <CategorizedOfferingSelect
              offerings={available}
              sectionName={optionGroupSectionName}
              value={optionOfferingId}
              onChange={pickOffering}
              testId="eo-add-option-offering"
              disabled={pending}
            />
            <Input
              placeholder="Customer-facing label"
              value={optionLabel}
              onChange={(e) => setOptionLabel(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionIncluded}
                onChange={(e) => setOptionIncluded(e.target.checked)}
              />
              Included ($0)
            </label>
            {!optionIncluded ? (
              <Input
                placeholder="Unit price"
                value={optionPrice}
                onChange={(e) => setOptionPrice(e.target.value)}
              />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionDefault}
                onChange={(e) => setOptionDefault(e.target.checked)}
              />
              Pre-selected (default)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !optionOfferingId || !optionLabel.trim()}
                onClick={() => submitOption(optionOfferingId || null)}
              >
                Add option
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetOptionForm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {optionMode === "custom" ? (
          <div className="space-y-2">
            <Input
              placeholder="Option label"
              value={optionLabel}
              onChange={(e) => setOptionLabel(e.target.value)}
              autoFocus
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionIncluded}
                onChange={(e) => setOptionIncluded(e.target.checked)}
              />
              Included ($0)
            </label>
            {!optionIncluded ? (
              <Input
                placeholder="Unit price"
                value={optionPrice}
                onChange={(e) => setOptionPrice(e.target.value)}
              />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={optionDefault}
                onChange={(e) => setOptionDefault(e.target.checked)}
              />
              Pre-selected (default)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending || !optionLabel.trim()}
                onClick={() => submitOption(null)}
              >
                Add template-only option
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetOptionForm}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {showPreview ? (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-heading">
            Preview client choices
          </h3>
          <ConditionalChoicePreview template={template} />
        </div>
      ) : null}
    </section>
  );
}
