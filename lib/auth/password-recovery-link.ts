/**
 * Build a venue-app password-recovery URL that does not depend on Supabase
 * Auth Site URL / redirect allow-list (which may still be localhost on a fresh
 * Production project).
 *
 * Lands on /auth/confirm with token_hash so AuthConfirmClient can verifyOtp
 * and continue to /reset-password.
 */

import { PASSWORD_RESET_PATH } from "@/lib/auth/password-recovery";

export function venuePasswordRecoveryUrl(input: {
  appOrigin: string;
  hashedToken: string;
  nextPath?: string;
}): string {
  const origin = input.appOrigin.replace(/\/$/, "");
  const token = input.hashedToken.trim();
  if (!origin || !token) {
    throw new Error("venuePasswordRecoveryUrl requires origin and hashedToken");
  }
  const next = input.nextPath?.trim() || PASSWORD_RESET_PATH;
  const u = new URL(`${origin}/auth/confirm`);
  u.searchParams.set("token_hash", token);
  u.searchParams.set("type", "recovery");
  u.searchParams.set("next", next);
  return u.toString();
}
