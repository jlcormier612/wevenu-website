/**
 * Offering-based Event Order package builder helpers.
 * Maps catalog Offerings into the existing template groups/options model
 * without requiring venue owners to author questions first.
 */
import { choicesOptionDraftFromOffering } from "@/lib/client-choices-templates/option-catalog";
import { isDependentGroup } from "@/lib/event-order-templates/group-dependencies";
import {
  dependentGroupsForOption,
  groupsForSection,
  rootGroupsInList,
} from "@/lib/event-order-templates/section-workspace";
import type {
  AddTemplateGroupInput,
  AddTemplateOptionInput,
  EventOrderTemplateGroup,
  EventOrderTemplateLine,
  EventOrderTemplateOption,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";
import {
  childOfferings,
  majorOfferingIds,
  offeringRole,
  topLevelOfferings,
} from "@/lib/offerings/hierarchy";
import type { OfferingWithCategory } from "@/lib/offerings/types";

/** Default root choice-set name for a package category. */
export function defaultChoiceSetName(sectionName: string): string {
  const base = sectionName.trim() || "Package";
  return `${base} choices`;
}

/** Default dependent group name under a selected parent Offering. */
export function defaultChildGroupName(parentLabel: string): string {
  const base = parentLabel.trim() || "Choice";
  return `${base} options`;
}

/** Offering ids already used as always-on lines in a section. */
export function alwaysOnOfferingIds(
  lines: EventOrderTemplateLine[],
  sectionId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    if (line.sectionId === sectionId && line.offeringId) ids.add(line.offeringId);
  }
  return ids;
}

/** Offering ids already used as couple-choice options in a section. */
export function coupleChoiceOfferingIds(
  groups: EventOrderTemplateGroup[],
  options: EventOrderTemplateOption[],
  sectionId: string,
): Set<string> {
  const sectionGroupIds = new Set(
    groupsForSection(groups, sectionId).map((g) => g.id),
  );
  const ids = new Set<string>();
  for (const opt of options) {
    if (sectionGroupIds.has(opt.groupId) && opt.offeringId) ids.add(opt.offeringId);
  }
  return ids;
}

/**
 * Top-level Offerings available to add under Couple's choices for a section.
 * Excludes archived, child items, and offerings already used as always-on or choices.
 */
export function offeringsAvailableForCoupleChoices(
  catalog: OfferingWithCategory[],
  template: Pick<EventOrderTemplateWithDetails, "lines" | "groups" | "options">,
  sectionId: string,
): OfferingWithCategory[] {
  const blocked = new Set<string>([
    ...alwaysOnOfferingIds(template.lines, sectionId),
    ...coupleChoiceOfferingIds(template.groups, template.options, sectionId),
  ]);
  return topLevelOfferings(catalog).filter((o) => !blocked.has(o.id));
}

