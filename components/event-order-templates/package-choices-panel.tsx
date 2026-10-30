"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  addEventOrderTemplateGroupAction,
  addEventOrderTemplateOptionAction,
  includeCatalogChoiceGroupAction,
  removeEventOrderTemplateGroupAction,
  removeEventOrderTemplateOptionAction,
  updateEventOrderTemplateGroupAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { createOfferingChoiceGroupAction } from "@/app/(app)/library/offerings/actions";
import { CategorizedOfferingSelect } from "@/components/event-order-templates/categorized-offering-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Props = {
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  catalogChoiceGroups?: OfferingChoiceGroup[];
  sectionId: string;
  sectionName: string;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
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
    },
  ): string | null {
    const required = patch.required ?? group.minSelect > 0;
    let selectionMode = group.selectionMode;
    let minSelect = group.minSelect;
    let maxSelect = group.maxSelect;
    if (patch.selectCountRaw !== undefined) {
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
        allowQuantity: group.allowQuantity,
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

  return (
    <div className="space-y-6" data-testid="eo-package-choices-panel">
      <p className="text-xs text-muted-foreground">
        Offerings the couple picks between, and how many they must choose.
      </p>

      {choiceSets.length === 0 ? (
        <div
          className="space-y-3 rounded-lg border border-dashed border-border p-4"
          data-testid="eo-package-choices-empty"
        >
          <p className="text-sm text-muted-foreground">
            No couple choices yet. Add the first top choice (for example Plated Dinner) to start.
          </p>
          <div className="space-y-2" data-testid="eo-package-choices-add-first">
            <Label className="text-xs text-muted-foreground">Add a top choice</Label>
            <CategorizedOfferingSelect
              offerings={available}
              sectionName={sectionName}
              value={newSetPick}
              onChange={(id) => {
                setNewSetPick(id);
                if (id) createChoiceSetWithOffering(id);
              }}
              authoringScope={{ kind: "primary" }}
              emptyLabel="Choose an Offering…"
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
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>
      ) : null}
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

  React.useEffect(() => {
    setInstructionsDraft(set.group.instructions ?? "");
    setRequired(set.group.minSelect > 0);
    setSelectCount(countDraftFromGroup(set.group));
    setCountError(null);
  }, [set.group.id, set.group.instructions, set.group.selectionMode, set.group.minSelect, set.group.maxSelect]);

  const sectionName =
    template.sections.find((s) => s.id === set.group.sectionId)?.name ?? "Package";

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

      <div className="flex flex-wrap items-end gap-3" data-testid={`eo-choice-set-rules-${setIndex}`}>
        <div className="space-y-1">
          <Label htmlFor={`eo-count-${set.group.id}`} className="text-xs text-muted-foreground">
            How many must the couple choose?
          </Label>
          <Input
            id={`eo-count-${set.group.id}`}
            className="w-20"
            inputMode="numeric"
            value={selectCount}
            disabled={pending}
            data-testid={`eo-choice-select-count-${setIndex}`}
            onChange={(e) => {
              setSelectCount(e.target.value);
              setCountError(null);
            }}
            onBlur={() => commitCount(selectCount, required)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            disabled={pending}
            data-testid={`eo-choice-required-${setIndex}`}
            onChange={(e) => {
              setRequired(e.target.checked);
              commitCount(selectCount, e.target.checked);
            }}
          />
          Required
        </label>
        {countError ? (
          <p className="w-full text-xs text-destructive" role="alert">
            {countError}
          </p>
        ) : null}
      </div>

      <ul className="space-y-4" data-testid={`eo-choice-set-options-${setIndex}`}>
        {set.options.map((opt) => {
          const view = parentChoiceView(
            opt,
            catalogOfferings,
            template.groups,
            template.options,
          );
          return (
            <li
              key={opt.id}
              className="rounded-md border border-border/80 bg-muted/20 p-3"
              data-testid={`eo-choice-option-${opt.id}`}
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
      <div>
        <p className="text-xs font-medium text-heading">
          Under {parentOption.label}: categories the couple picks from
        </p>
        <p className="text-xs text-muted-foreground">
          Shown only when the couple chooses {parentOption.label}. Add a category (for example
          Entrées or Desserts), then set how many items the couple picks from it.
        </p>
      </div>

      {dependentGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid={`eo-no-child-groups-${parentOption.id}`}>
          {configuredUnderParent.length === 0
            ? `No categories under ${parentOption.label} yet. Create one below, or set them up in Offerings.`
            : "No categories added yet. Choose one below."}
        </p>
      ) : null}

      {dependentGroups.map((dg) => {
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
            No categories under {parentOption.label} in Offerings yet.
          </p>
        ) : (
          <p className="w-full text-xs text-muted-foreground">
            Every category under {parentOption.label} is already added.
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
  },
) => string | null;

function ChildGroupEditor({
  group,
  parentOption,
  options,
  eligibleCatalog,
  pending,
  onSaveGroup,
  onRemoveGroup,
  onRemoveOption,
  onAddCatalogOption,
  onAddWriteIn,
}: {
  group: TemplateGroup;
  parentOption: TemplateOption;
  options: TemplateOption[];
  eligibleCatalog: OfferingWithCategory[];
  pending: boolean;
  onSaveGroup: ChoiceSetCardPropsSave;
  onRemoveGroup: () => void;
  onRemoveOption: (optionId: string) => void;
  onAddCatalogOption: (offeringId: string) => void;
  onAddWriteIn: (label: string) => string | null;
}) {
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

  return (
    <div
      className="space-y-3 rounded border border-border/60 bg-background px-3 py-3"
      data-testid={`eo-child-group-rules-${group.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">
            {group.offeringChoiceGroupId ? "Category" : "Group name (legacy)"}
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
          {group.offeringChoiceGroupId ? (
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
        <Label className="text-xs text-muted-foreground">Instructions for the couple</Label>
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            How many must the couple choose?
          </Label>
          <Input
            className="w-20"
            inputMode="numeric"
            value={count}
            disabled={pending}
            data-testid={`eo-child-select-count-${group.id}`}
            onChange={(e) => {
              setCount(e.target.value);
              setCountError(null);
            }}
            onBlur={() => commitCount(count, required)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            disabled={pending}
            data-testid={`eo-child-required-${group.id}`}
            onChange={(e) => {
              setRequired(e.target.checked);
              commitCount(count, e.target.checked);
            }}
          />
          Required
        </label>
        <p className="text-xs text-muted-foreground">{plainSelectionRuleLabel(group)}</p>
      </div>
      {countError ? (
        <p className="text-xs text-destructive" role="alert">
          {countError}
        </p>
      ) : null}
      {impossible ? (
        <p
          className="text-xs text-destructive"
          role="alert"
          data-testid={`eo-child-group-impossible-${group.id}`}
        >
          {impossible}
        </p>
      ) : null}

      <ul className="space-y-1.5" data-testid={`eo-child-group-options-${group.id}`}>
        {options.map((opt) => (
          <li
            key={opt.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/40 px-2 py-1.5 text-sm"
            data-testid={`eo-child-option-${opt.id}`}
          >
            <span>
              <span className="text-heading">{opt.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {opt.offeringId ? "Catalog" : "Write-in"}
                {" · "}
                {packageBuilderPriceLabel(opt.unitPrice, opt.isIncluded)}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              data-testid={`eo-remove-child-option-${opt.id}`}
              onClick={() => onRemoveOption(opt.id)}
              aria-label={`Remove ${opt.label}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {options.length === 0 ? (
          <li className="text-xs text-muted-foreground">No options in this group yet.</li>
        ) : null}
      </ul>

      <div className="space-y-2" data-testid={`eo-add-catalog-option-${group.id}`}>
        <Label className="text-xs text-muted-foreground">Add item</Label>
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
            emptyLabel={`Choose an item under ${parentOption.label}…`}
            testId={`eo-child-catalog-select-${group.id}`}
            disabled={pending}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            No more items under {parentOption.label} in Offerings. Use a write-in option, or add
            items under {parentOption.label} on the Offerings page.
          </p>
        )}
      </div>

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
              <Label className="text-xs text-muted-foreground">Write-in option name</Label>
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
              Save write-in
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
}

function countDraftFromGroup(group: Pick<TemplateGroup, "selectionMode" | "minSelect" | "maxSelect">): string {
  if (group.maxSelect != null) return String(group.maxSelect);
  if (group.selectionMode === "single") return "1";
  if (group.minSelect > 0) return String(group.minSelect);
  return "";
}

