/**
 * Guided Event Order Template setup — plain-language helpers over the
 * existing section / group / option / dependency model. No choice-tree rewrite.
 */
import { isDependentGroup } from "@/lib/event-order-templates/group-dependencies";
import { linesForSection } from "@/lib/event-order-templates/offerings";
import {
  dependentGroupsForOption,
  groupsForSection,
  rootGroupsInList,
  sectionCompletenessIssues,
} from "@/lib/event-order-templates/section-workspace";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
  EventOrderTemplateSection,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

export type SuggestedCategoryKey =
  | "catering"
  | "bar"
  | "rentals"
  | "services"
  | "florals"
  | "decor"
  | "custom";

export type SuggestedCategory = {
  key: SuggestedCategoryKey;
  name: string;
  description: string;
  /** Alternate section names that already map to this suggestion. */
  aliases: string[];
};

export const SUGGESTED_CATEGORIES: readonly SuggestedCategory[] = [
  {
    key: "catering",
    name: "Catering",
    description: "Meals and food service you provide or coordinate for the event.",
    aliases: ["catering", "food", "food and beverage", "dining"],
  },
  {
    key: "bar",
    name: "Bar Service",
    description: "Bar packages or beverage service managed by your venue.",
    aliases: ["bar", "bar service", "beverages"],
  },
  {
    key: "rentals",
    name: "Rentals",
    description: "Furniture, linens, and other rental products clients may add.",
    aliases: ["rentals", "rental"],
  },
  {
    key: "services",
    name: "Services",
    description: "Coordination, staffing, and other service offerings.",
    aliases: ["services", "service", "coordination", "staffing"],
  },
  {
    key: "florals",
    name: "Florals",
    description: "Floral design you sell or coordinate through this Event Order.",
    aliases: ["florals", "floral", "flowers"],
  },
  {
    key: "decor",
    name: "Décor",
    description: "Décor packages or à la carte décor clients can choose.",
    aliases: ["decor", "décor", "decoration", "decorations"],
  },
] as const;

/** Plain-language configuration patterns (maps onto lines + choice groups). */
export type ConfigPatternId =
  | "included"
  | "choose_one"
  | "choose_many"
  | "choose_then_related"
  | "optional_add";

export type ConfigPattern = {
  id: ConfigPatternId;
  title: string;
  clientExperience: string;
};

export const CONFIG_PATTERNS: readonly ConfigPattern[] = [
  {
    id: "included",
    title: "One or more items are already included",
    clientExperience:
      "Clients see these as included with the package — not as extra charges they must pick.",
  },
  {
    id: "choose_one",
    title: "The client chooses one option",
    clientExperience: "Example: choose Plated Dinner or Buffet Dinner — one selection.",
  },
  {
    id: "choose_many",
    title: "The client can choose multiple options",
    clientExperience: "Example: select several rental products from a list.",
  },
  {
    id: "choose_then_related",
    title: "The client chooses a main option, then sees related options",
    clientExperience:
      "Example: choosing Plated Dinner reveals only plated follow-ups; Buffet reveals buffet follow-ups.",
  },
  {
    id: "optional_add",
    title: "The client can optionally add items",
    clientExperience: "Example: optional upgrades or rentals — none required.",
  },
] as const;

export type WizardPhase = "categories" | "configure" | "review" | "preview";

export type CategoryConfigureSubstep = "patterns" | "fixed" | "choices" | "branches";

export function normalizeCategoryLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchSuggestedCategory(sectionName: string): SuggestedCategory | null {
  const n = normalizeCategoryLabel(sectionName);
  for (const cat of SUGGESTED_CATEGORIES) {
    const names = [cat.name, ...cat.aliases].map(normalizeCategoryLabel);
    if (names.some((a) => a === n || n.includes(a) || a.includes(n))) return cat;
  }
  return null;
}

export function canonicalSectionNameForSuggested(key: SuggestedCategoryKey): string {
  if (key === "custom") return "";
  return SUGGESTED_CATEGORIES.find((c) => c.key === key)?.name ?? "";
}

/** Sections the venue is currently offering in this template (all persisted sections). */
export function selectedCategoryKeysFromTemplate(
  sections: EventOrderTemplateSection[],
): { suggested: SuggestedCategoryKey[]; customNames: string[] } {
  const suggested = new Set<SuggestedCategoryKey>();
  const customNames: string[] = [];
  for (const s of sections) {
    const match = matchSuggestedCategory(s.name);
    if (match) suggested.add(match.key);
    else customNames.push(s.name);
  }
  return { suggested: [...suggested], customNames };
}

