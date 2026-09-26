import type { InquiryFormQuestion } from "@/lib/inquiry-form/types";
import { validateCustomAnswers } from "@/lib/inquiry-form/validation";
import type { PublicFormFieldConfig } from "@/lib/public-forms/types";

export { validateCustomAnswers };

export function validatePublicFormFields(
  fields: PublicFormFieldConfig,
  values: {
    phone: string;
    eventType: string;
    eventDate: string;
    guestCount: string;
  },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (fields.phone === "required" && !values.phone.trim()) {
    errors.phone = "Phone is required.";
  }
  if (fields.event_type === "required" && !values.eventType.trim()) {
    errors.eventType = "Event type is required.";
  }
  if (fields.preferred_event_date === "required" && !values.eventDate) {
    errors.eventDate = "Preferred event date is required.";
  }
  if (fields.guest_count === "required" && !values.guestCount.trim()) {
    errors.guestCount = "Guest count is required.";
  }
  return errors;
}

export function validatePublicFormIdentity(values: {
  firstName: string;
  lastName: string;
  email: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Email address is not valid.";
  }
  return errors;
}

export function validatePublicFormSubmission(
  fields: PublicFormFieldConfig,
  questions: InquiryFormQuestion[],
  values: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    eventType: string;
    eventDate: string;
    guestCount: string;
    customAnswers: Record<string, string | string[]>;
  },
): Record<string, string> {
  return {
    ...validatePublicFormIdentity(values),
    ...validatePublicFormFields(fields, values),
    ...validateCustomAnswers(questions, values.customAnswers),
  };
}
