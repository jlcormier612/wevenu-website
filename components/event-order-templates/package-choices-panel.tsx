"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";

import {
  addEventOrderTemplateGroupAction,
  addEventOrderTemplateOptionAction,
  includeCatalogChoiceGroupAction,
  removeEventOrderTemplateGroupAction,
  removeEventOrderTemplateOptionAction,
  reorderEventOrderTemplateGroupsAction,
  updateEventOrderTemplateGroupAction,
  updateEventOrderTemplateOptionAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { updateOptionFieldsPreservingOfferingLink } from "@/lib/client-choices-templates/option-catalog";
import { enqueueOptionPersist } from "@/lib/event-order-templates/option-persist-queue";
import { OptionCommercialEditor } from "@/components/event-order-templates/option-commercial-controls";
import { createOfferingChoiceGroupAction } from "@/app/(app)/library/offerings/actions";
import { CategorizedOfferingSelect } from "@/components/event-order-templates/categorized-offering-select";
import {
  SelectionRuleControls,
  SimpleSelectionRuleControls,
} from "@/components/event-order-templates/selection-rule-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  simpleSelectionLabel,
  simpleSelectionToFields,
  type SimpleSelectionState,
} from "@/lib/event-order-templates/editor-presentation";
import {
  impossibleSelectionGroupMessage,
  parseCoupleSelectCount,
  plainSelectionRuleLabel,
  resolvePlainSelectionRule,
} from "@/lib/event-order-templates/guided-setup";
import {
  catalogOptionsEligibleForParentGroup,
  choiceSetsForSection,
  itemsEligibleForCategory,
  newOptionalAddOnsGroupInput,
  newRootChoiceSetInput,
  offeringsAvailableForCoupleChoices,
  optionInputFromOffering,
  optionInputWriteIn,
  packageBuilderPriceLabel,
  parentChoiceView,
} from "@/lib/event-order-templates/offering-package-builder";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import {
  catalogGroupsAvailableToInclude,
  groupsForParent,
  type OfferingChoiceGroup,
} from "@/lib/offerings/choice-groups";
import type { OfferingWithCategory } from "@/lib/offerings/types";

type ProgressiveFocus = {
  choiceId?: string | null;
  optionId?: string | null;
  categoryId?: string | null;
};

type Props = {
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  catalogChoiceGroups?: OfferingChoiceGroup[];
  sectionId: string;
  sectionName: string;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
  presentation?: "nested" | "progressive";
  focus?: ProgressiveFocus;
  baseHref?: string;
};

type TemplateGroup = EventOrderTemplateWithDetails["groups"][number];
type TemplateOption = EventOrderTemplateWithDetails["options"][number];

/**
 * Couple's choices — Offering-first package builder.
 * Separates parent offerings, named dependent option groups (count + required),
 * and available options (catalog vs write-in).
 */
