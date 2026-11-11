/**
 * Choices / EO Template options — Offering is optional catalog identity.
 * Template option label + price are snapshots; never auto-link by name.
 */
import { effectiveOfferingImageUrl } from "@/lib/catalog-images/types";
import type { Offering, OfferingWithCategory } from "@/lib/offerings/types";
import type {
  AddTemplateOptionInput,
  EventOrderTemplateOption,
} from "@/lib/event-order-templates/types";

export type ChoicesOptionDraft = {
  offeringId: string | null;
  label: string;
  isIncluded: boolean;
  unitPrice: number | null;
  /** Snapshotted effective photo (own Offering image, else Inventory fallback). */
  imageUrl: string | null;
};

/** Initial draft when *creating* an option from a catalog pick (snapshot once). */
export function choicesOptionDraftFromOffering(
  offering: Offering | OfferingWithCategory,
): ChoicesOptionDraft {
  const hasPrice = offering.defaultUnitPrice != null;
  const inventoryImageUrl =
    "inventoryImageUrl" in offering ? offering.inventoryImageUrl ?? null : null;
  return {
    offeringId: offering.id,
    label: offering.name.trim(),
    isIncluded: !hasPrice,
    unitPrice: hasPrice ? offering.defaultUnitPrice : null,
    imageUrl: effectiveOfferingImageUrl({
      imageUrl: offering.imageUrl,
      inventoryImageUrl,
    }),
  };
}

export function customChoicesOptionDraft(label: string): ChoicesOptionDraft {
  return {
    offeringId: null,
    label: label.trim(),
    isIncluded: true,
    unitPrice: null,
    imageUrl: null,
  };
}

/** Editing the customer-facing label must not clear offering provenance. */
export function withChoicesOptionLabel(
  draft: ChoicesOptionDraft,
  label: string,
): ChoicesOptionDraft {
  return { ...draft, label: label.trim(), imageUrl: draft.imageUrl ?? null };
}

export function isCatalogBackedChoicesOption(
  option: Pick<{ offeringId: string | null }, "offeringId">,
): boolean {
  return Boolean(option.offeringId);
}

export type OptionCatalogLinkKind =
  | "template-only"
  | "catalog"
  | "catalog-archived"
  | "catalog-missing";

export type OptionCatalogLinkStatus = {
  kind: OptionCatalogLinkKind;
  /** Short admin-facing status line. */
  summary: string;
  offeringName: string | null;
  /** True when option label differs from linked offering name. */
  labelDiffersFromOffering: boolean;
};

/**
 * Resolve display status for an option's catalog link.
 * `offering` may be null when the FK is set but the catalog row is missing from the loaded set.
 */
export function optionCatalogLinkStatus(
  option: Pick<EventOrderTemplateOption, "offeringId" | "label">,
  offering: Pick<Offering, "id" | "name" | "isArchived"> | null | undefined,
): OptionCatalogLinkStatus {
  if (!option.offeringId) {
    return {
      kind: "template-only",
      summary: "Template-only",
      offeringName: null,
      labelDiffersFromOffering: false,
    };
  }
  if (!offering || offering.id !== option.offeringId) {
    return {
      kind: "catalog-missing",
      summary: "From catalog · offering unavailable in picker (link preserved)",
      offeringName: null,
      labelDiffersFromOffering: false,
    };
  }
  const offeringName = offering.name.trim();
  const labelDiffersFromOffering =
    option.label.trim().toLowerCase() !== offeringName.toLowerCase();
  if (offering.isArchived) {
    return {
      kind: "catalog-archived",
      summary: `From catalog · ${offeringName} (archived — link preserved)`,
      offeringName,
      labelDiffersFromOffering,
    };
  }
  return {
    kind: "catalog",
    summary: `From catalog · ${offeringName}`,
    offeringName,
    labelDiffersFromOffering,
  };
}

/** Active Offerings only — never suggest archived for a *new* attach. */
export function offeringsAvailableForAttach(catalog: Offering[]): Offering[] {
  return catalog.filter((o) => !o.isArchived);
}

function optionToWriteInput(
  option: EventOrderTemplateOption,
  offeringId: string | null,
  overrides?: Partial<Pick<EventOrderTemplateOption, "label" | "isIncluded" | "unitPrice" | "isDefault" | "description" | "imageUrl">>,
): AddTemplateOptionInput {
  const label = overrides?.label ?? option.label;
  const isIncluded = overrides?.isIncluded ?? option.isIncluded;
  const unitPrice = overrides?.unitPrice !== undefined ? overrides.unitPrice : option.unitPrice;
  const isDefault = overrides?.isDefault ?? option.isDefault;
  const description = overrides?.description !== undefined ? overrides.description : option.description;
  const imageUrl = overrides?.imageUrl !== undefined ? overrides.imageUrl : option.imageUrl;
  return {
    groupId: option.groupId,
    offeringId,
    label,
    description: description ?? undefined,
    isIncluded,
    unitPrice: isIncluded ? "0" : unitPrice == null ? null : String(unitPrice),
    isDefault,
    // Preserve snapshotted photo unless an override explicitly changes it.
    imageUrl: imageUrl?.trim() ? imageUrl.trim() : null,
  };
}

/**
 * Attach (or replace) catalog identity without rewriting label/price/description.
 * Explicit offeringId only — never resolve by name.
 */
export function attachOfferingPreservingSnapshot(
  option: EventOrderTemplateOption,
  offeringId: string,
): AddTemplateOptionInput {
  if (!offeringId) {
    throw new Error("offeringId is required for explicit attach");
  }
  return optionToWriteInput(option, offeringId);
}

/** Remove catalog link; keep template-only label and price snapshots. */
export function clearOfferingLinkPreservingSnapshot(
  option: EventOrderTemplateOption,
): AddTemplateOptionInput {
  return optionToWriteInput(option, null);
}

/** Edit label/price/default while keeping the current offering_id unchanged. */
export function updateOptionFieldsPreservingOfferingLink(
  option: EventOrderTemplateOption,
  fields: Partial<Pick<EventOrderTemplateOption, "label" | "isIncluded" | "unitPrice" | "isDefault" | "description">>,
): AddTemplateOptionInput {
  return optionToWriteInput(option, option.offeringId, fields);
}

/**
 * There is intentionally no name-based attach helper.
 * Call sites must pass an Offering.id chosen by the administrator.
 */
export function assertNoNameBasedOfferingAttach(): void {
  // Documented sentinel for regression tests — do not add name-matching attach APIs here.
}
