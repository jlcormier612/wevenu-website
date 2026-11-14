/**
 * Venue vs client commercial presentation for Event Order offerings.
 * Schema: isIncluded + nullable unitPrice. Null price and not included
 * is Not configured — never a silent Additional, Included, or $0.
 */

export type CommercialState = "not_configured" | "included" | "additional";

export type CommercialOption = {
  isIncluded: boolean;
  unitPrice: number | null;
  description?: string | null;
  pricingModel?: string | null;
};

export function commercialState(opt: Pick<CommercialOption, "isIncluded" | "unitPrice">): CommercialState {
  if (opt.isIncluded) return "included";
  if (opt.unitPrice != null) return "additional";
  return "not_configured";
}

export function formatMoneyAmount(value: number): string {
  const rounded = Number(value.toFixed(2));
  if (Number.isInteger(rounded)) return `$${rounded}`;
  return `$${rounded.toFixed(2)}`;
}

function unitSuffix(
  opt: Pick<CommercialOption, "description" | "pricingModel">,
  allowQuantity: boolean,
): string {
  if (allowQuantity) return " each";
  const model = (opt.pricingModel ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (model === "per_person" || model === "per_guest") return " per person";
  const d = (opt.description ?? "").trim().toLowerCase();
  if (/\bper\s*person\b/.test(d) || /\bper\s*guest\b/.test(d)) return " per person";
  if (/\bper\s*table\b/.test(d)) return " per table";
  if (/\bper\s*unit\b/.test(d)) return " per unit";
  return "";
}

/** Venue editor / package builder. */
export function venueCommercialLabel(
  opt: CommercialOption,
  allowQuantity = false,
): string {
  const state = commercialState(opt);
  if (state === "included") return "Included";
  if (state === "not_configured") return "Not configured";
  return `Additional · ${formatMoneyAmount(opt.unitPrice!)}${unitSuffix(opt, allowQuantity)}`;
}

/**
 * Couple-facing label. Unconfigured items must never read as Additional,
 * Included, free, or $0. Released portal should not reach this state.
 */
export function clientCommercialLabel(
  opt: CommercialOption,
  allowQuantity = false,
  surface: "preview" | "client" = "client",
): string {
  const state = commercialState(opt);
  if (state === "included") return "Included";
  if (state === "not_configured") {
    return surface === "preview" ? "Not configured" : "Not available for release";
  }
  return `+${formatMoneyAmount(opt.unitPrice!)}${unitSuffix(opt, allowQuantity)}`;
}

export function unresolvedCommercialOptions<T extends { isIncluded: boolean; unitPrice: number | null; label?: string }>(
  options: readonly T[],
): T[] {
  return options.filter((o) => commercialState(o) === "not_configured");
}

export function unresolvedCommercialSendMessage(optionCount: number): string | null {
  if (optionCount <= 0) return null;
  return "This Event Order still has offerings that are not configured. Set a price or mark them Included before sharing with clients.";
}

export const COMPLETENESS_INTRO =
  "This template needs a few decisions before it can be shared.";

export type CompletenessGuidanceSection = {
  sectionName: string;
  sectionId: string | null;
  lines: { text: string; groupId: string }[];
};

type GuidanceGroup = {
  id: string;
  name: string;
  sectionId: string | null;
  dependsOnOptionIds?: string[] | null;
  sortOrder: number;
};

type GuidanceOption = {
  id: string;
  groupId: string;
  label: string;
  isIncluded: boolean;
  unitPrice: number | null;
};

type GuidanceSection = {
  id: string;
  name: string;
  sortOrder: number;
};

/**
 * Compact, hierarchy-aware completeness copy. Repeating category names
 * include the parent branch. Root offerings are listed by name.
 */
export function groupedCompletenessGuidance(
  sections: readonly GuidanceSection[],
  groups: readonly GuidanceGroup[],
  options: readonly GuidanceOption[],
): CompletenessGuidanceSection[] {
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const optionById = new Map(options.map((o) => [o.id, o]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  const buckets = new Map<string, { labels: string[]; groupId: string; lineSort: number }>();
  const resultMeta = new Map<string, { sectionId: string | null; sectionName: string; sortOrder: number }>();

  function sectionInfo(sectionId: string | null): { sectionId: string | null; sectionName: string; sortOrder: number } {
    if (!sectionId) return { sectionId: null, sectionName: "Other", sortOrder: 999 };
    const section = sectionById.get(sectionId);
    return {
      sectionId,
      sectionName: section?.name ?? "Other",
      sortOrder: section?.sortOrder ?? 999,
    };
  }

  function addLine(
    key: string,
    meta: { sectionId: string | null; sectionName: string; sortOrder: number },
    label: string,
    groupId: string,
    lineSort: number,
  ) {
    const existing = buckets.get(key);
    if (existing) {
      if (!existing.labels.includes(label)) existing.labels.push(label);
      return;
    }
    buckets.set(key, { labels: [label], groupId, lineSort });
    resultMeta.set(key, meta);
  }

  for (const group of groups) {
    const groupOptions = options.filter((o) => o.groupId === group.id);
    const unresolved = groupOptions.filter((o) => commercialState(o) === "not_configured");
    const empty = groupOptions.length === 0;
    if (!empty && unresolved.length === 0) continue;

    const parentIds = group.dependsOnOptionIds ?? [];
    const parentLabels = parentIds
      .map((id) => optionById.get(id)?.label?.trim())
      .filter((label): label is string => Boolean(label));
    const parentLabel = parentLabels.length === 1 ? parentLabels[0]! : null;
    const meta = sectionInfo(group.sectionId);
    const parentGroup = parentLabel
      ? groupById.get(optionById.get(parentIds[0] ?? "")?.groupId ?? "")
      : null;

    if (parentLabel) {
      const key = `${meta.sectionId ?? "none"}::parent::${parentLabel}`;
      addLine(key, meta, group.name, group.id, (parentGroup?.sortOrder ?? 0) * 100 + group.sortOrder);
      continue;
    }

    if (empty) {
      const key = `${meta.sectionId ?? "none"}::root::${group.id}`;
      addLine(key, meta, group.name, group.id, group.sortOrder);
      continue;
    }

    const key = `${meta.sectionId ?? "none"}::root::${group.id}`;
    if (unresolved.length === 1) {
      addLine(key, meta, unresolved[0]!.label, group.id, group.sortOrder);
    } else {
      addLine(
        key,
        meta,
        `${group.name}: ${unresolved.map((o) => o.label).join(", ")}`,
        group.id,
        group.sortOrder,
      );
    }
  }

  const bySection = new Map<string, CompletenessGuidanceSection>();
  const orderedKeys = [...buckets.entries()].sort((a, b) => {
    const metaA = resultMeta.get(a[0])!;
    const metaB = resultMeta.get(b[0])!;
    if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
    return a[1].lineSort - b[1].lineSort;
  });

  for (const [key, bucket] of orderedKeys) {
    const meta = resultMeta.get(key)!;
    const sectionKey = meta.sectionId ?? `other:${meta.sectionName}`;
    let section = bySection.get(sectionKey);
    if (!section) {
      section = { sectionName: meta.sectionName, sectionId: meta.sectionId, lines: [] };
      bySection.set(sectionKey, section);
    }
    const isParent = key.includes("::parent::");
    const parentName = isParent ? key.slice(key.indexOf("::parent::") + "::parent::".length) : null;
    const text = parentName
      ? `${parentName}: ${bucket.labels.join(", ")}.`
      : `${bucket.labels.join(", ")}.`;
    section.lines.push({ text, groupId: bucket.groupId });
  }

  return [...bySection.values()];
}