export function PackageChoicesPanel({
  template,
  catalogOfferings,
  catalogChoiceGroups = [],
  sectionId,
  sectionName,
  onPersist,
  presentation = "nested",
  focus,
  baseHref,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [pickBySet, setPickBySet] = React.useState<Record<string, string>>({});
  const [newSetPick, setNewSetPick] = React.useState("");

  const choiceSets = React.useMemo(
    () => choiceSetsForSection(template, sectionId),
    [template, sectionId],
  );

  const available = React.useMemo(
    () => offeringsAvailableForCoupleChoices(catalogOfferings, template, sectionId),
    [catalogOfferings, template, sectionId],
  );

  function refresh() {
    router.refresh();
  }

  function addOfferingToSet(groupId: string, offeringId: string) {
    const offering = catalogOfferings.find((o) => o.id === offeringId);
    if (!offering) return;
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateOptionAction(
        template.id,
        optionInputFromOffering(groupId, offering),
      );
      if (!r.ok) {
        onPersist("error", r.errors?.label ?? r.message ?? "Could not add Offering.");
        return;
      }
      setPickBySet((prev) => ({ ...prev, [groupId]: "" }));
      onPersist("saved");
      refresh();
    });
  }

  function createChoiceSetWithOffering(offeringId: string) {
    const offering = catalogOfferings.find((o) => o.id === offeringId);
    if (!offering) return;
    startTransition(async () => {
      onPersist("saving");
      const groupResult = await addEventOrderTemplateGroupAction(
        template.id,
        newRootChoiceSetInput(sectionId, sectionName),
      );
      if (!groupResult.ok) {
        onPersist("error", groupResult.message ?? "Could not create choice set.");
        return;
      }
      const opt = await addEventOrderTemplateOptionAction(
        template.id,
        optionInputFromOffering(groupResult.group.id, offering),
      );
      if (!opt.ok) {
        onPersist("error", opt.errors?.label ?? opt.message ?? "Could not add Offering.");
        return;
      }
      setNewSetPick("");
      onPersist("saved");
      refresh();
    });
  }

  function createEmptyChoiceSet() {
    startTransition(async () => {
      onPersist("saving");
      const groupResult = await addEventOrderTemplateGroupAction(
        template.id,
        newRootChoiceSetInput(sectionId, sectionName),
      );
      if (!groupResult.ok) {
        onPersist("error", groupResult.message ?? "Could not create choice set.");
        return;
      }
      onPersist("saved");
      refresh();
    });
  }

  function createOptionalAddOnsGroup() {
    startTransition(async () => {
      onPersist("saving");
      const groupResult = await addEventOrderTemplateGroupAction(
        template.id,
        newOptionalAddOnsGroupInput(sectionId, sectionName),
      );
      if (!groupResult.ok) {
        onPersist("error", groupResult.message ?? "Could not create add-ons group.");
        return;
      }
      onPersist("saved");
      refresh();
    });
  }

  function removeOption(optionId: string) {
    startTransition(async () => {
      onPersist("saving");
      const r = await removeEventOrderTemplateOptionAction(template.id, optionId);
      if (!r.ok) onPersist("error", r.message ?? "Could not remove.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  function saveOptionCommercial(
    option: TemplateOption,
    next: { label: string; isIncluded: boolean; unitPrice: number | null },
  ) {
    onPersist("saving");
    void enqueueOptionPersist(async () => {
      const r = await updateEventOrderTemplateOptionAction(
        template.id,
        option.id,
        updateOptionFieldsPreservingOfferingLink(option, next),
      );
      if (!r.ok) onPersist("error", r.errors?.label ?? r.message ?? "Could not save offering.");
      else onPersist("saved");
      refresh();
    });
  }

  function removeChoiceSet(groupId: string) {
    startTransition(async () => {
      onPersist("saving");
      const r = await removeEventOrderTemplateGroupAction(template.id, groupId);
      if (!r.ok) onPersist("error", r.message ?? "Could not remove choice set.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  function saveGroupFields(
    group: TemplateGroup,
    patch: {
      name?: string;
      instructions?: string;
      selectCountRaw?: string;
      required?: boolean;
      simple?: SimpleSelectionState;
    },
  ): string | null {
    const required = patch.required ?? group.minSelect > 0;
    let selectionMode = group.selectionMode;
    let minSelect = group.minSelect;
    let maxSelect = group.maxSelect;
    let allowQuantity = group.allowQuantity;
    if (patch.simple) {
      const resolved = simpleSelectionToFields(patch.simple);
      selectionMode = resolved.selectionMode;
      minSelect = resolved.minSelect;
      maxSelect = resolved.maxSelect;
      allowQuantity = resolved.allowQuantity;
    } else if (patch.selectCountRaw !== undefined) {
      const parsed = parseCoupleSelectCount(patch.selectCountRaw);
      if (!parsed.ok) return parsed.message;
      if (parsed.count === 0 && required) {
        return "A required group needs a count of at least 1, or mark the group optional.";
      }
      const resolved = resolvePlainSelectionRule({
        selectCount: parsed.count,
        required,
      });
      selectionMode = resolved.selectionMode;
      minSelect = resolved.minSelect;
      maxSelect = resolved.maxSelect;
    } else if (patch.required !== undefined) {
      const count =
        group.maxSelect != null
          ? group.maxSelect
          : group.minSelect > 0
            ? group.minSelect
            : null;
      if (count == null && patch.required) {
        return "Enter how many options the couple must choose before marking this group required.";
      }
      const resolved = resolvePlainSelectionRule({
        selectCount: count,
        required: patch.required,
      });
      selectionMode = resolved.selectionMode;
      minSelect = resolved.minSelect;
      maxSelect = resolved.maxSelect;
    }

    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateGroupAction(template.id, group.id, {
        sectionId: group.sectionId,
        name: patch.name ?? group.name,
        instructions:
          patch.instructions !== undefined
            ? patch.instructions
            : (group.instructions ?? undefined),
        selectionMode,
        minSelect,
        maxSelect,
        allowQuantity,
        dependsOnOptionIds: group.dependsOnOptionIds ?? [],
      });
      if (!r.ok) onPersist("error", r.message ?? "Could not save selection group.");
      else {
        onPersist("saved");
        refresh();
      }
    });
    return null;
  }

  function includeCatalogGroup(
    parentOption: { id: string; label: string; offeringId: string | null },
    catalogGroupId: string,
  ): string | null {
    if (!catalogGroupId) return "Choose a catalog group to include.";
    if (!parentOption.offeringId) {
      return "This parent is not linked to a catalog Offering, so catalog groups cannot be included.";
    }
    startTransition(async () => {
      onPersist("saving");
      const r = await includeCatalogChoiceGroupAction({
        templateId: template.id,
        sectionId,
        parentOptionId: parentOption.id,
        catalogGroupId,
      });
      if (!r.ok) onPersist("error", r.message ?? "Could not include catalog group.");
      else {
        onPersist("saved");
        refresh();
      }
    });
    return null;
  }

  function createCategoryUnderParent(
    parentOption: { id: string; label: string; offeringId: string | null },
    rawName: string,
  ): string | null {
    const name = rawName.trim();
    if (!name) return "Enter a category name (for example Entrées).";
    if (!parentOption.offeringId) {
      return "This choice is not linked to a catalog Offering, so categories cannot be added under it.";
    }
    const parentOfferingId = parentOption.offeringId;
    startTransition(async () => {
      onPersist("saving");
      const created = await createOfferingChoiceGroupAction(parentOfferingId, name);
      if (!created.ok || !created.group) {
        onPersist("error", created.ok ? "Could not create category." : created.message);
        return;
      }
      const r = await includeCatalogChoiceGroupAction({
        templateId: template.id,
        sectionId,
        parentOptionId: parentOption.id,
        catalogGroupId: created.group.id,
      });
      if (!r.ok) onPersist("error", r.message ?? "Category created in Offerings, but it could not be added here.");
      else {
        onPersist("saved");
        refresh();
      }
    });
    return null;
  }

  function removeChildGroup(groupId: string) {
    startTransition(async () => {
      onPersist("saving");
      const r = await removeEventOrderTemplateGroupAction(template.id, groupId);
      if (!r.ok) onPersist("error", r.message ?? "Could not remove selection group.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  function addCatalogOptionToGroup(groupId: string, offeringId: string) {
    const offering = catalogOfferings.find((o) => o.id === offeringId);
    if (!offering) return;
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateOptionAction(
        template.id,
        optionInputFromOffering(groupId, offering),
      );
      if (!r.ok) {
        onPersist("error", r.errors?.label ?? r.message ?? "Could not add catalog option.");
        return;
      }
      onPersist("saved");
      refresh();
    });
  }

  function addWriteInToGroup(groupId: string, label: string): string | null {
    const trimmed = label.trim();
    if (!trimmed) return "Enter a display name for the write-in option.";
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateOptionAction(
        template.id,
        optionInputWriteIn(groupId, trimmed),
      );
      if (!r.ok) {
        onPersist("error", r.errors?.label ?? r.message ?? "Could not add write-in option.");
        return;
      }
      onPersist("saved");
      refresh();
    });
    return null;
  }

  function reorderDependentGroups(parentOptionId: string, categoryId: string, direction: -1 | 1) {
    const dependents = template.groups
      .filter((g) => (g.dependsOnOptionIds ?? []).includes(parentOptionId))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const ids = dependents.map((g) => g.id);
    const index = ids.indexOf(categoryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    startTransition(async () => {
      onPersist("saving");
      const r = await reorderEventOrderTemplateGroupsAction(template.id, next);
      if (!r.ok) onPersist("error", r.message ?? "Could not reorder categories.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  if (presentation === "progressive") {
    return (
      <ProgressiveChoices
        template={template}
        catalogOfferings={catalogOfferings}
        catalogChoiceGroups={catalogChoiceGroups}
        sectionName={sectionName}
        choiceSets={choiceSets}
        available={available}
        pending={pending}
        focus={focus ?? {}}
        baseHref={baseHref ?? ""}
        onCreateEmptySet={createEmptyChoiceSet}
        onPickNewSet={(id) => {
          setNewSetPick(id);
          if (id) createChoiceSetWithOffering(id);
        }}
        newSetPick={newSetPick}
        onRemoveSet={(groupId) => {
          if (!confirm("Remove this selection group? Clients will no longer see it on this template.")) return;
          removeChoiceSet(groupId);
        }}
        onSaveGroup={saveGroupFields}
        onRemoveOption={removeOption}
        onAddOfferingToSet={addOfferingToSet}
        onIncludeCatalogGroup={includeCatalogGroup}
        onCreateCategory={createCategoryUnderParent}
        onRemoveChildGroup={(groupId) => {
          if (!confirm("Remove this category from the template?")) return;
          removeChildGroup(groupId);
        }}
        onAddCatalogOption={addCatalogOptionToGroup}
        onAddWriteIn={addWriteInToGroup}
        onReorderCategory={reorderDependentGroups}
        onSaveOption={saveOptionCommercial}
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="eo-package-choices-panel">
      <p className="text-xs text-muted-foreground">
        Offerings the couple picks between, and how many they must choose. Use{" "}
        <span className="font-medium text-heading">Couples must choose</span> with presets
        (for example <span className="font-medium text-heading">2</span> for arch / runner /
        petals) and Required for exactly that many, or leave Required unchecked for up
        to that many or skip. Keep primary packages in one choice set; put Champagne toast–
        style extras in a separate <span className="font-medium text-heading">optional add-ons</span>{" "}
        set so they can be selected together with a package. When a choice has follow-ups,
        use <span className="font-medium text-heading">Try this path</span> to open only that branch.
      </p>

      {choiceSets.length === 0 ? (
        <div
          className="space-y-3"
          data-testid="eo-package-choices-empty"
        >
          <p className="text-sm text-muted-foreground">
            No client selections yet. Add an option to get started.
          </p>
          <div className="space-y-2" data-testid="eo-package-choices-add-first">
            <Label className="text-xs text-muted-foreground">Add an option</Label>
            <CategorizedOfferingSelect
              offerings={available}
              sectionName={sectionName}
              value={newSetPick}
              onChange={(id) => {
                setNewSetPick(id);
                if (id) createChoiceSetWithOffering(id);
              }}
              authoringScope={{ kind: "primary" }}
              emptyLabel="Choose from your offerings"
              testId="eo-couple-choice-offering-select"
              disabled={pending}
            />
          </div>
        </div>
      ) : null}

      {choiceSets.map((set, setIndex) => (
        <ChoiceSetCard
          key={set.group.id}
          setIndex={setIndex}
          set={set}
          template={template}
          catalogOfferings={catalogOfferings}
          available={available}
          pickValue={pickBySet[set.group.id] ?? ""}
          pending={pending}
          onPickChange={(id) => {
            setPickBySet((prev) => ({ ...prev, [set.group.id]: id }));
            if (id) addOfferingToSet(set.group.id, id);
          }}
          catalogChoiceGroups={catalogChoiceGroups}
          onRemoveOption={removeOption}
          onRemoveSet={() => removeChoiceSet(set.group.id)}
          onSaveGroup={saveGroupFields}
          onIncludeCatalogGroup={includeCatalogGroup}
          onCreateCategory={createCategoryUnderParent}
          onRemoveChildGroup={removeChildGroup}
          onAddCatalogOption={addCatalogOptionToGroup}
          onAddWriteIn={addWriteInToGroup}
        />
      ))}

      {choiceSets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="eo-add-choice-set"
            onClick={createEmptyChoiceSet}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add another choice set
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="eo-add-optional-addons-group"
            onClick={createOptionalAddOnsGroup}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add optional add-ons group
          </Button>
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid="eo-add-optional-addons-group"
            onClick={createOptionalAddOnsGroup}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add optional add-ons group
          </Button>
        </div>
      )}
    </div>
  );
}

function progressiveHref(baseHref: string, focus: ProgressiveFocus): string {
  const params = new URLSearchParams();
  if (focus.choiceId) params.set("choice", focus.choiceId);
  if (focus.optionId) params.set("offering", focus.optionId);
  if (focus.categoryId) params.set("category", focus.categoryId);
  const query = params.toString();
  return query ? `${baseHref}?${query}` : baseHref;
}

function ProgressiveChoices({
  template,
  catalogOfferings,
  catalogChoiceGroups,
  sectionName,
  choiceSets,
  available,
  pending,
  focus,
  baseHref,
  onCreateEmptySet,
  onPickNewSet,
  newSetPick,
  onRemoveSet,
  onSaveGroup,
  onRemoveOption,
  onAddOfferingToSet,
  onIncludeCatalogGroup,
  onCreateCategory,
  onRemoveChildGroup,
  onAddCatalogOption,
  onAddWriteIn,
  onReorderCategory,
  onSaveOption,
}: {
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  catalogChoiceGroups: OfferingChoiceGroup[];
  sectionName: string;
  choiceSets: ReturnType<typeof choiceSetsForSection>;
  available: OfferingWithCategory[];
  pending: boolean;
  focus: ProgressiveFocus;
  baseHref: string;
  onCreateEmptySet: () => void;
  onPickNewSet: (id: string) => void;
  newSetPick: string;
  onRemoveSet: (groupId: string) => void;
  onSaveGroup: ChoiceSetCardPropsSave;
  onRemoveOption: (optionId: string) => void;
  onAddOfferingToSet: (groupId: string, offeringId: string) => void;
  onIncludeCatalogGroup: (
    parent: { id: string; label: string; offeringId: string | null },
    catalogGroupId: string,
  ) => string | null;
  onCreateCategory: CreateCategoryFn;
  onRemoveChildGroup: (groupId: string) => void;
  onAddCatalogOption: (groupId: string, offeringId: string) => void;
  onAddWriteIn: (groupId: string, label: string) => string | null;
  onReorderCategory: (parentOptionId: string, categoryId: string, direction: -1 | 1) => void;
  onSaveOption: (
    option: TemplateOption,
    next: { label: string; isIncluded: boolean; unitPrice: number | null },
  ) => void;
}) {
  const focusedSet = choiceSets.find((set) => set.group.id === focus.choiceId) ?? null;
  const focusedOption = focusedSet?.options.find((opt) => opt.id === focus.optionId) ?? null;
  const [nameDraft, setNameDraft] = React.useState(focusedSet?.group.name ?? "");
  const [questionDraft, setQuestionDraft] = React.useState(focusedSet?.group.instructions ?? "");
  React.useEffect(() => {
    setNameDraft(focusedSet?.group.name ?? "");
    setQuestionDraft(focusedSet?.group.instructions ?? "");
  }, [focusedSet?.group.id, focusedSet?.group.name, focusedSet?.group.instructions]);

  if (focus.categoryId && focusedSet && focusedOption) {
    const category = template.groups.find((g) => g.id === focus.categoryId);
    if (category) {
      const optionsInGroup = template.options
        .filter((o) => o.groupId === category.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const underParent = catalogOptionsEligibleForParentGroup(
        catalogOfferings,
        focusedOption.offeringId,
        focusedOption.id,
        template.groups,
        template.options,
      );
      const eligibleCatalog = itemsEligibleForCategory(
        underParent,
        catalogChoiceGroups.find((g) => g.id === category.offeringChoiceGroupId) ?? null,
      );
      return (
        <div className="space-y-4" data-testid="eo-level-3-offerings">
          <ChildGroupEditor
            group={category}
            parentOption={focusedOption}
            options={optionsInGroup}
            eligibleCatalog={eligibleCatalog}
            pending={pending}
            presentation="progressive"
            onSaveGroup={onSaveGroup}
            onRemoveGroup={() => onRemoveChildGroup(category.id)}
            onRemoveOption={onRemoveOption}
            onAddCatalogOption={(offeringId) => onAddCatalogOption(category.id, offeringId)}
            onAddWriteIn={(label) => onAddWriteIn(category.id, label)}
            onSaveOption={onSaveOption}
          />
        </div>
      );
    }
  }

  if (focus.optionId && focusedSet && focusedOption) {
    const view = parentChoiceView(
      focusedOption,
      catalogOfferings,
      template.groups,
      template.options,
    );
    return (
      <div className="space-y-4" data-testid="eo-level-2-categories">
        <OptionCommercialEditor
          option={focusedOption}
          pending={false}
          onSave={(next) => onSaveOption(focusedOption, next)}
        />
        {view.dependentGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid={`eo-no-child-groups-${focusedOption.id}`}>
            Add a category for clients to choose from when they select {focusedOption.label}.
          </p>
        ) : (
          <ul className="space-y-2">
            {view.dependentGroups.map((category, index) => (
              <li
                key={category.id}
                className="htc-working-row flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                data-testid={`eo-category-row-${category.id}`}
              >
                <div>
                  <p className="text-sm font-medium text-heading">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{simpleSelectionLabel(category)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending || index === 0}
                    aria-label={`Move ${category.name} up`}
                    onClick={() => onReorderCategory(focusedOption.id, category.id, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending || index === view.dependentGroups.length - 1}
                    aria-label={`Move ${category.name} down`}
                    onClick={() => onReorderCategory(focusedOption.id, category.id, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    render={
                      <Link
                        href={progressiveHref(baseHref, {
                          choiceId: focusedSet.group.id,
                          optionId: focusedOption.id,
                          categoryId: category.id,
                        })}
                      />
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => onRemoveChildGroup(category.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DependentGroupsUnderParent
          parentOption={focusedOption}
          dependentGroups={view.dependentGroups}
          template={template}
          catalogOfferings={catalogOfferings}
          catalogChoiceGroups={catalogChoiceGroups}
          pending={pending}
          hideNestedEditors
          onSaveGroup={onSaveGroup}
          onIncludeCatalogGroup={onIncludeCatalogGroup}
          onCreateCategory={onCreateCategory}
          onRemoveChildGroup={onRemoveChildGroup}
          onRemoveOption={onRemoveOption}
          onAddCatalogOption={onAddCatalogOption}
          onAddWriteIn={onAddWriteIn}
        />
      </div>
    );
  }

  if (focusedSet) {
    return (
      <div className="space-y-4" data-testid="eo-level-1-choice">
        {focusedSet.options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add an option so clients have something to choose.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="eo-level-1-options">
            {focusedSet.options.map((opt) => (
              <li
                key={opt.id}
                className="htc-working-row flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--htc-border-warm)] bg-card px-3 py-2"
                data-testid={`eo-choice-option-${opt.id}`}
              >
                <div>
                  <p className="text-sm font-medium text-heading">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {packageBuilderPriceLabel(opt.unitPrice, opt.isIncluded)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    render={
                      <Link
                        href={progressiveHref(baseHref, {
                          choiceId: focusedSet.group.id,
                          optionId: opt.id,
                        })}
                      />
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={pending}
                    onClick={() => onRemoveOption(opt.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <CatalogPickerDisclosure label="Add an option" testId="eo-level-1-add-option">
          <CategorizedOfferingSelect
            offerings={available}
            sectionName={sectionName}
            value=""
            onChange={(id) => { if (id) onAddOfferingToSet(focusedSet.group.id, id); }}
            authoringScope={{ kind: "primary" }}
            emptyLabel="Choose from your offerings"
            testId="eo-couple-choice-offering-select"
            disabled={pending}
          />
        </CatalogPickerDisclosure>
        <details className="rounded-md border border-border bg-card px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-heading">How clients choose</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`eo-choice-name-${focusedSet.group.id}`}>Name</Label>
              <Input
                id={`eo-choice-name-${focusedSet.group.id}`}
                value={nameDraft}
                disabled={pending}
                data-testid="eo-level-1-name"
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  if (nameDraft.trim() && nameDraft.trim() !== focusedSet.group.name) {
                    onSaveGroup(focusedSet.group, { name: nameDraft.trim() });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`eo-choice-question-${focusedSet.group.id}`}>Question shown to client</Label>
              <Input
                id={`eo-choice-question-${focusedSet.group.id}`}
                value={questionDraft}
                disabled={pending}
                placeholder="Which dinner service would you prefer?"
                data-testid="eo-level-1-question"
                onChange={(e) => setQuestionDraft(e.target.value)}
                onBlur={() => {
                  if ((focusedSet.group.instructions ?? "") !== questionDraft) {
                    onSaveGroup(focusedSet.group, { instructions: questionDraft });
                  }
                }}
              />
            </div>
            <SimpleSelectionRuleControls
              group={focusedSet.group}
              pending={pending}
              testId="eo-level-1-rules"
              onCommit={(simple) => onSaveGroup(focusedSet.group, { simple })}
            />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="eo-package-choices-panel">
      {choiceSets.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="eo-package-choices-empty">
          No client selections yet. Add a selection group to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {choiceSets.map((set) => (
            <li
              key={set.group.id}
              className="htc-working-row flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
              data-testid={`eo-selection-group-${set.group.id}`}
            >
              <div>
                <p className="text-sm font-medium text-heading">{set.group.name}</p>
                <p className="text-xs text-muted-foreground">{simpleSelectionLabel(set.group)}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  render={<Link href={progressiveHref(baseHref, { choiceId: set.group.id })} />}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onRemoveSet(set.group.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          data-testid="eo-add-choice-set"
          onClick={onCreateEmptySet}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add selection group
        </Button>
        <CatalogPickerDisclosure label="Add an option" testId="eo-add-option-from-catalog">
          <CategorizedOfferingSelect
            offerings={available}
            sectionName={sectionName}
            value={newSetPick}
            onChange={onPickNewSet}
            authoringScope={{ kind: "primary" }}
            emptyLabel="Choose from your offerings"
            testId="eo-couple-choice-offering-select"
            disabled={pending}
          />
        </CatalogPickerDisclosure>
      </div>
    </div>
  );
}

function ChoiceSetCard({
  setIndex,
  set,
  template,
  catalogOfferings,
  catalogChoiceGroups,
  available,
  pickValue,
  pending,
  onPickChange,
  onRemoveOption,
  onRemoveSet,
  onSaveGroup,
  onIncludeCatalogGroup,
  onCreateCategory,
  onRemoveChildGroup,
  onAddCatalogOption,
  onAddWriteIn,
}: {
  setIndex: number;
  set: ReturnType<typeof choiceSetsForSection>[number];
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  catalogChoiceGroups: OfferingChoiceGroup[];
  available: OfferingWithCategory[];
  pickValue: string;
  pending: boolean;
  onPickChange: (id: string) => void;
  onRemoveOption: (optionId: string) => void;
  onRemoveSet: () => void;
  onSaveGroup: (
    group: TemplateGroup,
    patch: {
      name?: string;
      instructions?: string;
      selectCountRaw?: string;
      required?: boolean;
    },
  ) => string | null;
  onIncludeCatalogGroup: (
    parent: { id: string; label: string; offeringId: string | null },
    catalogGroupId: string,
  ) => string | null;
  onCreateCategory: CreateCategoryFn;
  onRemoveChildGroup: (groupId: string) => void;
  onAddCatalogOption: (groupId: string, offeringId: string) => void;
  onAddWriteIn: (groupId: string, label: string) => string | null;
}) {
  const [instructionsDraft, setInstructionsDraft] = React.useState(set.group.instructions ?? "");
  const [selectCount, setSelectCount] = React.useState(() => countDraftFromGroup(set.group));
  const [required, setRequired] = React.useState(set.group.minSelect > 0);
  const [countError, setCountError] = React.useState<string | null>(null);
  /** Path-preview: only one parent option's follow-ups fully open at a time. */
  const [pathPreviewOptionId, setPathPreviewOptionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setInstructionsDraft(set.group.instructions ?? "");
    setRequired(set.group.minSelect > 0);
    setSelectCount(countDraftFromGroup(set.group));
    setCountError(null);
  }, [set.group.id, set.group.instructions, set.group.selectionMode, set.group.minSelect, set.group.maxSelect]);

  const sectionName =
    template.sections.find((s) => s.id === set.group.sectionId)?.name ?? "Package";
  const impossible = impossibleSelectionGroupMessage(set.group, set.options.length);
  const optionsWithDependents = set.options.filter((opt) => {
    const view = parentChoiceView(opt, catalogOfferings, template.groups, template.options);
    return view.dependentGroups.length > 0;
  });

  function commitCount(nextCount: string, nextRequired: boolean) {
    const err = onSaveGroup(set.group, {
      selectCountRaw: nextCount,
      required: nextRequired,
    });
    setCountError(err);
  }

  return (
    <div
      className="space-y-4 rounded-lg border border-border p-4"
      data-testid={`eo-choice-set-${setIndex}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-heading text-base text-heading">
            {setIndex === 0 ? "Couple's choices" : `Choice set ${setIndex + 1}`}
          </h4>
          <p className="text-xs text-muted-foreground">
            {plainSelectionRuleLabel(set.group)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          data-testid={`eo-remove-choice-set-${setIndex}`}
          onClick={onRemoveSet}
          aria-label="Remove choice set"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2" data-testid={`eo-choice-set-instructions-${setIndex}`}>
        <Label htmlFor={`eo-instr-${set.group.id}`}>Instructions for the couple</Label>
        <textarea
          id={`eo-instr-${set.group.id}`}
          className="min-h-[4.5rem] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={instructionsDraft}
          disabled={pending}
          placeholder="Example: Choose one dinner style: Plated Dinner or Buffet Style Dinner."
          data-testid={`eo-choice-instructions-${setIndex}`}
          onChange={(e) => setInstructionsDraft(e.target.value)}
          onBlur={() => {
            if ((set.group.instructions ?? "") !== instructionsDraft) {
              onSaveGroup(set.group, { instructions: instructionsDraft });
            }
          }}
        />
      </div>

      <SelectionRuleControls
        group={set.group}
        selectCount={selectCount}
        required={required}
        pending={pending}
        countError={countError}
        exampleHint="2 of Arch, Runner, Petals"
        ids={{
          rules: `eo-choice-set-rules-${setIndex}`,
          count: `eo-choice-select-count-${setIndex}`,
          required: `eo-choice-required-${setIndex}`,
          hint: `eo-choice-set-rule-hint-${setIndex}`,
          preset: (n) => `eo-choice-count-preset-${setIndex}-${n}`,
        }}
        onSelectCountChange={(raw) => {
          setSelectCount(raw);
          setCountError(null);
        }}
        onRequiredChange={setRequired}
        onCommit={commitCount}
      />
      {impossible ? (
        <p
          className="text-xs text-destructive"
          role="alert"
          data-testid={`eo-choice-set-impossible-${setIndex}`}
        >
          {impossible}
        </p>
      ) : null}

      {optionsWithDependents.length > 0 ? (
        <div
          className="space-y-2 rounded-md border border-dashed border-border bg-card px-3 py-2"
          data-testid={`eo-choice-path-preview-${setIndex}`}
        >
          <p className="text-xs font-medium text-heading">Try a couple path to edit follow-ups</p>
          <p className="text-xs text-muted-foreground">
            Only the selected path&apos;s categories stay open — other branches stay collapsed.
          </p>
          <div className="flex flex-wrap gap-2">
            {optionsWithDependents.map((opt) => {
              const active = pathPreviewOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={pending}
                  data-testid={`eo-choice-path-preview-option-${opt.id}`}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setPathPreviewOptionId(active ? null : opt.id)}
                >
                  {active ? `Editing: ${opt.label}` : `Try ${opt.label}`}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <ul className="space-y-4" data-testid={`eo-choice-set-options-${setIndex}`}>
        {set.options.map((opt) => {
          const view = parentChoiceView(
            opt,
            catalogOfferings,
            template.groups,
            template.options,
          );
          const hasDependents = view.dependentGroups.length > 0;
          const pathOpen = !hasDependents || pathPreviewOptionId === opt.id;
          return (
            <li
              key={opt.id}
              className="rounded-md border border-border/80 bg-card p-3"
              data-testid={`eo-choice-option-${opt.id}`}
              data-path-preview={hasDependents ? (pathOpen ? "open" : "collapsed") : "none"}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  {opt.imageUrl?.trim() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={opt.imageUrl.trim()}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-md border border-border/60 bg-muted/30 object-contain"
                      data-testid={`eo-choice-option-photo-${opt.id}`}
                    />
                  ) : null}
                  <div>
                  <p className="font-medium text-heading">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {packageBuilderPriceLabel(opt.unitPrice, opt.isIncluded)}
                    {view.role === "major" ? " · Parent Offering" : null}
                    {view.role === "standalone" ? " · Standalone Offering" : null}
                  </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  data-testid={`eo-remove-choice-option-${opt.id}`}
                  onClick={() => onRemoveOption(opt.id)}
                  aria-label={`Remove ${opt.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {hasDependents && !pathOpen ? (
                <button
                  type="button"
                  className="mt-3 w-full rounded-md border border-dashed border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/40"
                  data-testid={`eo-choice-path-collapsed-${opt.id}`}
                  onClick={() => setPathPreviewOptionId(opt.id)}
                >
                  {view.dependentGroups.length} follow-up categor
                  {view.dependentGroups.length === 1 ? "y" : "ies"} — try this path to edit
                </button>
              ) : (
                <DependentGroupsUnderParent
                  parentOption={opt}
                  dependentGroups={view.dependentGroups}
                  template={template}
                  catalogOfferings={catalogOfferings}
                  catalogChoiceGroups={catalogChoiceGroups}
                  pending={pending}
                  onSaveGroup={onSaveGroup}
                  onIncludeCatalogGroup={onIncludeCatalogGroup}
                  onCreateCategory={onCreateCategory}
                  onRemoveChildGroup={onRemoveChildGroup}
                  onRemoveOption={onRemoveOption}
                  onAddCatalogOption={onAddCatalogOption}
                  onAddWriteIn={onAddWriteIn}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2" data-testid={`eo-choice-set-add-${setIndex}`}>
        <Label className="text-xs text-muted-foreground">
          {set.options.length > 0 ? "Add another top choice" : "Add a top choice"}
        </Label>
        {set.options.length > 0 ? (
          <p className="text-xs text-muted-foreground" data-testid={`eo-choice-set-add-hint-${setIndex}`}>
            The couple picks between top choices (for example Plated Dinner or Buffet Style Dinner).
            To add what goes under a choice, use the category box under that choice.
          </p>
        ) : null}
        <CategorizedOfferingSelect
          offerings={available}
          sectionName={sectionName}
          value={pickValue}
          onChange={onPickChange}
          authoringScope={{ kind: "primary" }}
          emptyLabel="Choose an Offering…"
          testId={`eo-couple-choice-offering-select-${setIndex}`}
          disabled={pending}
        />
      </div>
    </div>
  );
}

function DependentGroupsUnderParent({
  parentOption,
  dependentGroups,
  template,
  catalogOfferings,
  catalogChoiceGroups,
  pending,
  hideNestedEditors = false,
  onSaveGroup,
  onIncludeCatalogGroup,
  onCreateCategory,
  onRemoveChildGroup,
  onRemoveOption,
  onAddCatalogOption,
  onAddWriteIn,
}: {
  parentOption: TemplateOption;
  dependentGroups: TemplateGroup[];
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  catalogChoiceGroups: OfferingChoiceGroup[];
  pending: boolean;
  hideNestedEditors?: boolean;
  onSaveGroup: ChoiceSetCardPropsSave;
  onIncludeCatalogGroup: (
    parent: { id: string; label: string; offeringId: string | null },
    catalogGroupId: string,
  ) => string | null;
  onCreateCategory: CreateCategoryFn;
  onRemoveChildGroup: (groupId: string) => void;
  onRemoveOption: (optionId: string) => void;
  onAddCatalogOption: (groupId: string, offeringId: string) => void;
  onAddWriteIn: (groupId: string, label: string) => string | null;
}) {
  const [pickGroupId, setPickGroupId] = React.useState("");
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [includeError, setIncludeError] = React.useState<string | null>(null);

  const parentOfferingId = parentOption.offeringId;
  const availableCatalogGroups = parentOfferingId
    ? catalogGroupsAvailableToInclude(
        catalogChoiceGroups,
        parentOfferingId,
        parentOption.id,
        template.groups,
      )
    : [];
  const configuredUnderParent = parentOfferingId
    ? groupsForParent(catalogChoiceGroups, parentOfferingId)
    : [];

  return (
    <div
      className="mt-3 space-y-3"
      data-testid={`eo-parent-dependent-groups-${parentOption.id}`}
    >
      {hideNestedEditors ? null : (
        <div>
          <p className="text-xs font-medium text-heading">
            Under {parentOption.label}: categories the couple picks from
          </p>
          <p className="text-xs text-muted-foreground">
            Shown only when the couple chooses {parentOption.label}. Add a category (for example
            Entrées or Desserts), then set how many items the couple picks from it.
          </p>
        </div>
      )}

      {!hideNestedEditors && dependentGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid={`eo-no-child-groups-${parentOption.id}`}>
          {configuredUnderParent.length === 0
            ? `Add a category for ${parentOption.label}.`
            : "No categories added yet. Choose one below."}
        </p>
      ) : null}

      {hideNestedEditors ? null : dependentGroups.map((dg) => {
        const optionsInGroup = template.options
          .filter((o) => o.groupId === dg.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const underParent = catalogOptionsEligibleForParentGroup(
          catalogOfferings,
          parentOption.offeringId,
          parentOption.id,
          template.groups,
          template.options,
        );
        const eligibleCatalog = itemsEligibleForCategory(
          underParent,
          catalogChoiceGroups.find((g) => g.id === dg.offeringChoiceGroupId) ?? null,
        );
        return (
          <ChildGroupEditor
            key={dg.id}
            group={dg}
            parentOption={parentOption}
            options={optionsInGroup}
            eligibleCatalog={eligibleCatalog}
            pending={pending}
            onSaveGroup={onSaveGroup}
            onRemoveGroup={() => onRemoveChildGroup(dg.id)}
            onRemoveOption={onRemoveOption}
            onAddCatalogOption={(offeringId) => onAddCatalogOption(dg.id, offeringId)}
            onAddWriteIn={(label) => onAddWriteIn(dg.id, label)}
          />
        );
      })}

      <div
        className="flex flex-wrap items-end gap-2 rounded border border-dashed border-border/70 bg-background px-3 py-2"
        data-testid={`eo-add-selection-group-${parentOption.id}`}
      >
        {availableCatalogGroups.length > 0 ? (
          <>
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Add a category from Offerings</Label>
              <select
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={pickGroupId}
                disabled={pending}
                data-testid={`eo-include-catalog-group-${parentOption.id}`}
                onChange={(e) => {
                  setPickGroupId(e.target.value);
                  setIncludeError(null);
                }}
              >
                <option value="">Choose a category…</option>
                {availableCatalogGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.memberOfferingIds.length
                      ? ` (${g.memberOfferingIds.length})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !pickGroupId}
              data-testid={`eo-add-child-group-${parentOption.id}`}
              onClick={() => {
                const err = onIncludeCatalogGroup(
                  {
                    id: parentOption.id,
                    label: parentOption.label,
                    offeringId: parentOption.offeringId,
                  },
                  pickGroupId,
                );
                if (err) {
                  setIncludeError(err);
                  return;
                }
                setPickGroupId("");
                setIncludeError(null);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add category
            </Button>
          </>
        ) : configuredUnderParent.length === 0 ? (
          <p className="w-full text-xs text-muted-foreground" data-testid={`eo-catalog-groups-missing-${parentOption.id}`}>
            {parentOption.offeringId
              ? "Create a category below, or add one in Offerings first."
              : "Add a category so clients have options when they choose this."}
          </p>
        ) : (
          <p className="w-full text-xs text-muted-foreground">
            Every category for {parentOption.label} is already added.
          </p>
        )}
        {parentOption.offeringId ? (
          <div className="flex w-full flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Or create a new category</Label>
              <Input
                value={newCategoryName}
                disabled={pending}
                placeholder="e.g. Entrées"
                data-testid={`eo-new-category-name-${parentOption.id}`}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  setIncludeError(null);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || !newCategoryName.trim()}
              data-testid={`eo-create-category-${parentOption.id}`}
              onClick={() => {
                const err = onCreateCategory(
                  { id: parentOption.id, label: parentOption.label, offeringId: parentOption.offeringId },
                  newCategoryName,
                );
                if (err) {
                  setIncludeError(err);
                  return;
                }
                setNewCategoryName("");
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create category
            </Button>
          </div>
        ) : null}
        {includeError ? (
          <p className="w-full text-xs text-destructive" role="alert">
            {includeError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type CreateCategoryFn = (
  parent: { id: string; label: string; offeringId: string | null },
  name: string,
) => string | null;

type ChoiceSetCardPropsSave = (
  group: TemplateGroup,
  patch: {
    name?: string;
    instructions?: string;
    selectCountRaw?: string;
    required?: boolean;
    simple?: SimpleSelectionState;
  },
) => string | null;

function ChildGroupEditor({
  group,
  parentOption,
  options,
  eligibleCatalog,
  pending,
  presentation = "nested",
  onSaveGroup,
  onRemoveGroup,
  onRemoveOption,
  onAddCatalogOption,
  onAddWriteIn,
  onSaveOption,
}: {
  group: TemplateGroup;
  parentOption: TemplateOption;
  options: TemplateOption[];
  eligibleCatalog: OfferingWithCategory[];
  pending: boolean;
  presentation?: "nested" | "progressive";
  onSaveGroup: ChoiceSetCardPropsSave;
  onRemoveGroup: () => void;
  onRemoveOption: (optionId: string) => void;
  onAddCatalogOption: (offeringId: string) => void;
  onAddWriteIn: (label: string) => string | null;
  onSaveOption?: (
    option: TemplateOption,
    next: { label: string; isIncluded: boolean; unitPrice: number | null },
  ) => void;
}) {
  const progressive = presentation === "progressive";
  const [name, setName] = React.useState(group.name);
  const [instructions, setInstructions] = React.useState(group.instructions ?? "");
  const [count, setCount] = React.useState(() => countDraftFromGroup(group));
  const [required, setRequired] = React.useState(group.minSelect > 0);
  const [countError, setCountError] = React.useState<string | null>(null);
  const [catalogPick, setCatalogPick] = React.useState("");
  const [writeInOpen, setWriteInOpen] = React.useState(false);
  const [writeInLabel, setWriteInLabel] = React.useState("");
  const [writeInError, setWriteInError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(group.name);
    setInstructions(group.instructions ?? "");
    setRequired(group.minSelect > 0);
    setCount(countDraftFromGroup(group));
    setCountError(null);
  }, [group.id, group.name, group.instructions, group.minSelect, group.maxSelect]);

  const impossible = impossibleSelectionGroupMessage(group, options.length);

  function commitCount(nextCount: string, nextRequired: boolean) {
    const err = onSaveGroup(group, {
      selectCountRaw: nextCount,
      required: nextRequired,
    });
    setCountError(err);
  }

  const offeringRows = (
    <ul className="space-y-1.5" data-testid={`eo-child-group-options-${group.id}`}>
      {options.map((opt) => (
        <li
          key={opt.id}
          className="space-y-2 rounded-md border border-[color:var(--htc-border-warm)] bg-card px-3 py-2 text-sm"
          data-testid={`eo-child-option-${opt.id}`}
        >
          <div className="htc-working-row flex flex-wrap items-center justify-between gap-2">
            <span>
              <span className="text-heading">{opt.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {progressive
                  ? packageBuilderPriceLabel(opt.unitPrice, opt.isIncluded)
                  : `${opt.offeringId ? "From offerings" : "Custom"} · ${packageBuilderPriceLabel(opt.unitPrice, opt.isIncluded)}`}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={pending}
              data-testid={`eo-remove-child-option-${opt.id}`}
              onClick={() => onRemoveOption(opt.id)}
              aria-label={`Remove ${opt.label}`}
            >
              Remove
            </Button>
          </div>
          {onSaveOption ? (
            <OptionCommercialEditor
              option={opt}
              pending={false}
              onSave={(next) => onSaveOption(opt, next)}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );

  const addOfferingControls = (
    <div className="flex flex-wrap items-start gap-2" data-testid={`eo-add-catalog-option-${group.id}`}>
      <CatalogPickerDisclosure
        label={progressive ? "Add an offering" : "Add item"}
        testId={`eo-open-catalog-${group.id}`}
      >
        {eligibleCatalog.length > 0 ? (
          <CategorizedOfferingSelect
            offerings={eligibleCatalog}
            sectionName={null}
            value={catalogPick}
            onChange={(id) => {
              setCatalogPick(id);
              if (id) {
                onAddCatalogOption(id);
                setCatalogPick("");
              }
            }}
            authoringScope={
              parentOption.offeringId
                ? {
                    kind: "underMajor",
                    parentOfferingId: parentOption.offeringId,
                    parentLabel: parentOption.label,
                  }
                : { kind: "all" }
            }
            emptyLabel="Choose from your offerings"
            testId={`eo-child-catalog-select-${group.id}`}
            disabled={pending}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No more offerings for {parentOption.label}. Add a custom option, or add offerings first.
          </p>
        )}
      </CatalogPickerDisclosure>
      <div className="space-y-2" data-testid={`eo-add-write-in-option-${group.id}`}>
        {!writeInOpen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            data-testid={`eo-open-write-in-${group.id}`}
            onClick={() => setWriteInOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add write-in option
          </Button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Custom option name</Label>
              <Input
                value={writeInLabel}
                disabled={pending}
                placeholder="Custom option display name"
                data-testid={`eo-write-in-label-${group.id}`}
                onChange={(e) => {
                  setWriteInLabel(e.target.value);
                  setWriteInError(null);
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              data-testid={`eo-save-write-in-${group.id}`}
              onClick={() => {
                const err = onAddWriteIn(writeInLabel);
                if (err) {
                  setWriteInError(err);
                  return;
                }
                setWriteInLabel("");
                setWriteInOpen(false);
                setWriteInError(null);
              }}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setWriteInOpen(false);
                setWriteInLabel("");
                setWriteInError(null);
              }}
            >
              Cancel
            </Button>
            {writeInError ? (
              <p className="w-full text-xs text-destructive" role="alert">
                {writeInError}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  if (progressive) {
    return (
      <div className="space-y-4" data-testid={`eo-child-group-rules-${group.id}`}>
        {options.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-[color:var(--htc-border-warm)] bg-card px-3 py-4"
            data-testid={`eo-child-group-empty-${group.id}`}
          >
            <p className="text-sm text-muted-foreground">
              Add an offering so clients have something to choose.
            </p>
          </div>
        ) : (
          offeringRows
        )}
        {addOfferingControls}
        {impossible ? (
          <p
            className="text-xs text-destructive"
            role="alert"
            data-testid={`eo-child-group-impossible-${group.id}`}
          >
            {impossible}
          </p>
        ) : null}
        <details className="rounded-md border border-border bg-card px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-heading">How clients choose</summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Input
                value={name}
                disabled={pending || Boolean(group.offeringChoiceGroupId)}
                data-testid={`eo-child-group-name-${group.id}`}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (group.offeringChoiceGroupId) return;
                  if (name.trim() && name.trim() !== group.name) {
                    onSaveGroup(group, { name: name.trim() });
                  } else {
                    setName(group.name);
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Client instruction</Label>
              <Input
                value={instructions}
                disabled={pending}
                placeholder={`e.g. Choose 2 ${group.name.toLowerCase()} for your guests`}
                data-testid={`eo-child-instructions-${group.id}`}
                onChange={(e) => setInstructions(e.target.value)}
                onBlur={() => {
                  if ((group.instructions ?? "") !== instructions) {
                    onSaveGroup(group, { instructions });
                  }
                }}
              />
            </div>
            <SimpleSelectionRuleControls
              group={group}
              pending={pending}
              testId={`eo-child-group-rule-controls-${group.id}`}
              onCommit={(simple) => onSaveGroup(group, { simple })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              data-testid={`eo-remove-child-group-${group.id}`}
              onClick={onRemoveGroup}
            >
              Remove category
            </Button>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div
      className="space-y-3 rounded border border-border/60 bg-background px-3 py-3"
      data-testid={`eo-child-group-rules-${group.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">
            {progressive
              ? "Category"
              : group.offeringChoiceGroupId
                ? "Category"
                : "Group name (legacy)"}
          </Label>
          <Input
            value={name}
            disabled={pending || Boolean(group.offeringChoiceGroupId)}
            data-testid={`eo-child-group-name-${group.id}`}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (group.offeringChoiceGroupId) return;
              if (name.trim() && name.trim() !== group.name) {
                onSaveGroup(group, { name: name.trim() });
              } else {
                setName(group.name);
              }
            }}
          />
          {progressive ? null : group.offeringChoiceGroupId ? (
            <p className="text-[0.7rem] text-muted-foreground">
              From Offerings. Rename categories in Offerings; this template keeps the name it
              had when added.
            </p>
          ) : (
            <p className="text-[0.7rem] text-muted-foreground">
              Legacy template group (created before catalog groups). Prefer including
              catalog groups for new work.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          data-testid={`eo-remove-child-group-${group.id}`}
          onClick={onRemoveGroup}
          aria-label={`Remove group ${group.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {progressive ? "Client instruction" : "Instructions for the couple"}
        </Label>
        <Input
          value={instructions}
          disabled={pending}
          placeholder={`e.g. Choose 2 ${group.name.toLowerCase()} for your guests`}
          data-testid={`eo-child-instructions-${group.id}`}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={() => {
            if ((group.instructions ?? "") !== instructions) {
              onSaveGroup(group, { instructions });
            }
          }}
        />
      </div>

      {progressive ? (
        <SimpleSelectionRuleControls
          group={group}
          pending={pending}
          testId={`eo-child-group-rule-controls-${group.id}`}
          onCommit={(simple) => onSaveGroup(group, { simple })}
        />
      ) : (
        <SelectionRuleControls
          group={group}
          selectCount={count}
          required={required}
          pending={pending}
          countError={countError}
          ids={{
            rules: `eo-child-group-rule-controls-${group.id}`,
            count: `eo-child-select-count-${group.id}`,
            required: `eo-child-required-${group.id}`,
            hint: `eo-child-rule-hint-${group.id}`,
            preset: (n) => `eo-child-count-preset-${group.id}-${n}`,
          }}
          onSelectCountChange={(raw) => {
            setCount(raw);
            setCountError(null);
          }}
          onRequiredChange={setRequired}
          onCommit={commitCount}
        />
      )}
      {impossible ? (
        <p
          className="text-xs text-destructive"
          role="alert"
          data-testid={`eo-child-group-impossible-${group.id}`}
        >
          {impossible}
        </p>
      ) : null}

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No options in this group yet.</p>
      ) : (
        offeringRows
      )}
      {addOfferingControls}
    </div>
  );
}

function CatalogPickerDisclosure({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid={testId}
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-1 h-4 w-4" />
        {label}
      </Button>
    );
  }
  return (
    <div
      className="min-w-[16rem] flex-1 space-y-2 rounded-md border border-[color:var(--htc-border-warm)] bg-card p-3"
      data-testid={testId ? `${testId}-picker` : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-heading">{label}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {children}
    </div>
  );
}

function countDraftFromGroup(group: Pick<TemplateGroup, "selectionMode" | "minSelect" | "maxSelect">): string {
  if (group.maxSelect != null) return String(group.maxSelect);
  if (group.selectionMode === "single") return "1";
  if (group.minSelect > 0) return String(group.minSelect);
  return "";
}

