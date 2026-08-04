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
  getInboundEmailDomain,
  buildRelationshipReplyTo,
  isResendConfigured,
  sendRawEmail,
  type RawEmailPayload,
} from "./client";
export {
  sendRelationshipEmail,
  sendInquiryConfirmationEmail,
  sendFeedbackConfirmationEmail,
  sendTrialReminder,
  sendRenewalReminder,
  type SendRelationshipEmailInput,
} from "./send";
export { sendEnrollmentProductEmails, sendWelcomeHomeEmail, sendReactivationEmail, type EnrollmentEmailContext } from "./enrollment";
export { activationUrlFromToken, activationBaseUrl } from "./templates/helpers";
export {
  getEmailTemplate,
  listEmailTemplates,
  liveTemplateIds,
  registryOnlyTemplateIds,
  renderEmailTemplate,
} from "./templates/registry";
