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
export { postResendEmail } from "./resend-http";
export {
  RESEND_PACING_MAX_TOTAL,
  RESEND_PACING_MAX_BULK,
  RESEND_PACING_WINDOW_MS,
  RESEND_PROVIDER_RPS,
  maxGrantsInAnySlidingWindow,
} from "./pacing/window-slot";
export {
  DEFAULT_SEND_CATEGORY,
  priorityForCategory,
  type EmailSendCategory,
  type EmailSendPriority,
} from "./pacing/priority";
export {
  acquireResendSendSlot,
  createMemoryResendSlotStore,
  setResendSlotStoreForTests,
} from "./pacing/acquire";
export {
  sendRelationshipEmail,
  sendInquiryConfirmationEmail,
  sendFeedbackConfirmationEmail,
  sendTrialReminder,
  sendRenewalReminder,
  type SendRelationshipEmailInput,
} from "./send";
export { sendEnrollmentProductEmails, sendWelcomeHomeEmail, sendReactivationEmail, type EnrollmentEmailContext } from "./enrollment";
export {
  resolveInquiryNotifyEmail,
  sendOpsInternalEmail,
  type OpsNotifyResult,
} from "./ops-notify";
export {
  activationUrlFromToken,
  activationBaseUrl,
  productAppBaseUrl,
  productPostActivationLoginUrl,
  whiteGloveIntakeUrlFromToken,
} from "./templates/helpers";
export {
  getEmailTemplate,
  listEmailTemplates,
  liveTemplateIds,
  registryOnlyTemplateIds,
  renderEmailTemplate,
} from "./templates/registry";
