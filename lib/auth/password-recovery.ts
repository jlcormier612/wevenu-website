/**
 * Password recovery helpers (venue / vendor / client cookie jars).
 * Redirect targets are fixed app paths — never taken from untrusted input.
 */
import type { AuthSessionScope } from "@/lib/auth/session-scope";
import { publicAppOrigin } from "@/lib/env";

export const PASSWORD_RECOVERY_SUCCESS_COPY =
  "If an account exists for that email, we’ll send instructions to reset your password. Check your inbox.";

export const PASSWORD_RECOVERY_MIN_LENGTH = 8;

/** Only destination after a recovery link is exchanged. */
export const PASSWORD_RESET_PATH = "/reset-password";

export const FORGOT_PASSWORD_PATH = "/forgot-password";

export type PasswordRecoveryAudience = AuthSessionScope;

/** Sanitize recovery audience — defaults to venue staff. */
export function safePasswordRecoveryAudience(raw: unknown): PasswordRecoveryAudience {
  if (raw === "client" || raw === "vendor" || raw === "venue") return raw;
  return "venue";
}

export function loginPathForAudience(audience: PasswordRecoveryAudience): string {
  if (audience === "client") return "/client/login";
  if (audience === "vendor") return "/vendor/login";
  return "/login";
}

/**
 * Absolute redirectTo for Supabase Auth recovery emails.
 *
 * Sandbox GoTrue currently allowlists `http://app.sandbox.hellotocheers.com/auth/confirm`
 * and rejects the https variant (falls back to Site URL). Keep the confirm URL
 * shape stable — put audience inside `next` (not as a sibling query), because
 * extra Auth redirect_to query keys are rejected and fall back to Site URL.
 */
export function passwordRecoveryRedirectTo(
  audience: PasswordRecoveryAudience = "venue",
): string {
  const origin = publicAppOrigin();
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    host = "";
  }
  const next =
    audience === "venue"
      ? PASSWORD_RESET_PATH
      : `${PASSWORD_RESET_PATH}?audience=${encodeURIComponent(audience)}`;
  const confirmPath = `/auth/confirm?next=${encodeURIComponent(next)}`;
  if (host === "app.sandbox.hellotocheers.com") {
    return `http://app.sandbox.hellotocheers.com${confirmPath}`;
  }
  return `${origin}${confirmPath}`;
}

/** Sanitize ?next= from the Auth confirm callback — recovery only. */
export function safePasswordRecoveryNextPath(raw: unknown): string {
  if (typeof raw !== "string") return PASSWORD_RESET_PATH;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(PASSWORD_RESET_PATH)) return PASSWORD_RESET_PATH;
  if (trimmed === PASSWORD_RESET_PATH) return PASSWORD_RESET_PATH;
  try {
    const u = new URL(trimmed, "http://local.invalid");
    if (u.pathname !== PASSWORD_RESET_PATH) return PASSWORD_RESET_PATH;
    const audience = safePasswordRecoveryAudience(u.searchParams.get("audience"));
    if (audience === "venue") return PASSWORD_RESET_PATH;
    return `${PASSWORD_RESET_PATH}?audience=${encodeURIComponent(audience)}`;
  } catch {
    return PASSWORD_RESET_PATH;
  }
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (!password || !confirm) return "Enter and confirm your new password.";
  if (password.length < PASSWORD_RECOVERY_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_RECOVERY_MIN_LENGTH} characters.`;
  }
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
