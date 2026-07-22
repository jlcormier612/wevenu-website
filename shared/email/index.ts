/**
 * Shared email module — Resend transport + template registry + Relationship timeline.
 *
 * Import as `@shared/email` from marketing / workspace.
 */

export type * from "./types";
export { EMAIL_TEMPLATE_IDS } from "./types";
export {
  getEmailFromAddress,
  getEmailReplyTo,
  isResendConfigured,
  sendRawEmail,
  type RawEmailPayload,
} from "./client";
export {
  sendRelationshipEmail,
  sendTrialReminder,
  sendRenewalReminder,
  type SendRelationshipEmailInput,
} from "./send";
export { sendEnrollmentProductEmails, type EnrollmentEmailContext } from "./enrollment";
export {
  getEmailTemplate,
  listEmailTemplates,
  liveTemplateIds,
  registryOnlyTemplateIds,
  renderEmailTemplate,
} from "./templates/registry";
