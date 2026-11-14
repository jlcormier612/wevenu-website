/**
 * Section-first Event Order Template builder helpers.
 * Soft-match section names to Offering categories for discovery UX only —
 * never invent Offering links by name.
 */
import { isDependentGroup } from "@/lib/event-order-templates/group-dependencies";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
  EventOrderTemplateSection,
} from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

export type OfferingCategoryFilter = "preferred" | "all" | string;

/** Normalize for soft section↔category comparison (discovery only). */
export function normalizeCommercialLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether an Offering category label is a reasonable default filter for a
 * template section. Soft match only — not used for catalog linking.
 */
export function categoryMatchesSection(
  categoryName: string | null | undefined,
  sectionName: string,
): boolean {
  if (!categoryName?.trim() || !sectionName.trim()) return false;
  const cat = normalizeCommercialLabel(categoryName);
  const sec = normalizeCommercialLabel(sectionName);
  if (cat === sec) return true;
  if (cat.includes(sec) || sec.includes(cat)) return true;
  // Common venue aliases: "Bar Service" ↔ "Bar", "Food & Beverage" ↔ "Catering"
  const aliases: Record<string, string[]> = {
    catering: ["food", "food and beverage", "f and b", "dining"],
    bar: ["bar service", "beverages", "bar and beverages"],
    rentals: ["rental", "furniture", "equipment"],
    services: ["service", "coordination", "staffing"],
  };
  for (const [canonical, alts] of Object.entries(aliases)) {
    const bucket = [canonical, ...alts];
    const catHit = bucket.some((b) => cat === b || cat.includes(b));
    const secHit = bucket.some((b) => sec === b || sec.includes(b));
    if (catHit && secHit) return true;
  }
  return false;
}

export function groupsForSection(
  groups: EventOrderTemplateGroup[],
  sectionId: string | null,
): EventOrderTemplateGroup[] {
  return [...groups]
    .filter((g) => (sectionId == null ? g.sectionId == null : g.sectionId === sectionId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function rootGroupsInList(groups: EventOrderTemplateGroup[]): EventOrderTemplateGroup[] {
  return groups.filter((g) => !isDependentGroup(g));
}

/** Dependent groups that activate when this parent option is selected. */
export function dependentGroupsForOption(
  groups: EventOrderTemplateGroup[],
  optionId: string,
): EventOrderTemplateGroup[] {
  return groups
    .filter((g) => (g.dependsOnOptionIds ?? []).includes(optionId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export type SectionCompletenessIssue = {
  groupId: string;
  groupName: string;
  kind: "empty-dependent" | "empty-root" | "unpriced-option";
  message: string;
};

function parentOptionLabelsForGroup(
  group: EventOrderTemplateGroup,
  options: EventOrderTemplateOption[],
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const id of group.dependsOnOptionIds ?? []) {
    const label = options.find((o) => o.id === id)?.label?.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

export function sectionCompletenessIssues(
  groups: EventOrderTemplateGroup[],
  options: EventOrderTemplateOption[],
): SectionCompletenessIssue[] {
  const issues: SectionCompletenessIssue[] = [];
  const unpriced: SectionCompletenessIssue[] = [];
  for (const g of groups) {
    const groupOptions = options.filter((o) => o.groupId === g.id);
    const count = groupOptions.length;
    if (count > 0) {
      const unresolved = groupOptions.some((o) => !o.isIncluded && o.unitPrice == null);
      if (unresolved) {
        const parents = parentOptionLabelsForGroup(g, options);
        const label = parents.length === 1 ? `${parents[0]} · ${g.name}` : g.name;
        unpriced.push({
          groupId: g.id,
          groupName: g.name,
          kind: "unpriced-option",
          message: `${label} still needs a price or an Included decision.`,
        });
      }
      continue;
    }
    if (isDependentGroup(g)) {
      const parents = parentOptionLabelsForGroup(g, options);
      const parent = parents.length === 1
        ? parents[0]
        : parents.length > 1
          ? parents.join(" or ")
          : null;
      issues.push({
        groupId: g.id,
        groupName: g.name,
        kind: "empty-dependent",
        message: parent
          ? `${parent} needs at least one choice in ${g.name}.`
          : `“${g.name}” has no follow-up options yet — clients will see an empty branch when its parent is selected.`,
      });
    } else {
      issues.push({
        groupId: g.id,
        groupName: g.name,
        kind: "empty-root",
        message: `“${g.name}” has no options yet.`,
      });
    }
  }
  return [...issues, ...unpriced];
}

export function preferredCategoryIdsForSection(
  sectionName: string,
  categories: { id: string; name: string }[],
): string[] {
  return categories
    .filter((c) => categoryMatchesSection(c.name, sectionName))
    .map((c) => c.id);
}

/**
 * Filter catalog offerings for a section-aware picker.
 * - preferred: soft-match category to section only (never silently dump all categories)
 * - all: every active offering (explicit escape hatch)
 * - category id: that category only
 */
export function filterOfferingsForSectionPicker(
  offerings: OfferingWithCategory[],
  sectionName: string | null,
  filter: OfferingCategoryFilter,
): { items: OfferingWithCategory[]; usedFallbackAll: boolean; preferredEmpty: boolean } {
  const active = offerings.filter((o) => !o.isArchived);
  if (filter === "all") {
    return { items: active, usedFallbackAll: false, preferredEmpty: false };
  }
  if (!sectionName) {
    return { items: active, usedFallbackAll: false, preferredEmpty: false };
  }
  if (filter !== "preferred") {
    return {
      items: active.filter((o) => o.categoryId === filter),
      usedFallbackAll: false,
      preferredEmpty: false,
    };
  }
  const preferred = active.filter((o) => categoryMatchesSection(o.categoryName, sectionName));
  return {
    items: preferred,
    usedFallbackAll: false,
    preferredEmpty: preferred.length === 0,
  };
}

export function uniqueOfferingCategories(
  offerings: OfferingWithCategory[],
): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const o of offerings) {
    if (!o.categoryId || !o.categoryName) continue;
    if (!map.has(o.categoryId)) map.set(o.categoryId, o.categoryName);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function sectionNavItems(
  sections: EventOrderTemplateSection[],
  groups: EventOrderTemplateGroup[],
  options: EventOrderTemplateOption[],
): {
  id: string;
  name: string;
  incompleteCount: number;
}[] {
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const sectionGroups = groupsForSection(groups, s.id);
      return {
        id: s.id,
        name: s.name,
        incompleteCount: sectionCompletenessIssues(sectionGroups, options).length,
      };
    });
}
