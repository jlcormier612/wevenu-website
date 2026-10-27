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

/**
 * Plain-language configuration patterns (maps onto lines + choice groups).
 * Legacy `choose_then_related` remains in the union for draft normalization only —
 * it is no longer a top-level selectable pattern (follow-ups are contextual on options).
 */
export type ConfigPatternId =
  | "included"
  | "choose_one"
  | "choose_many"
  | "choose_then_related"
  | "optional_add";

export type ConfigPattern = {
  id: Exclude<ConfigPatternId, "choose_then_related">;
  title: string;
  clientExperience: string;
};

export const CONFIG_PATTERNS: readonly ConfigPattern[] = [
  {
    id: "included",
    title: "Included automatically",
    clientExperience:
      "Clients receive these items or services as part of their package. They don't need to select them.",
  },
  {
    id: "choose_one",
    title: "Choose one option",
    clientExperience:
      "Clients choose one option, such as a plated dinner or buffet. Each option can have its own follow-up choices.",
  },
  {
    id: "choose_many",
    title: "Choose multiple options",
    clientExperience:
      "Clients can select several items or services, such as multiple appetizers or additional rental items.",
  },
  {
    id: "optional_add",
    title: "Optional extras",
    clientExperience:
      "Clients can add extras if they want them. Show any additional price before they choose.",
  },
] as const;

/** Map retired top-level follow-up pattern onto choose_one (contextual follow-ups). */
export function normalizePatternIds(patterns: ConfigPatternId[]): ConfigPatternId[] {
  const next = new Set<ConfigPatternId>();
  for (const p of patterns) {
    if (p === "choose_then_related") {
      next.add("choose_one");
      continue;
    }
    next.add(p);
  }
  return [...next];
}

export type WizardPhase = "categories" | "configure" | "review" | "preview";

/**
 * Ordinary configure path is a single contextual workspace (included items +
 * primary choices + under-option follow-ups). Legacy pattern/fixed/choices/branches
 * ladder is retired from the venue-facing flow.
 */
export type CategoryConfigureSubstep = "workspace";

/** @deprecated Kept for draft-normalization helpers only — not an ordinary UI step. */
export type LegacyCategoryConfigureSubstep =
  | "patterns"
  | "fixed"
  | "choices"
  | "branches"
  | "workspace";

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
    // Follow-ups are contextual on primary options — seed choose_one, not a separate pattern.
    if (hasDependent) found.add("choose_one");

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
  return normalizePatternIds([...found]);
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
    } else {
      const normalized = normalizePatternIds(next[id]!);
      const prevSorted = [...next[id]!].sort().join("|");
      const nextSorted = [...normalized].sort().join("|");
      if (prevSorted !== nextSorted) {
        next[id] = normalized;
        changed = true;
      }
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
  if (patternId === "choose_then_related") {
    // Retired top-level card — treat as choose_one.
    return togglePatternInDraft(drafts, sectionId, "choose_one");
  }
  const cur = normalizePatternIds(drafts[sectionId] ?? []);
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
    patterns: normalizePatternIds([...(drafts[sectionId] ?? [])]),
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

export type ReviewOptionSummary = {
  id: string;
  label: string;
  unitPrice: number | null;
  isIncluded: boolean;
  catalog: boolean;
  /** Dependent groups shown only after this option is selected. */
  followUps: ReviewGroupSummary[];
};

export type ReviewGroupSummary = {
  id: string;
  name: string;
  selectionMode: string;
  required: boolean;
  isDependent: boolean;
  dependsOnLabels: string[];
  incomplete: boolean;
  options: ReviewOptionSummary[];
};

export type ReviewCategorySummary = {
  sectionId: string;
  name: string;
  guidance: string | null;
  fixedLines: { id: string; description: string; included: boolean; price: number | null; catalog: boolean }[];
  /** Root (primary) groups in client encounter order; follow-ups nest under options. */
  groups: ReviewGroupSummary[];
  incompleteMessages: string[];
  /** Sample path hint for interactive preview (commercial categories only). */
  previewPathHint: string | null;
};

function summarizeGroup(
  g: EventOrderTemplateGroup,
  template: EventOrderTemplateWithDetails,
  optionById: Map<string, EventOrderTemplateOption>,
  sectionGroups: EventOrderTemplateGroup[],
  nestFollowUps: boolean,
): ReviewGroupSummary {
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
      followUps: nestFollowUps
        ? dependentGroupsForOption(sectionGroups, o.id).map((d) =>
            summarizeGroup(d, template, optionById, sectionGroups, true),
          )
        : [],
    })),
  };
}

