/**
 * Pure helpers for the Welcome Experience (WP3 legal acceptance UI).
 * Kept framework-light so node:test can cover enablement / error / mapping.
 */

import { publicPathForLegalDocumentType } from "@/lib/legal/public-routes";
import type { OutstandingDocument } from "@/lib/legal/acceptance-engine";
import type { WelcomeExperienceDocument } from "./types";

export const WELCOME_AGREE_LABEL =
  "I have reviewed and agree to the documents above.";

export const WELCOME_CONTINUE_LABEL = "Continue";
export const WELCOME_SAVING_LABEL = "Saving...";

export const WELCOME_ACCEPTANCE_ERROR_TITLE =
  "We couldn't save your acceptance.";
export const WELCOME_ACCEPTANCE_ERROR_DETAIL = "Please try again.";

export const WELCOME_SUPPORT_HEADING = "Need help?";
export const WELCOME_SUPPORT_BODY =
  "Contact your venue or Hello to Cheers Support.";

/** True when nothing is required — Continue without checkbox. */
export function isAlreadyCompliant(
  documents: readonly WelcomeExperienceDocument[],
): boolean {
  return documents.length === 0;
}

export function shouldShowAgreementCheckbox(
  documents: readonly WelcomeExperienceDocument[],
): boolean {
  return documents.length > 0;
}

export function canContinue(input: {
  documents: readonly WelcomeExperienceDocument[];
  agreed: boolean;
  pending: boolean;
}): boolean {
  if (input.pending) return false;
  if (isAlreadyCompliant(input.documents)) return true;
  return input.agreed;
}

export function normalizeIntroduction(
  introduction: string | string[],
): string[] {
  if (Array.isArray(introduction)) {
    return introduction.filter((p) => p.trim().length > 0);
  }
  const trimmed = introduction.trim();
  return trimmed ? [trimmed] : [];
}

/**
 * Display effective dates as a quiet editorial date.
 * Accepts `YYYY-MM-DD` or full ISO; falls back to the raw string.
 */
export function formatWelcomeEffectiveDate(value: string): string {
  const raw = value.trim();
  if (!raw) return value;
  const isoDay = /^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0];
  const d = isoDay
    ? new Date(`${isoDay}T00:00:00.000Z`)
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Map engine outstanding rows to Welcome list items.
 * Skips types with no active version (nothing to review yet).
 */
export function welcomeDocumentsFromOutstanding(
  outstanding: readonly OutstandingDocument[],
): WelcomeExperienceDocument[] {
  const docs: WelcomeExperienceDocument[] = [];
  for (const row of outstanding) {
    if (!row.active) continue;
    docs.push({
      id: row.active.id,
      documentType: row.documentType,
      title: row.active.title,
      version: row.active.version,
      effectiveDate: row.active.effectiveDate,
      viewHref: publicPathForLegalDocumentType(row.documentType),
    });
  }
  return docs;
}

/**
 * Runs the parent acceptance callback. Navigation stays outside the component.
 * Returns `"error"` when onContinue rejects (no technical details surfaced).
 */
export async function attemptWelcomeContinue(input: {
  onContinue: () => Promise<void> | void;
  onSuccess?: () => void;
}): Promise<"success" | "error"> {
  try {
    await input.onContinue();
    input.onSuccess?.();
    return "success";
  } catch {
    return "error";
  }
}
