/**
 * Structured offerings on Event Order Templates.
 * Template lines are snapshots. Library Offerings remain the catalog.
 */

import { mutationBlockedWhenFinalized } from "@/lib/event-orders/lifecycle-gates";
import { formatMoney } from "@/lib/event-orders/constants";
import type { EventOrderStatus } from "@/lib/event-orders/types";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";

export const TEMPLATE_PRICING_MODELS = ["none", "flat", "per_person", "per_unit", "custom"] as const;

export type TemplatePricingModel = (typeof TEMPLATE_PRICING_MODELS)[number];

export const TEMPLATE_PRICING_MODEL_LABELS: Record<TemplatePricingModel, string> = {
  none: "No price",
  flat: "Flat",
  per_person: "Per person",
  per_unit: "Per unit",
  custom: "Custom / TBD",
};

export function isTemplatePricingModel(value: string | null | undefined): value is TemplatePricingModel {
  return TEMPLATE_PRICING_MODELS.includes(value as TemplatePricingModel);
}

export function normalizeTemplatePricingModel(
  value: string | null | undefined,
): TemplatePricingModel {
  return isTemplatePricingModel(value) ? value : "none";
}

export type TemplateOfferingDraft = {
  name: string;
  description: string;
  hasPrice: boolean;
  unitPrice: string;
  pricingModel: TemplatePricingModel;
  unit: string;
  defaultQuantity: string;
  includedByDefault: boolean;
  offeringId: string | null;
  sectionId: string | null;
};

export type TemplateApplySelection = {
  lineId: string;
  selected: boolean;
  quantity: number;
};

export function offeringDisplayName(line: Pick<EventOrderTemplateLine, "description">): string {
  return line.description.trim();
}

export function formatTemplateOfferingPrice(line: Pick<
  EventOrderTemplateLine,
  "unitPrice" | "pricingModel" | "unit"
>): string {
  const model = normalizeTemplatePricingModel(line.pricingModel);
  if (model === "none" || (line.unitPrice == null && model !== "custom")) {
    return "No price configured";
  }
  if (model === "custom") {
    return line.unitPrice != null
      ? `${formatMoney(line.unitPrice)} · Custom / TBD`
      : "Custom / TBD";
  }
  if (line.unitPrice == null) return "No price configured";
  const money = formatMoney(line.unitPrice);
  if (model === "per_person") return `${money} · Per person`;
  if (model === "per_unit") {
    const unit = line.unit?.trim();
    return unit ? `${money} / ${unit}` : `${money} · Per unit`;
  }
  return `${money} · Flat`;
}

export function defaultApplySelections(lines: EventOrderTemplateLine[]): TemplateApplySelection[] {
  const allUnpriced = lines.every(
    (l) => normalizeTemplatePricingModel(l.pricingModel) === "none" || l.unitPrice == null,
  );
  return lines.map((l) => ({
    lineId: l.id,
    selected: allUnpriced || l.includedByDefault,
    quantity: l.quantity > 0 ? l.quantity : 1,
  }));
}

/** Applying a template never mutates a finalized Event Order. */
export function canApplyTemplateToEventOrder(status: EventOrderStatus | null): boolean {
  if (!status) return true;
  return mutationBlockedWhenFinalized(status) === null;
}

/**
 * Event line prices are snapshots. A later template price must not replace them.
 */
export function eventPriceAfterTemplateCatalogChange(
  eventUnitPrice: number | null,
  _nextTemplateUnitPrice: number | null,
): number | null {
  return eventUnitPrice;
}

export function templateAppliedLineProvenance(
  offeringId: string | null | undefined,
): "offering" | "custom" {
  return offeringId ? "offering" : "custom";
}

export function parseOptionalTemplatePrice(raw: string, hasPrice: boolean): number | null {
  if (!hasPrice) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (isNaN(n) || n < 0) return null;
  return n;
}

export function parseDefaultQuantity(raw: string): number {
  const n = Number(raw);
  return n > 0 ? n : 1;
}

export function validateSectionName(name: string): string | null {
  return name.trim() ? null : "Give this section a name.";
}

export type TemplateOfferingWriteInput = {
  description: string;
  descriptionDetail?: string;
  quantity: string;
  unitPrice: string;
  hasPrice?: boolean;
  pricingModel?: string;
  unit?: string;
  includedByDefault?: boolean;
  offeringId?: string | null;
  sectionId: string | null;
};

export type ParsedTemplateOfferingWrite = {
  sectionId: string | null;
  description: string;
  descriptionDetail: string | null;
  quantity: number;
  unitPrice: number | null;
  pricingModel: TemplatePricingModel;
  unit: string | null;
  includedByDefault: boolean;
  offeringId: string | null;
};

