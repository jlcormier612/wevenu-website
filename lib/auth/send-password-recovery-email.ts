/**
 * Send a Supabase Auth recovery link via HTC Resend (branded).
 * Never logs the reset URL or tokens.
 *
 * Goes through lib/email/send.ts so Sandbox/practice-run gates and
 * distributed Resend pacing apply (RESEND-SCALE Phase B).
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import {
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
  buildPasswordRecoveryEmailHtml,
  buildPasswordRecoveryEmailText,
} from "@/lib/auth/password-recovery-email";
import { venuePasswordRecoveryUrl } from "@/lib/auth/password-recovery-link";
import {
  PASSWORD_RESET_PATH,
  type PasswordRecoveryAudience,
} from "@/lib/auth/password-recovery";
import { publicAppOrigin } from "@/lib/env";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";

export type SendPasswordRecoveryResult =
  | { ok: true; providerId?: string }
  | { ok: false; reason: "not_configured" | "no_user" | "link_failed" | "send_failed"; detail?: string };

/**
 * Generate a Supabase recovery token and deliver a Production recovery URL
 * with HTC branding. Unknown emails return `{ ok: false, reason: "no_user" }`
 * so callers can still show enumeration-safe success copy.
 */
export async function sendBrandedPasswordRecoveryEmail(opts: {
  email: string;
  audience: PasswordRecoveryAudience;
}): Promise<SendPasswordRecoveryResult> {
  if (!isEmailConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const email = opts.email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (
      msg.includes("user not found") ||
      msg.includes("unable to find") ||
      msg.includes("no user")
    ) {
      return { ok: false, reason: "no_user" };
    }
    return { ok: false, reason: "link_failed", detail: "generateLink failed" };
  }

  const hashedToken = data.properties?.hashed_token || "";
  if (!hashedToken) {
    return { ok: false, reason: "link_failed", detail: "missing hashed_token" };
  }

  // Prefer Production app origin + token_hash. Supabase action_link still embeds
  // Site URL (localhost on this Production project) when redirect allow-list
  // rejects our redirectTo — that yields ERR_CONNECTION_REFUSED for founders.
  const nextPath =
    opts.audience === "venue"
      ? PASSWORD_RESET_PATH
      : `${PASSWORD_RESET_PATH}?audience=${encodeURIComponent(opts.audience)}`;
  const actionLink = venuePasswordRecoveryUrl({
    appOrigin: publicAppOrigin(),
    hashedToken,
    nextPath,
  });

  // Auth links must not be rewritten by click tracking.
  const result = await sendEmail({
    to: email,
    subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
    text: buildPasswordRecoveryEmailText(actionLink),
    html: buildPasswordRecoveryEmailHtml(actionLink),
    category: "password_recovery",
    priority: "critical",
    openTracking: false,
    clickTracking: false,
    userAgent: "htc-password-recovery/1.0",
    tags: [
      { name: "category", value: "password_recovery" },
      { name: "audience", value: opts.audience },
    ],
    // No Idempotency-Key: each generateLink produces a unique action URL. Reusing a
    // time-bucketed key with a different payload would 409 at Resend. This path does
    // not auto-retry the same body.
  });

  if (!result.ok) {
    return { ok: false, reason: "send_failed", detail: result.code ?? "send_failed" };
  }

  return {
    ok: true,
    providerId: result.method === "resend" ? result.providerId : undefined,
  };
}
