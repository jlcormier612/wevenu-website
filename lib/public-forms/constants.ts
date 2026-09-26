import type { PublicFormFieldConfig, PublicFormFieldKey } from "@/lib/public-forms/types";

/**
 * Wave 1 SMS policy for purpose-specific Public Forms:
 * - Do NOT collect SMS consent on these forms.
 * - Phone is contact info only; phone ≠ SMS consent.
 * - Explicit SMS consent remains on the venue inquiry form only
 *   (requestSmsPermission + applyInquiryCommunicationCapture).
 */
export const PUBLIC_FORM_COLLECTS_SMS_CONSENT = false;

export const DEFAULT_PUBLIC_FORM_FIELD_CONFIG: PublicFormFieldConfig = {
  phone: "optional",
  event_type: "hidden",
  preferred_event_date: "optional",
  guest_count: "optional",
};

export const PUBLIC_FORM_FIELD_LABELS: Record<PublicFormFieldKey, string> = {
  phone: "Phone",
  event_type: "Event type",
  preferred_event_date: "Preferred event date",
  guest_count: "Guest count",
};

export const PUBLIC_FORM_API_ERRORS: Record<string, string> = {
  name_required: "First and last name are required.",
  email_required: "Email is required.",
  phone_required: "Phone is required.",
  event_type_required: "Event type is required.",
  event_date_required: "Preferred event date is required.",
  guest_count_required: "Guest count is required.",
  form_unavailable: "This form is not available.",
};