/** Catalog children for a parent, excluding ones already attached under that parent option. */
export function catalogChildrenForParentOption(
  catalog: OfferingWithCategory[],
  parentOfferingId: string,
  parentOptionId: string,
  groups: EventOrderTemplateGroup[],
  options: EventOrderTemplateOption[],
): {
  available: OfferingWithCategory[];
  selected: EventOrderTemplateOption[];
  selectedOfferingIds: Set<string>;
} {
  const children = childOfferings(catalog, parentOfferingId);
  const depGroups = dependentGroupsForOption(groups, parentOptionId);
  const depGroupIds = new Set(depGroups.map((g) => g.id));
  const selected = options
    .filter((o) => depGroupIds.has(o.groupId) && o.offeringId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedOfferingIds = new Set(
    selected.map((o) => o.offeringId!).filter(Boolean),
  );
  return {
    available: children,
    selected,
    selectedOfferingIds,
  };
}

/** Draft option write input from a catalog Offering. */
export function optionInputFromOffering(
  groupId: string,
  offering: OfferingWithCategory,
): AddTemplateOptionInput {
  const draft = choicesOptionDraftFromOffering(offering);
  return {
    groupId,
    offeringId: draft.offeringId,
    label: draft.label,
    isIncluded: draft.isIncluded,
    unitPrice: draft.isIncluded
      ? "0"
      : draft.unitPrice != null
        ? String(draft.unitPrice)
        : null,
    isDefault: false,
  };
}

/** Create-input for a new root choice set in a section. */
export function newRootChoiceSetInput(
  sectionId: string,
  sectionName: string,
): AddTemplateGroupInput {
  return {
    sectionId,
    name: defaultChoiceSetName(sectionName),
    instructions: "",
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    dependsOnOptionIds: [],
  };
}

/** Create-input for a dependent child-options group under a parent option. */
export function newChildGroupUnderParentInput(
  sectionId: string,
  parentOption: Pick<EventOrderTemplateOption, "id" | "label">,
  name?: string,
): AddTemplateGroupInput {
  return {
    sectionId,
    name: name?.trim() || defaultChildGroupName(parentOption.label),
    instructions: `Shown only after the client chooses “${parentOption.label}”.`,
    selectionMode: "multi",
    minSelect: 0,
    maxSelect: null,
    allowQuantity: false,
    dependsOnOptionIds: [parentOption.id],
  };
}

export type ChoiceSetView = {
  group: EventOrderTemplateGroup;
  options: EventOrderTemplateOption[];
};

/** Root choice sets for a section, each with their options. */
export function choiceSetsForSection(
  template: Pick<EventOrderTemplateWithDetails, "groups" | "options">,
  sectionId: string,
): ChoiceSetView[] {
  const roots = rootGroupsInList(groupsForSection(template.groups, sectionId));
  return roots.map((group) => ({
    group,
    options: template.options
      .filter((o) => o.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export type ParentChoiceView = {
  option: EventOrderTemplateOption;
  role: "major" | "standalone" | "item";
  catalogChildren: OfferingWithCategory[];
  selectedChildOptions: EventOrderTemplateOption[];
  selectedChildOfferingIds: Set<string>;
  dependentGroups: EventOrderTemplateGroup[];
};

/** Enrich a root option with catalog hierarchy for the Couple's choices UI. */
export function parentChoiceView(
  option: EventOrderTemplateOption,
  catalog: OfferingWithCategory[],
  groups: EventOrderTemplateGroup[],
  options: EventOrderTemplateOption[],
): ParentChoiceView {
  const majors = majorOfferingIds(catalog);
  const offering = option.offeringId
    ? catalog.find((o) => o.id === option.offeringId)
    : undefined;
  const role = offering
    ? offeringRole(offering, majors)
    : ("standalone" as const);
  const parentOfferingId = option.offeringId ?? "";
  const childInfo = parentOfferingId
    ? catalogChildrenForParentOption(
        catalog,
        parentOfferingId,
        option.id,
        groups,
        options,
      )
    : {
        available: [] as OfferingWithCategory[],
        selected: [] as EventOrderTemplateOption[],
        selectedOfferingIds: new Set<string>(),
      };
  return {
    option,
    role,
    catalogChildren: childInfo.available,
    selectedChildOptions: childInfo.selected,
    selectedChildOfferingIds: childInfo.selectedOfferingIds,
    dependentGroups: dependentGroupsForOption(groups, option.id),
  };
}

/** True when a group is a root (not depends_on) choice set. */
export function isRootChoiceSet(
  group: Pick<EventOrderTemplateGroup, "dependsOnOptionIds">,
): boolean {
  return !isDependentGroup(group);
}

/** Format a short price label for package builder lists. */
export function packageBuilderPriceLabel(
  unitPrice: number | null | undefined,
  isIncluded: boolean,
): string {
  if (isIncluded || unitPrice == null || unitPrice === 0) {
    if (isIncluded && (unitPrice == null || unitPrice === 0)) {
      return "No extra charge";
    }
  }
  if (unitPrice == null) return "No price set";
  if (unitPrice === 0) return "No extra charge";
  return `$${unitPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
