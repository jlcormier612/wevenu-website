/**
 * Welcome Experience (WP3) — presentational document shape.
 * Callers map Legal Acceptance Engine outstanding docs into this form
 * (see `welcomeDocumentsFromOutstanding`).
 */

import type { LegalDocumentType } from "@/lib/legal/types";

/** One required document row shown in the Welcome Experience list. */
export type WelcomeExperienceDocument = {
  title: string;
  version: string;
  effectiveDate: string;
  /** Public legal URL (path or absolute). Prefer new-tab open. */
  viewHref: string;
  /** Stable list key when available (active document id). */
  id?: string;
  documentType?: LegalDocumentType;
};

export type WelcomeExperienceProps = {
  heading: string;
  /** One paragraph, or multiple paragraphs rendered in order. */
  introduction: string | string[];
  /**
   * Outstanding / required documents from the Legal Acceptance Engine
   * (mapped to display fields). Empty = already compliant.
   */
  documents: WelcomeExperienceDocument[];
  /**
   * Parent records acceptances via the engine. Called after the user
   * confirms (or immediately when already compliant).
   * Do not navigate inside Welcome Experience — use onSuccess after resolve.
   */
  onContinue: () => Promise<void> | void;
  /** Invoked when onContinue resolves successfully. */
  onSuccess?: () => void;
  className?: string;
};
