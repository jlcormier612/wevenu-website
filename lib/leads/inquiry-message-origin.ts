/**
 * Durable authorship of leads.inquiry_message.
 *
 * This is not marketing source, trust tier, or intake confidence.
 * Write paths set the origin explicitly. Missing/legacy is unknown.
 */

export const INQUIRY_MESSAGE_ORIGINS = ["customer", "venue", "unknown"] as const;
export type InquiryMessageOrigin = (typeof INQUIRY_MESSAGE_ORIGINS)[number];

export type InquiryMessageWritePath =
  | "manual_new_lead"
  | "public_inquire"
  | "public_form"
  | "email_intake"
  | "tour_book"
  | "facebook_webhook"
  | "import"
  | "staff_edit"
  | "legacy";

export function normalizeInquiryMessageOrigin(
  value: string | null | undefined,
): InquiryMessageOrigin {
  if (value === "customer" || value === "venue" || value === "unknown") return value;
  return "unknown";
}

/** Write-path → stored origin. Import and legacy are never guessed as customer. */
export function originForWritePath(path: InquiryMessageWritePath): InquiryMessageOrigin {
  switch (path) {
    case "public_inquire":
    case "public_form":
    case "email_intake":
    case "tour_book":
    case "facebook_webhook":
      return "customer";
    case "manual_new_lead":
    case "staff_edit":
      return "venue";
    case "import":
    case "legacy":
    default:
      return "unknown";
  }
}

/**
 * Eligible for customer-facing Luv prompt context.
 * Venue and unknown/mixed/legacy never enter.
 */
export function customerFacingInquiryMessage(
  inquiryMessage: string | null | undefined,
  origin: string | null | undefined,
): string | null {
  if (normalizeInquiryMessageOrigin(origin) !== "customer") return null;
  const trimmed = inquiryMessage?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function originAfterStaffEdit(opts: {
  previousMessage: string | null | undefined;
  nextMessage: string | null | undefined;
  previousOrigin: string | null | undefined;
}): InquiryMessageOrigin {
  const prev = (opts.previousMessage ?? "").trim();
  const next = (opts.nextMessage ?? "").trim();
  if (prev === next) return normalizeInquiryMessageOrigin(opts.previousOrigin);
  return "venue";
}

export function inquiryMessageDisplayLabel(origin: string | null | undefined): string {
  const normalized = normalizeInquiryMessageOrigin(origin);
  if (normalized === "customer") return "Original inquiry";
  if (normalized === "venue") return "Internal notes";
  return "Notes";
}

export function inquiryMessageDisplayHint(origin: string | null | undefined): string | null {
  const normalized = normalizeInquiryMessageOrigin(origin);
  if (normalized === "venue") {
    return "Private to your venue team — never visible to the client.";
  }
  if (normalized === "unknown") {
    return "This text is not verified as customer-authored.";
  }
  return null;
}
