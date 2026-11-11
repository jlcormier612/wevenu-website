import type {
  EmailTemplateDefinition,
  EmailTemplateId,
  EmailTemplateVars,
  RenderedEmail,
} from "../types";
import {
  accountReactivatedTemplate,
  accountSuspendedTemplate,
  feedbackConfirmationTemplate,
  founderWelcomeTemplate,
  inquiryConfirmationTemplate,
  kickoffTemplate,
  luvSuggestionTemplate,
  paymentReceiptTemplate,
  paymentReminderTemplate,
  renewalReminderTemplate,
  subscriptionLinkTemplate,
  trialReminderTemplate,
  welcomeBackRejectedTemplate,
  welcomeBackTemplate,
  welcomeBackVerifiedTemplate,
  welcomeHomeTemplate,
  welcomeTemplate,
  whiteGloveSchedulingTemplate,
  whiteGloveWelcomeTemplate,
} from "./definitions";

const TEMPLATES: EmailTemplateDefinition[] = [
  welcomeTemplate,
  founderWelcomeTemplate,
  welcomeBackTemplate,
  welcomeBackVerifiedTemplate,
  welcomeBackRejectedTemplate,
  kickoffTemplate,
  paymentReceiptTemplate,
  whiteGloveSchedulingTemplate,
  whiteGloveWelcomeTemplate,
  welcomeHomeTemplate,
  paymentReminderTemplate,
  accountSuspendedTemplate,
  accountReactivatedTemplate,
  subscriptionLinkTemplate,
  trialReminderTemplate,
  renewalReminderTemplate,
  inquiryConfirmationTemplate,
  feedbackConfirmationTemplate,
  luvSuggestionTemplate,
];

const BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<
  EmailTemplateId,
  EmailTemplateDefinition
>;

export function listEmailTemplates(): EmailTemplateDefinition[] {
  return [...TEMPLATES];
}

export function getEmailTemplate(id: EmailTemplateId): EmailTemplateDefinition {
  const template = BY_ID[id];
  if (!template) {
    throw new Error(`Unknown email template: ${id}`);
  }
  return template;
}

export function renderEmailTemplate(
  id: EmailTemplateId,
  vars: EmailTemplateVars = {},
): RenderedEmail {
  return getEmailTemplate(id).render(vars);
}

export function liveTemplateIds(): EmailTemplateId[] {
  return TEMPLATES.filter((t) => t.status === "live").map((t) => t.id);
}

export function registryOnlyTemplateIds(): EmailTemplateId[] {
  return TEMPLATES.filter((t) => t.status === "registry").map((t) => t.id);
}
