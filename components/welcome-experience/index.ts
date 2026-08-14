/**
 * Welcome Experience — reusable universal legal acceptance UI (WP3).
 * Presentational: does not wire auth, invitations, or existing legal gates.
 */

export { WelcomeExperience } from "./welcome-experience";
export { WelcomeExperienceDocumentList } from "./welcome-experience-document-list";
export { WelcomeExperienceErrorAlert } from "./welcome-experience-error-alert";
export { WELCOME_EXPERIENCE_COPY } from "./welcome-experience-copy";
export {
  WELCOME_ACCEPTANCE_ERROR_DETAIL,
  WELCOME_ACCEPTANCE_ERROR_TITLE,
  WELCOME_AGREE_LABEL,
  WELCOME_CONTINUE_LABEL,
  WELCOME_SAVING_LABEL,
  WELCOME_SUPPORT_BODY,
  WELCOME_SUPPORT_HEADING,
  attemptWelcomeContinue,
  canContinue,
  formatWelcomeEffectiveDate,
  isAlreadyCompliant,
  normalizeIntroduction,
  shouldShowAgreementCheckbox,
  welcomeDocumentsFromOutstanding,
} from "./welcome-experience-helpers";
export type {
  WelcomeExperienceDocument,
  WelcomeExperienceProps,
} from "./types";
