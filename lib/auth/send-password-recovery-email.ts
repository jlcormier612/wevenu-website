/**
 * Send a Supabase Auth recovery link via HTC Resend (branded).
 * Never logs the reset URL or tokens.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import {
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
  buildPasswordRecoveryEmailHtml,
  buildPasswordRecoveryEmailText,
} from "@/lib/auth/password-recovery-email";
import {
  passwordRecoveryRedirectTo,
  type PasswordRecoveryAudience,
} from "@/lib/auth/password-recovery";
import { isEmailConfigured } from "@/lib/email/send";

export type SendPasswordRecoveryResult =
  | { ok: true; providerId?: string }
  | { ok: false; reason: "not_configured" | "no_user" | "link_failed" | "send_failed"; detail?: string };

/**
 * Generate a Supabase recovery action_link and deliver it with HTC branding.
 * Unknown emails return `{ ok: false, reason: "no_user" }` so callers can
 * still show enumeration-safe success copy.
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
  const redirectTo = passwordRecoveryRedirectTo(opts.audience);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
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

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    return { ok: false, reason: "link_failed", detail: "missing action_link" };
  }

  const fromEmail =
    process.env.FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "Hello to Cheers <jennifer@hellotocheers.com>";
  const apiKey = process.env.RESEND_API_KEY!.trim();

  // Auth links must not be rewritten by click tracking.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "htc-password-recovery/1.0",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
      text: buildPasswordRecoveryEmailText(actionLink),
      html: buildPasswordRecoveryEmailHtml(actionLink),
      tags: [
        { name: "category", value: "password_recovery" },
        { name: "audience", value: opts.audience },
      ],
      open_tracking: false,
      click_tracking: false,
    }),
  });

  if (!res.ok) {
    // Do not surface provider body (may echo addresses); keep detail generic.
    return { ok: false, reason: "send_failed", detail: `resend_${res.status}` };
  }

  const payload = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, providerId: payload?.id };
}
