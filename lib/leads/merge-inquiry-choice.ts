/**
 * Client-safe inquiry conflict helpers for Merge Lead.
 * Kept separate from merge.ts so the dialog does not pull server-only imports.
 */

/** Sentinel in fieldChoices.inquiry_message: keep primary text on the lead and archive secondary separately. */
export const KEEP_BOTH_INQUIRY_CHOICE = "__keep_both__";

/**
 * Resolve inquiry conflict choice for confirm payload.
 * Keep-both preserves secondary as lead_activities (not concatenated into inquiry_message).
 */
export function resolveInquiryMessageChoice(input: {
  choice: string | null | undefined;
  primaryValue: string;
  secondaryValue: string;
}): { primaryFieldValue: string; preserveSecondaryAsHistory: boolean } {
  const primary = input.primaryValue.trim();
  const secondary = input.secondaryValue.trim();
  if (input.choice === KEEP_BOTH_INQUIRY_CHOICE) {
    return {
      primaryFieldValue: primary,
      preserveSecondaryAsHistory: secondary.length > 0 && secondary !== primary,
    };
  }
  if (input.choice != null && String(input.choice).trim() === secondary) {
    return { primaryFieldValue: secondary, preserveSecondaryAsHistory: false };
  }
  if (input.choice != null && String(input.choice).trim().length > 0) {
    return { primaryFieldValue: String(input.choice).trim(), preserveSecondaryAsHistory: false };
  }
  return { primaryFieldValue: primary, preserveSecondaryAsHistory: false };
}