export function buildReviewSummary(template: EventOrderTemplateWithDetails): ReviewCategorySummary[] {
  const optionById = new Map(template.options.map((o) => [o.id, o]));
  const sections = [...template.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  return sections.map((s) => {
    const sectionGroups = groupsForSection(template.groups, s.id);
    const roots = rootGroupsInList(sectionGroups);
    const issues = sectionCompletenessIssues(sectionGroups, template.options);
    const lines = linesForSection(template.lines, s.id);
    const groups = roots.map((g) =>
      summarizeGroup(g, template, optionById, sectionGroups, true),
    );
    // Orphan dependents (parent outside section view) still surface in review.
    const nestedIds = new Set<string>();
    const walk = (gs: ReviewGroupSummary[]) => {
      for (const g of gs) {
        nestedIds.add(g.id);
        for (const o of g.options) walk(o.followUps);
      }
    };
    walk(groups);
    for (const g of sectionGroups) {
      if (isDependentGroup(g) && !nestedIds.has(g.id)) {
        groups.push(summarizeGroup(g, template, optionById, sectionGroups, true));
      }
    }
    const firstRoot = groups[0];
    const firstOpt = firstRoot?.options[0];
    const firstFollow = firstOpt?.followUps[0];
    const previewPathHint =
      firstRoot && firstOpt
        ? firstFollow
          ? `Try ${s.name} → ${firstOpt.label} → ${firstFollow.name}.`
          : `Try ${s.name} → ${firstOpt.label}.`
        : lines.length > 0
          ? `Review included items under ${s.name}.`
          : null;
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
      groups,
      incompleteMessages: issues.map((i) => i.message),
      previewPathHint,
    };
  });
}

export function sectionNeedsChoiceConfiguration(
  patterns: ConfigPatternId[],
): boolean {
  const p = normalizePatternIds(patterns);
  return p.some(
    (id) => id === "choose_one" || id === "choose_many" || id === "optional_add",
  );
}

/** Follow-up configuration after primary options (contextual on each choose-one option). */
export function sectionNeedsBranchConfiguration(
  patterns: ConfigPatternId[],
): boolean {
  return normalizePatternIds(patterns).includes("choose_one");
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
    // choose_then_related is legacy-only; same root group shape as choose_one.
    // Use the service category name — not a generic “Catering choices” label.
    // Option labels should be the venue’s major catalog offerings.
    return {
      sectionId,
      name: sectionName.trim() || "Service options",
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
      name: sectionName.trim() || "Selections",
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
      name: sectionName.trim() ? `Optional ${sectionName.trim()}` : "Optional extras",
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

/**
 * Plain-language selection rule → existing group fields.
 * Exact N (required): minSelect = maxSelect = N.
 * Choose one (required): single / 1 / 1.
 * Optional with a cap: multi / 0 / N.
 * Optional any number: multi / 0 / null.
 */
export type PlainSelectionRuleInput = {
  /** How many the couple should select. Null = any number (optional path). */
  selectCount: number | null;
  required: boolean;
};

export function resolvePlainSelectionRule(input: PlainSelectionRuleInput): {
  selectionMode: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
} {
  const count =
    input.selectCount != null && Number.isFinite(input.selectCount) && input.selectCount > 0
      ? Math.floor(input.selectCount)
      : null;
  if (count === 1) {
    return {
      selectionMode: "single",
      minSelect: input.required ? 1 : 0,
      maxSelect: 1,
    };
  }
  if (count != null && count > 1) {
    return {
      selectionMode: "multi",
      minSelect: input.required ? count : 0,
      maxSelect: count,
    };
  }
  // Any number
  return {
    selectionMode: "multi",
    minSelect: input.required ? 1 : 0,
    maxSelect: null,
  };
}

/** Venue-owner-facing summary of an existing group's selection rule. */
export function plainSelectionRuleLabel(
  g: Pick<EventOrderTemplateGroup, "selectionMode" | "minSelect" | "maxSelect">,
): string {
  if (g.selectionMode === "single") {
    if (g.minSelect > 0) return "Choose 1";
    return "Optional — choose up to 1";
  }
  if (g.minSelect > 0 && g.maxSelect != null && g.minSelect === g.maxSelect) {
    return `Choose ${g.minSelect}`;
  }
  if (g.minSelect > 0 && g.maxSelect != null) {
    return `Choose ${g.minSelect}–${g.maxSelect}`;
  }
  if (g.minSelect > 0 && g.maxSelect == null) {
    return `Choose at least ${g.minSelect}`;
  }
  if (g.minSelect === 0 && g.maxSelect != null) {
    return `Optional — choose up to ${g.maxSelect}`;
  }
  return "Optional — choose any";
}

/** Build a follow-up category under a primary option (reuses depends_on_option_ids). */
export function dependentCategoryGroupInput(
  sectionId: string,
  parentOption: EventOrderTemplateOption,
  categoryName: string,
  rule: PlainSelectionRuleInput,
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
  const resolved = resolvePlainSelectionRule(rule);
  const name = categoryName.trim() || `${parentOption.label} menu`;
  return {
    sectionId,
    name,
    instructions: `Shown only after the client chooses “${parentOption.label}”.`,
    selectionMode: resolved.selectionMode,
    minSelect: resolved.minSelect,
    maxSelect: resolved.maxSelect,
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

/** Ordinary path: one workspace per category (no preliminary pattern quiz). */
function configureSubstepOrder(_patterns?: ConfigPatternId[]): CategoryConfigureSubstep[] {
  return ["workspace"];
}

export function nextConfigureSubstep(
  _current: CategoryConfigureSubstep,
  _patterns?: ConfigPatternId[],
): CategoryConfigureSubstep | "done" {
  return "done";
}

export function prevConfigureSubstep(
  _current: CategoryConfigureSubstep,
  _patterns?: ConfigPatternId[],
): CategoryConfigureSubstep | "categories" {
  return "categories";
}
