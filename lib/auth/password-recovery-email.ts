/**
 * Branded Hello to Cheers password-recovery email.
 *
 * Delivery uses Resend (HTC verified sender). The reset URL is always a
 * Supabase Auth recovery action_link from admin.generateLink — not a
 * custom token scheme.
 */
import { htcEmailLogoHeaderHtml } from "@/shared/brand/logo";

export const PASSWORD_RECOVERY_EMAIL_SUBJECT = "Reset your Hello to Cheers password";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPasswordRecoveryEmailHtml(resetUrl: string): string {
  const safeUrl = escapeHtml(resetUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${PASSWORD_RECOVERY_EMAIL_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ddd6cc;border-radius:4px">
          <tr>
            <td style="padding:36px 32px 28px;border-top:4px solid #5d6f5d">
              ${htcEmailLogoHeaderHtml({ href: "https://hellotocheers.com", widthPx: 180 })}
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#5d6f5d">
                Password reset
              </p>
              <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:600;color:#1f2a1f">
                Reset your Hello to Cheers password
              </h1>
              <p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#374151">
                We received a request to reset the password for your Hello to Cheers account.
                Use the button below to choose a new password. This link expires soon for your security.
              </p>
              <p style="margin:0 0 28px">
                <a href="${safeUrl}"
                   style="display:inline-block;background:#5d6f5d;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;padding:14px 26px;border-radius:6px;text-decoration:none">
                  Reset password
                </a>
              </p>
              <p style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#6b7280">
                If the button doesn’t work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all">
                ${safeUrl}
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#6b7280">
                If you didn’t request a password reset, you can ignore this email. Your password will stay the same.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center">
              Hello to Cheers · hellotocheers.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordRecoveryEmailText(resetUrl: string): string {
  return [
    "Reset your Hello to Cheers password",
    "",
    "We received a request to reset the password for your Hello to Cheers account.",
    "Open the link below to choose a new password. This link expires soon for your security.",
    "",
    resetUrl,
    "",
    "If you didn’t request a password reset, you can ignore this email. Your password will stay the same.",
    "",
    "Hello to Cheers",
  ].join("\n");
}
