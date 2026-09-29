/**
 * Choices Template options — Offering is primary; label is presentation-layer.
 */
import type { Offering } from "@/lib/offerings/types";

export type ChoicesOptionDraft = {
  offeringId: string | null;
  label: string;
  isIncluded: boolean;
  unitPrice: number | null;
};

export function choicesOptionDraftFromOffering(offering: Offering): ChoicesOptionDraft {
  const hasPrice = offering.defaultUnitPrice != null;
  return {
    offeringId: offering.id,
    label: offering.name.trim(),
    isIncluded: !hasPrice,
    unitPrice: hasPrice ? offering.defaultUnitPrice : null,
  };
}

export function customChoicesOptionDraft(label: string): ChoicesOptionDraft {
  return {
    offeringId: null,
    label: label.trim(),
    isIncluded: true,
    unitPrice: null,
  };
}

/** Editing the customer-facing label must not clear offering provenance. */
export function withChoicesOptionLabel(
  draft: ChoicesOptionDraft,
  label: string,
): ChoicesOptionDraft {
  return { ...draft, label: label.trim() };
}

export function isCatalogBackedChoicesOption(
  option: Pick<{ offeringId: string | null }, "offeringId">,
): boolean {
  return Boolean(option.offeringId);
}
