/**
 * Re-export shared branded password-recovery email (single source of truth).
 */
export {
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
  buildPasswordRecoveryEmailHtml,
  buildPasswordRecoveryEmailText,
} from "../../shared/auth/password-recovery-email";
