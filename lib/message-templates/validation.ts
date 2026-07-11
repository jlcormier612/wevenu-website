/**
 * Message Template Library validation. Pure functions.
 */
import type { MessageTemplateErrors, MessageTemplateInput } from "@/lib/message-templates/types";

export function validateMessageTemplateInput(input: MessageTemplateInput): MessageTemplateErrors {
  const errors: MessageTemplateErrors = {};
  if (!input.name.trim()) errors.name = "Template name is required.";

  const hasEmail = !!input.emailBody.trim();
  const hasSms = !!input.smsBody.trim();
  if (!hasEmail && !hasSms) {
    errors.emailBody = "Add content for Email, SMS, or both.";
    errors.smsBody = "Add content for Email, SMS, or both.";
  }
  if (hasEmail && !input.emailSubject.trim()) {
    errors.emailSubject = "An email needs a subject line.";
  }
  return errors;
}
