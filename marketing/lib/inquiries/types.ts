/**
 * Marketing inquiry / contact architecture.
 * Shared by Contact, Walkthrough, Welcome Back, Newsletter, and Support.
 * Storage is intentionally simple so launch stays manual; swap the store later without changing UX.
 */

export type InquiryKind =
  | "contact"
  | "walkthrough"
  | "welcome_back_request"
  | "newsletter"
  | "support";

export type InquirySubmission = {
  id: string;
  kind: InquiryKind;
  /** Human label for ops review — e.g. "Welcome Back Request" */
  label: string;
  createdAt: string;
  fields: Record<string, string>;
  /** True when a retry replayed an already-ingested sourceId (no new notify). */
  replayed?: boolean;
};

export type SubmitInquiryInput = {
  kind: InquiryKind;
  fields: Record<string, string>;
  /**
   * Client-generated UUID for a single submit attempt.
   * Retries with the same key must not create duplicate CRM/notify side effects.
   */
  idempotencyKey?: string | null;
};

export function inquiryLabel(kind: InquiryKind): string {
  switch (kind) {
    case "welcome_back_request":
      return "Welcome Back Request";
    case "walkthrough":
      return "Walkthrough Request";
    case "contact":
      return "Contact Inquiry";
    case "newsletter":
      return "Newsletter Signup";
    case "support":
      return "Support Request";
  }
}