export function detectPatternsForSection(
  template: EventOrderTemplateWithDetails,
  sectionId: string,
): ConfigPatternId[] {
  const found = new Set<ConfigPatternId>();
  const lines = linesForSection(template.lines, sectionId);
  if (lines.some((l) => l.includedByDefault) || lines.length > 0) found.add("included");

  const groups = groupsForSection(template.groups, sectionId);
  const roots = rootGroupsInList(groups);
  for (const g of roots) {
    const hasDependent = template.options
      .filter((o) => o.groupId === g.id)
      .some((o) => dependentGroupsForOption(groups, o.id).length > 0);
    if (hasDependent) found.add("choose_then_related");

    if (g.minSelect === 0 && g.selectionMode === "multi") {
      found.add("optional_add");
      found.add("choose_many");
    } else if (g.selectionMode === "multi") {
      found.add("choose_many");
    } else if (g.selectionMode === "single" && g.minSelect >= 1) {
      found.add("choose_one");
    } else if (g.selectionMode === "single" && g.minSelect === 0) {
      found.add("optional_add");
    }
  }
  return [...found];
}

/** Wizard-owned pattern selections keyed by section — survives category tab switches. */
export type PatternDraftBySection = Record<string, ConfigPatternId[]>;

/**
 * Seed drafts for sections that have no entry yet (from persisted template content).
 * Never overwrite an existing draft — tab switches and template refreshes must not
 * discard unpersisted pattern picks.
 */