export function parseTemplateOfferingWrite(
  input: TemplateOfferingWriteInput,
): { ok: true; write: ParsedTemplateOfferingWrite } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input.description.trim()) errors.description = "Give this offering a name.";
  const hasPrice = Boolean(input.hasPrice);
  const pricingModel = hasPrice
    ? normalizeTemplatePricingModel(input.pricingModel === "none" ? "flat" : input.pricingModel)
    : "none";
  let unitPrice: number | null = null;
  if (pricingModel === "custom") {
    unitPrice = parseOptionalTemplatePrice(input.unitPrice ?? "", (input.unitPrice ?? "").trim() !== "");
  } else if (pricingModel !== "none") {
    if (!(input.unitPrice ?? "").trim()) {
      errors.unitPrice = "Enter a price, or uncheck “This offering has a price.”";
    } else {
      unitPrice = parseOptionalTemplatePrice(input.unitPrice, true);
      if (unitPrice == null) errors.unitPrice = "Enter a valid price, or turn pricing off.";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    write: {
      sectionId: input.sectionId,
      description: input.description,
      descriptionDetail: input.descriptionDetail?.trim() || null,
      quantity: parseDefaultQuantity(input.quantity || "1"),
      unitPrice,
      pricingModel,
      unit: input.unit?.trim() || null,
      includedByDefault: Boolean(input.includedByDefault),
      offeringId: input.offeringId ?? null,
    },
  };
}

export type TemplateOfferingEventSnapshot = {
  description: string;
  descriptionDetail: string | null;
  quantity: string;
  unitPrice: string;
  unit: string | null;
  isIncluded: boolean;
  notes: string | null;
  offeringId: string | null;
  provenance: "offering" | "custom";
};

export function snapshotPricingModelNotes(
  line: Pick<EventOrderTemplateLine, "pricingModel" | "unit">,
): string | null {
  const model = normalizeTemplatePricingModel(line.pricingModel);
  if (model === "none") return null;
  if (model === "custom") return "Custom / TBD";
  if (model === "per_person") return "Per person";
  if (model === "flat") return "Flat";
  const unit = line.unit?.trim();
  return unit ? `Per ${unit}` : "Per unit";
}

export function snapshotTemplateOfferingForEvent(
  line: EventOrderTemplateLine,
  quantity?: number,
): TemplateOfferingEventSnapshot {
  const qty = quantity && quantity > 0 ? quantity : (line.quantity > 0 ? line.quantity : 1);
  const unpriced = normalizeTemplatePricingModel(line.pricingModel) === "none" || line.unitPrice == null;
  return {
    description: line.description,
    descriptionDetail: line.descriptionDetail,
    quantity: String(qty),
    unitPrice: line.unitPrice == null ? "" : String(line.unitPrice),
    unit: line.unit,
    isIncluded: line.includedByDefault || (unpriced && normalizeTemplatePricingModel(line.pricingModel) === "none"),
    notes: snapshotPricingModelNotes(line),
    offeringId: line.offeringId,
    provenance: templateAppliedLineProvenance(line.offeringId),
  };
}

export function selectedTemplateLines(
  lines: EventOrderTemplateLine[],
  selections?: TemplateApplySelection[],
): EventOrderTemplateLine[] {
  const resolved = selections ?? defaultApplySelections(lines);
  const chosen = new Map(resolved.map((s) => [s.lineId, s]));
  return lines.filter((line) => chosen.get(line.id)?.selected);
}

export function applyQuantityForLine(
  line: EventOrderTemplateLine,
  selections?: TemplateApplySelection[],
): number {
  const found = (selections ?? defaultApplySelections([line])).find((s) => s.lineId === line.id);
  const qty = found?.quantity ?? line.quantity;
  return qty > 0 ? qty : 1;
}

export function inferPricingModelFromUnit(unit: string | null | undefined): TemplatePricingModel {
  const u = (unit ?? "").trim().toLowerCase();
  if (!u) return "flat";
  if (/\b(person|guest|head)\b/.test(u) || u === "pp") return "per_person";
  return "per_unit";
}

export function linesForSection(
  lines: EventOrderTemplateLine[],
  sectionId: string,
): EventOrderTemplateLine[] {
  return lines
    .filter((l) => l.sectionId === sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function unsectionedLines(lines: EventOrderTemplateLine[]): EventOrderTemplateLine[] {
  return lines
    .filter((l) => !l.sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function moveOrderedIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  const next = [...ids];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= next.length ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const [item] = next.splice(fromIndex, 1);
  if (!item) return next;
  next.splice(toIndex, 0, item);
  return next;
}
