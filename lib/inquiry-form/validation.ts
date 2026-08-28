import type { InquiryFormFieldsConfig, InquiryFormQuestion } from "@/lib/inquiry-form/types";

export function fieldLabel(base: string, visibility: "required" | "optional" | "hidden"): string {
  if (visibility === "required") return `${base} *`;
  return base;
}

export function validateConfigurableFields(
  fields: InquiryFormFieldsConfig,
  values: {
    phone: string;
    partnerFirst: string;
    partnerLast: string;
    eventDate: string;
    guestCount: string;
    budget: string;
    message: string;
  },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (fields.phone === "required" && !values.phone.trim()) errors.phone = "Phone is required.";
  if (fields.partner === "required" && (!values.partnerFirst.trim() || !values.partnerLast.trim())) {
    errors.partner = "Partner / Co-host is required.";
  }
  if (fields.preferred_event_date === "required" && !values.eventDate) {
    errors.eventDate = "Preferred event date is required.";
  }
  if (fields.guest_count === "required" && !values.guestCount.trim()) {
    errors.guestCount = "Guest count is required.";
  }
  if (fields.estimated_budget === "required" && !values.budget.trim()) {
    errors.budget = "Estimated budget is required.";
  }
  if (fields.event_details === "required" && !values.message.trim()) {
    errors.message = "Tell us about your event is required.";
  }
  return errors;
}

export function validateCustomAnswers(
  questions: InquiryFormQuestion[],
  answers: Record<string, string | string[]>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const val = answers[q.id];
    if (!q.required) continue;
    if (q.questionType === "multiple_select") {
      if (!Array.isArray(val) || val.length === 0) errors[q.id] = "This field is required.";
    } else if (!val || (typeof val === "string" && !val.trim())) {
      errors[q.id] = "This field is required.";
    }
  }
  return errors;
}
