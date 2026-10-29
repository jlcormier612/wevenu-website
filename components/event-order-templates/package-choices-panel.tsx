"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  addEventOrderTemplateGroupAction,
  addEventOrderTemplateOptionAction,
  removeEventOrderTemplateGroupAction,
  removeEventOrderTemplateOptionAction,
  updateEventOrderTemplateGroupAction,
} from "@/app/(app)/library/event-order-templates/actions";
import { CategorizedOfferingSelect } from "@/components/event-order-templates/categorized-offering-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { plainSelectionRuleLabel, resolvePlainSelectionRule } from "@/lib/event-order-templates/guided-setup";
import {
  choiceSetsForSection,
  newChildGroupUnderParentInput,
  newRootChoiceSetInput,
  offeringsAvailableForCoupleChoices,
  optionInputFromOffering,
  packageBuilderPriceLabel,
  parentChoiceView,
} from "@/lib/event-order-templates/offering-package-builder";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

type Props = {
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  sectionId: string;
  sectionName: string;
  onPersist: (phase: "saving" | "saved" | "error", message?: string) => void;
};

/**
 * Couple's choices — Offering-first package builder.
 * Venue selects catalog Offerings; the section placement determines behavior.
 * Does not require creating questions before picking Offerings.
 */
export function PackageChoicesPanel({
  template,
  catalogOfferings,
  sectionId,
  sectionName,
  onPersist,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [pickBySet, setPickBySet] = React.useState<Record<string, string>>({});
  const [newSetPick, setNewSetPick] = React.useState("");
  /** Optimistic child Offering checks — props lag until router.refresh completes. */
  const [childOverrides, setChildOverrides] = React.useState<Record<string, boolean>>({});

  const choiceSets = React.useMemo(
    () => choiceSetsForSection(template, sectionId),
    [template, sectionId],
  );

  React.useEffect(() => {
    setChildOverrides((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const set of choiceSets) {
        for (const opt of set.options) {
          const view = parentChoiceView(opt, catalogOfferings, template.groups, template.options);
          for (const child of view.catalogChildren) {
            const key = `${opt.id}:${child.id}`;
            if (next[key] === undefined) continue;
            const persisted = view.selectedChildOfferingIds.has(child.id);
            if (next[key] === persisted) {
              delete next[key];
              changed = true;
            }
          }
        }
      }
      return changed ? next : prev;
    });
  }, [choiceSets, catalogOfferings, template.groups, template.options]);

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

  async function ensureChildGroup(
    parentOption: { id: string; label: string },
  ): Promise<string | null> {
    const view = parentChoiceView(
      parentOption as typeof template.options[0],
      catalogOfferings,
      template.groups,
      template.options,
    );
    if (view.dependentGroups[0]) return view.dependentGroups[0].id;
    const created = await addEventOrderTemplateGroupAction(
      template.id,
      newChildGroupUnderParentInput(sectionId, parentOption),
    );
    if (!created.ok) return null;
    return created.group.id;
  }

  function toggleChild(
    parentOption: { id: string; label: string },
    child: OfferingWithCategory,
    currentlySelected: boolean,
    selectedOptionId: string | undefined,
  ) {
    const key = `${parentOption.id}:${child.id}`;
    setChildOverrides((prev) => ({ ...prev, [key]: !currentlySelected }));
    startTransition(async () => {
      onPersist("saving");
      if (currentlySelected && selectedOptionId) {
        const r = await removeEventOrderTemplateOptionAction(template.id, selectedOptionId);
        if (!r.ok) {
          setChildOverrides((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          onPersist("error", r.message ?? "Could not remove child Offering.");
          return;
        }
        onPersist("saved");
        refresh();
        return;
      }
      const groupId = await ensureChildGroup(parentOption);
      if (!groupId) {
        setChildOverrides((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        onPersist("error", "Could not create options under this choice.");
        return;
      }
      const r = await addEventOrderTemplateOptionAction(
        template.id,
        optionInputFromOffering(groupId, child),
      );
      if (!r.ok) {
        setChildOverrides((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        onPersist("error", r.errors?.label ?? r.message ?? "Could not add child Offering.");
        return;
      }
      onPersist("saved");
      refresh();
    });
  }

  function saveInstructions(groupId: string, instructions: string, existing: typeof choiceSets[0]["group"]) {
    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateGroupAction(template.id, groupId, {
        sectionId: existing.sectionId,
        name: existing.name,
        instructions,
        selectionMode: existing.selectionMode,
        minSelect: existing.minSelect,
        maxSelect: existing.maxSelect,
        allowQuantity: existing.allowQuantity,
        dependsOnOptionIds: existing.dependsOnOptionIds ?? [],
      });
      if (!r.ok) onPersist("error", r.message ?? "Could not save instructions.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  function saveSelectCount(
    group: typeof choiceSets[0]["group"],
    selectCountRaw: string,
    required: boolean,
  ) {
    const parsed = selectCountRaw.trim() === "" ? null : Number(selectCountRaw);
    const resolved = resolvePlainSelectionRule({
      selectCount: parsed != null && Number.isFinite(parsed) ? parsed : null,
      required,
    });
    startTransition(async () => {
      onPersist("saving");
      const r = await updateEventOrderTemplateGroupAction(template.id, group.id, {
        sectionId: group.sectionId,
        name: group.name,
        instructions: group.instructions ?? undefined,
        selectionMode: resolved.selectionMode,
        minSelect: resolved.minSelect,
        maxSelect: resolved.maxSelect,
        allowQuantity: group.allowQuantity,
        dependsOnOptionIds: group.dependsOnOptionIds ?? [],
      });
      if (!r.ok) onPersist("error", r.message ?? "Could not save selection rule.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  function addChildGroupUnder(parentOption: { id: string; label: string }) {
    startTransition(async () => {
      onPersist("saving");
      const r = await addEventOrderTemplateGroupAction(
        template.id,
        newChildGroupUnderParentInput(sectionId, parentOption),
      );
      if (!r.ok) onPersist("error", r.message ?? "Could not add selection group.");
      else {
        onPersist("saved");
        refresh();
      }
    });
  }

  return (
    <div className="space-y-6" data-testid="eo-package-choices-panel">
      <p className="text-sm text-muted-foreground">
        Select Offerings from your catalog. Items here are available for the couple to choose —
        not automatically on the package. When you add a parent Offering, pick which of its
        existing child Offerings belong in this package.
      </p>

      {choiceSets.length === 0 ? (
        <div
          className="space-y-3 rounded-lg border border-dashed border-border p-4"
          data-testid="eo-package-choices-empty"
        >
          <p className="text-sm text-muted-foreground">
            No couple choices yet. Add an Offering to start.
          </p>
          <div className="space-y-2" data-testid="eo-package-choices-add-first">
            <Label className="text-xs text-muted-foreground">Add Offering</Label>
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
          onRemoveOption={removeOption}
          onRemoveSet={() => removeChoiceSet(set.group.id)}
          onSaveInstructions={(text) => saveInstructions(set.group.id, text, set.group)}
          onSaveSelectCount={(count, required) => saveSelectCount(set.group, count, required)}
          onToggleChild={toggleChild}
          onAddChildGroup={addChildGroupUnder}
          onSaveChildRule={(group, count, required) => saveSelectCount(group, count, required)}
          childOverrides={childOverrides}
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
  available,
  pickValue,
  pending,
  onPickChange,
  onRemoveOption,
  onRemoveSet,
  onSaveInstructions,
  onSaveSelectCount,
  onToggleChild,
  onAddChildGroup,
  onSaveChildRule,
  childOverrides,
}: {
  setIndex: number;
  set: ReturnType<typeof choiceSetsForSection>[number];
  template: EventOrderTemplateWithDetails;
  catalogOfferings: OfferingWithCategory[];
  available: OfferingWithCategory[];
  pickValue: string;
  pending: boolean;
  childOverrides: Record<string, boolean>;
  onPickChange: (id: string) => void;
  onRemoveOption: (optionId: string) => void;
  onRemoveSet: () => void;
  onSaveInstructions: (text: string) => void;
  onSaveSelectCount: (count: string, required: boolean) => void;
  onToggleChild: (
    parent: { id: string; label: string },
    child: OfferingWithCategory,
    selected: boolean,
    selectedOptionId: string | undefined,
  ) => void;
  onAddChildGroup: (parent: { id: string; label: string }) => void;
  onSaveChildRule: (
    group: EventOrderTemplateWithDetails["groups"][number],
    count: string,
    required: boolean,
  ) => void;
}) {
  const [instructionsDraft, setInstructionsDraft] = React.useState(set.group.instructions ?? "");
  const [selectCount, setSelectCount] = React.useState(() => {
    if (set.group.selectionMode === "single") return "1";
    if (set.group.maxSelect != null) return String(set.group.maxSelect);
    if (set.group.minSelect > 0) return String(set.group.minSelect);
    return "";
  });
  const [required, setRequired] = React.useState(set.group.minSelect > 0);

  React.useEffect(() => {
    setInstructionsDraft(set.group.instructions ?? "");
    setRequired(set.group.minSelect > 0);
    if (set.group.selectionMode === "single") setSelectCount("1");
    else if (set.group.maxSelect != null) setSelectCount(String(set.group.maxSelect));
    else if (set.group.minSelect > 0) setSelectCount(String(set.group.minSelect));
    else setSelectCount("");
  }, [set.group.id, set.group.instructions, set.group.selectionMode, set.group.minSelect, set.group.maxSelect]);

  const sectionName =
    template.sections.find((s) => s.id === set.group.sectionId)?.name ?? "Package";

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
          placeholder='Example: Choose either Buffet Style Dinner or Plated Dinner. For the style you select, choose from the available options.'
          data-testid={`eo-choice-instructions-${setIndex}`}
          onChange={(e) => setInstructionsDraft(e.target.value)}
          onBlur={() => {
            if ((set.group.instructions ?? "") !== instructionsDraft) {
              onSaveInstructions(instructionsDraft);
            }
          }}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3" data-testid={`eo-choice-set-rules-${setIndex}`}>
        <div className="space-y-1">
          <Label htmlFor={`eo-count-${set.group.id}`} className="text-xs text-muted-foreground">
            How many can they select?
          </Label>
          <Input
            id={`eo-count-${set.group.id}`}
            className="w-20"
            inputMode="numeric"
            value={selectCount}
            disabled={pending}
            data-testid={`eo-choice-select-count-${setIndex}`}
            onChange={(e) => setSelectCount(e.target.value)}
            onBlur={() => onSaveSelectCount(selectCount, required)}
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
              onSaveSelectCount(selectCount, e.target.checked);
            }}
          />
          Required
        </label>
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
                <div>
                  <p className="font-medium text-heading">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {packageBuilderPriceLabel(opt.unitPrice, opt.isIncluded)}
                    {view.role === "major" ? " · Parent Offering" : null}
                    {view.role === "standalone" ? " · Standalone Offering" : null}
                  </p>
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

              {view.catalogChildren.length > 0 ? (
                <div className="mt-3 space-y-2" data-testid={`eo-parent-children-${opt.id}`}>
                  <p className="text-xs font-medium text-heading">
                    Child Offerings available for this package
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Only checked items are offered to the couple when they select {opt.label}.
                  </p>
                  <ul className="space-y-1.5">
                    {view.catalogChildren.map((child) => {
                      const overrideKey = `${opt.id}:${child.id}`;
                      const selected =
                        childOverrides[overrideKey] !== undefined
                          ? childOverrides[overrideKey]!
                          : view.selectedChildOfferingIds.has(child.id);
                      const selectedOpt = view.selectedChildOptions.find(
                        (o) => o.offeringId === child.id,
                      );
                      return (
                        <li key={child.id}>
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selected}
                              disabled={pending}
                              data-testid={`eo-child-toggle-${opt.id}-${child.id}`}
                              onChange={() =>
                                onToggleChild(
                                  { id: opt.id, label: opt.label },
                                  child,
                                  selected,
                                  selectedOpt?.id,
                                )
                              }
                            />
                            <span>
                              <span className="text-heading">{child.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {packageBuilderPriceLabel(
                                  child.defaultUnitPrice,
                                  child.defaultUnitPrice == null || child.defaultUnitPrice === 0,
                                )}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  {view.dependentGroups.map((dg) => (
                    <ChildGroupRules
                      key={dg.id}
                      group={dg}
                      pending={pending}
                      onSave={(count, req) => onSaveChildRule(dg, count, req)}
                    />
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    data-testid={`eo-add-child-group-${opt.id}`}
                    onClick={() => onAddChildGroup({ id: opt.id, label: opt.label })}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add another selection group under {opt.label}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="space-y-2" data-testid={`eo-choice-set-add-${setIndex}`}>
        <Label className="text-xs text-muted-foreground">Add Offering</Label>
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

function ChildGroupRules({
  group,
  pending,
  onSave,
}: {
  group: EventOrderTemplateWithDetails["groups"][number];
  pending: boolean;
  onSave: (count: string, required: boolean) => void;
}) {
  const [count, setCount] = React.useState(() => {
    if (group.maxSelect != null) return String(group.maxSelect);
    if (group.minSelect > 0) return String(group.minSelect);
    return "";
  });
  const [required, setRequired] = React.useState(group.minSelect > 0);

  React.useEffect(() => {
    setRequired(group.minSelect > 0);
    if (group.maxSelect != null) setCount(String(group.maxSelect));
    else if (group.minSelect > 0) setCount(String(group.minSelect));
    else setCount("");
  }, [group.id, group.minSelect, group.maxSelect]);

  return (
    <div
      className="mt-2 flex flex-wrap items-end gap-3 rounded border border-border/60 bg-background px-3 py-2"
      data-testid={`eo-child-group-rules-${group.id}`}
    >
      <p className="w-full text-xs font-medium text-heading">{group.name}</p>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">How many from this group?</Label>
        <Input
          className="w-20"
          inputMode="numeric"
          value={count}
          disabled={pending}
          data-testid={`eo-child-select-count-${group.id}`}
          onChange={(e) => setCount(e.target.value)}
          onBlur={() => onSave(count, required)}
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
            onSave(count, e.target.checked);
          }}
        />
        Required
      </label>
      <p className="text-xs text-muted-foreground">{plainSelectionRuleLabel(group)}</p>
    </div>
  );
}
