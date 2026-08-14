/**
 * Couple Tasks Impl 5 — verified insurance completion gates.
 *
 * Durable proof (Option A): couple_documents row with source_type=insurance
 * AND share_with_venue=true. Nothing else auto-completes the couple path.
 */

export const COUPLE_INSURANCE_SOURCE_TYPE = "insurance" as const;
export const COUPLE_INSURANCE_TRIGGER = "document_uploaded_insurance" as const;
export const COUPLE_INSURANCE_CELEBRATION_TYPE = "insurance_uploaded" as const;

/** True only when classified insurance is committed to the venue. */
export function shouldFireInsuranceAutoComplete(input: {
  sourceType: string | null | undefined;
  shareWithVenue: boolean;
}): boolean {
  return input.sourceType === COUPLE_INSURANCE_SOURCE_TYPE && input.shareWithVenue === true;
}

/**
 * Normalize portal POST sourceType — only "insurance" is special-cased;
 * everything else remains a generic upload (no invent via filename).
 */
export function normalizeCoupleDocumentSourceType(
  sourceType: string | null | undefined,
): "insurance" | "upload" {
  return sourceType === COUPLE_INSURANCE_SOURCE_TYPE ? "insurance" : "upload";
}

/** Insurance commits without share are incomplete — do not persist as proven. */
export function insuranceCommitError(
  sourceType: string | null | undefined,
  shareWithVenue: boolean,
): "insurance_requires_share" | null {
  if (normalizeCoupleDocumentSourceType(sourceType) !== "insurance") return null;
  if (shareWithVenue) return null;
  return "insurance_requires_share";
}