export function seedPatternDraftsFromTemplate(
  template: EventOrderTemplateWithDetails,
  sectionIds: string[],
  existing: PatternDraftBySection,
): PatternDraftBySection {
  let changed = false;
  const next: PatternDraftBySection = { ...existing };
  const idSet = new Set(sectionIds);
  for (const id of sectionIds) {
    if (next[id] === undefined) {
      next[id] = detectPatternsForSection(template, id);
      changed = true;
    }
  }
  for (const key of Object.keys(next)) {
    if (!idSet.has(key)) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? next : existing;
}

export function togglePatternInDraft(
  drafts: PatternDraftBySection,
  sectionId: string,
  patternId: ConfigPatternId,
): PatternDraftBySection {
  const cur = drafts[sectionId] ?? [];
  const patterns = cur.includes(patternId)
    ? cur.filter((p) => p !== patternId)
    : [...cur, patternId];
  return { ...drafts, [sectionId]: patterns };
}

/** Snapshot of all category pattern selections for Continue / review / tests. */
export function patternsPayloadFromDrafts(
  drafts: PatternDraftBySection,
  sectionIds: string[],
): Array<{ sectionId: string; patterns: ConfigPatternId[] }> {
  return sectionIds.map((sectionId) => ({
    sectionId,
    patterns: [...(drafts[sectionId] ?? [])],
  }));
}

export type BranchGuideItem = {
  optionId: string;
  optionLabel: string;
  parentGroupId: string;
  parentGroupName: string;
  dependents: EventOrderTemplateGroup[];
  incomplete: boolean;
};

/** Parent options that may need follow-up branches (pattern D). */
export function branchGuideForSection(
  template: EventOrderTemplateWithDetails,
  sectionId: string,
): BranchGuideItem[] {
  const groups = groupsForSection(template.groups, sectionId);
  const roots = rootGroupsInList(groups);
  const items: BranchGuideItem[] = [];
  for (const g of roots) {
    const opts = template.options
      .filter((o) => o.groupId === g.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const o of opts) {
      const dependents = dependentGroupsForOption(groups, o.id);
      const incomplete = dependents.some(
        (d) => template.options.filter((x) => x.groupId === d.id).length === 0,
      );
      items.push({
        optionId: o.id,
        optionLabel: o.label,
        parentGroupId: g.id,
        parentGroupName: g.name,
        dependents,
        incomplete,
      });
    }
  }
  return items;
}

export type ReviewCategorySummary = {
  sectionId: string;
  name: string;
  guidance: string | null;
  fixedLines: { id: string; description: string; included: boolean; price: number | null; catalog: boolean }[];
  groups: {
    id: string;
    name: string;
    selectionMode: string;
    required: boolean;
    isDependent: boolean;
    dependsOnLabels: string[];
    incomplete: boolean;
    options: {
      id: string;
      label: string;
      unitPrice: number | null;
      isIncluded: boolean;
      catalog: boolean;
    }[];
  }[];
  incompleteMessages: string[];
};

export function buildReviewSummary(template: EventOrderTemplateWithDetails): ReviewCategorySummary[] {
  const optionById = new Map(template.options.map((o) => [o.id, o]));
  const sections = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  return sections.map((s) => {
    const sectionGroups = groupsForSection(template.groups, s.id);
    const issues = sectionCompletenessIssues(sectionGroups, template.options);
    const lines = linesForSection(template.lines, s.id);
    return {
      sectionId: s.id,
      name: s.name,
      guidance: s.guidance,
      fixedLines: lines.map((l) => ({
        id: l.id,
        description: l.description,
        included: l.includedByDefault,
        price: l.unitPrice,
        catalog: Boolean(l.offeringId),
      })),
      groups: sectionGroups.map((g) => {
        const opts = template.options
          .filter((o) => o.groupId === g.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const dependsOnLabels = (g.dependsOnOptionIds ?? [])
          .map((id) => optionById.get(id)?.label ?? id)
          .filter(Boolean);
        return {
          id: g.id,
          name: g.name,
          selectionMode: g.selectionMode,
          required: g.minSelect > 0,
          isDependent: isDependentGroup(g),
          dependsOnLabels,
          incomplete: opts.length === 0,
          options: opts.map((o) => ({
            id: o.id,
            label: o.label,
            unitPrice: o.unitPrice,
            isIncluded: o.isIncluded,
            catalog: Boolean(o.offeringId),
          })),
        };
      }),
      incompleteMessages: issues.map((i) => i.message),
    };
  });
}

export function sectionNeedsChoiceConfiguration(
  patterns: ConfigPatternId[],
): boolean {
  return patterns.some((p) =>
    p === "choose_one" || p === "choose_many" || p === "choose_then_related" || p === "optional_add",
  );
}

export function sectionNeedsBranchConfiguration(
  patterns: ConfigPatternId[],
): boolean {
  return patterns.includes("choose_then_related");
}

export function sectionNeedsFixedConfiguration(patterns: ConfigPatternId[]): boolean {
  return patterns.includes("included");
}

/** Default group create payload for a pattern (no invented options). */
export function defaultGroupInputForPattern(
  pattern: ConfigPatternId,
  sectionId: string,
  sectionName: string,
): {
  sectionId: string;
  name: string;
  instructions: string;
  selectionMode: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
} | null {
  if (pattern === "included") return null;
  if (pattern === "choose_one" || pattern === "choose_then_related") {
    return {
      sectionId,
      name: `${sectionName} choices`,
      instructions: "Choose one option.",
      selectionMode: "single",
      minSelect: 1,
      maxSelect: 1,
      allowQuantity: false,
    };
  }
  if (pattern === "choose_many") {
    return {
      sectionId,
      name: `${sectionName} selections`,
      instructions: "Choose any that apply.",
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: null,
      allowQuantity: true,
    };
  }
  if (pattern === "optional_add") {
    return {
      sectionId,
      name: `Optional ${sectionName.toLowerCase()}`,
      instructions: "Add any optional items.",
      selectionMode: "multi",
      minSelect: 0,
      maxSelect: null,
      allowQuantity: true,
    };
  }
  return null;
}

export function emptyDependentGroupInput(
  sectionId: string,
  parentOption: EventOrderTemplateOption,
): {
  sectionId: string;
  name: string;
  instructions: string;
  selectionMode: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
  dependsOnOptionIds: string[];
} {
  return {
    sectionId,
    name: `${parentOption.label} details`,
    instructions: `Shown only after the client chooses “${parentOption.label}”.`,
    selectionMode: "single",
    minSelect: 0,
    maxSelect: null,
    allowQuantity: false,
    dependsOnOptionIds: [parentOption.id],
  };
}

export type WizardProgress = {
  phase: WizardPhase;
  categoryIndex: number;
  substep: CategoryConfigureSubstep;
  sectionIdsInOrder: string[];
};

export function nextConfigureSubstep(
  current: CategoryConfigureSubstep,
  patterns: ConfigPatternId[],
): CategoryConfigureSubstep | "done" {
  const order: CategoryConfigureSubstep[] = ["patterns"];
  if (sectionNeedsFixedConfiguration(patterns)) order.push("fixed");
  if (sectionNeedsChoiceConfiguration(patterns)) order.push("choices");
  if (sectionNeedsBranchConfiguration(patterns)) order.push("branches");
  const idx = order.indexOf(current);
  if (idx < 0) return order[0] ?? "done";
  if (idx >= order.length - 1) return "done";
  return order[idx + 1]!;
}

export function prevConfigureSubstep(
  current: CategoryConfigureSubstep,
  patterns: ConfigPatternId[],
): CategoryConfigureSubstep | "categories" {
  const order: CategoryConfigureSubstep[] = ["patterns"];
  if (sectionNeedsFixedConfiguration(patterns)) order.push("fixed");
  if (sectionNeedsChoiceConfiguration(patterns)) order.push("choices");
  if (sectionNeedsBranchConfiguration(patterns)) order.push("branches");
  const idx = order.indexOf(current);
  if (idx <= 0) return "categories";
  return order[idx - 1]!;
}
