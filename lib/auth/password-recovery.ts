/**
 * Venue password recovery helpers.
 * Redirect targets are fixed app paths — never taken from untrusted input.
 */
import { publicAppOrigin } from "@/lib/env";

export const PASSWORD_RECOVERY_SUCCESS_COPY =
  "If an account exists for that email, we’ll send instructions to reset your password. Check your inbox.";

export const PASSWORD_RECOVERY_MIN_LENGTH = 8;

/** Only destination after a recovery link is exchanged. */
export const PASSWORD_RESET_PATH = "/reset-password";

export const FORGOT_PASSWORD_PATH = "/forgot-password";

/**
 * Absolute redirectTo for Supabase Auth recovery emails.
 *
 * Sandbox GoTrue currently allowlists `http://app.sandbox.hellotocheers.com/auth/confirm`
 * and rejects the https variant (falls back to Site URL). Use the allowlisted
 * http confirm URL on that host; elsewhere use the deployment https origin.
 */
export function passwordRecoveryRedirectTo(): string {
  const origin = publicAppOrigin();
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    host = "";
  }
  const confirmPath = `/auth/confirm?next=${encodeURIComponent(PASSWORD_RESET_PATH)}`;
  if (host === "app.sandbox.hellotocheers.com") {
    return `http://app.sandbox.hellotocheers.com${confirmPath}`;
  }
  return `${origin}${confirmPath}`;
}

/** Sanitize ?next= from the Auth confirm callback — recovery only. */
export function safePasswordRecoveryNextPath(raw: unknown): string {
  if (typeof raw !== "string") return PASSWORD_RESET_PATH;
  const trimmed = raw.trim();
  if (trimmed === PASSWORD_RESET_PATH) return PASSWORD_RESET_PATH;
  return PASSWORD_RESET_PATH;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (!password || !confirm) return "Enter and confirm your new password.";
  if (password.length < PASSWORD_RECOVERY_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_RECOVERY_MIN_LENGTH} characters.`;
  }
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
