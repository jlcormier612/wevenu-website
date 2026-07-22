import type {
  EmailTemplateDefinition,
  EmailTemplateId,
  EmailTemplateVars,
  RenderedEmail,
} from "../types";
import {
  founderWelcomeTemplate,
  kickoffTemplate,
  luvSuggestionTemplate,
  paymentReceiptTemplate,
  renewalReminderTemplate,
  trialReminderTemplate,
  welcomeBackRejectedTemplate,
  welcomeBackTemplate,
  welcomeBackVerifiedTemplate,
  welcomeTemplate,
  whiteGloveSchedulingTemplate,
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
  trialReminderTemplate,
  renewalReminderTemplate,
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
