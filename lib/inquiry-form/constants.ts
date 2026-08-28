import type { InquiryFormFieldsConfig, StandardFieldKey } from "@/lib/inquiry-form/types";

/** Public inquiry form event types — product-approved list for website inquiry. */
export const PUBLIC_INQUIRY_EVENT_TYPES = [
  { value: "wedding", label: "Wedding" },
  { value: "corporate_event", label: "Corporate Event" },
  { value: "social_event", label: "Social Event" },
  { value: "birthday_milestone", label: "Birthday / Milestone" },
  { value: "other", label: "Other" },
] as const;

export const DEFAULT_INQUIRY_FORM_FIELDS: InquiryFormFieldsConfig = {
  phone: "optional",
  partner: "optional",
  guest_count: "optional",
  estimated_budget: "optional",
  preferred_event_date: "optional",
  event_details: "optional",
};

export const STANDARD_FIELD_LABELS: Record<StandardFieldKey, string> = {
  phone: "Phone",
  partner: "Partner / Co-host",
  guest_count: "Guest count",
  estimated_budget: "Estimated budget",
  preferred_event_date: "Preferred event date",
  event_details: "Tell us about your event",
};

export const INQUIRY_API_ERRORS: Record<string, string> = {
  event_type_required: "Event type is required.",
  date_unavailable: "That date is no longer available. Please choose another date.",
  slot_unavailable: "That time is no longer available. Please choose another time.",
  slot_taken: "That time is no longer available. Please choose another time.",
};
