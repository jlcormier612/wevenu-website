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
};

export type SubmitInquiryInput = {
  kind: InquiryKind;
  fields: Record<string, string>;
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
