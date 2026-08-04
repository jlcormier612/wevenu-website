/**
 * Email when a vendor is assigned to an event — couple select Submit or
 * venue Assign both converge here. Distinct from the claim-profile invite
 * (lib/email/vendor-invite.ts).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildVendorAssignmentHtml({
  vendorName,
  venueName,
  eventLabel,
  deepLinkUrl,
  isUnclaimed,
  claimUrl,
}: {
  vendorName: string;
  venueName: string;
  eventLabel: string;
  deepLinkUrl: string;
  isUnclaimed?: boolean;
  claimUrl?: string | null;
}): string {
  const ctaUrl = isUnclaimed && claimUrl ? claimUrl : deepLinkUrl;
  const ctaLabel = isUnclaimed && claimUrl
    ? "Claim your profile & view event →"
    : "View event →";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280">
          Assignment from ${escapeHtml(venueName)}
        </p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;line-height:1.3">
          You've been selected for ${escapeHtml(eventLabel)}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
          ${escapeHtml(vendorName)} has been assigned to ${escapeHtml(eventLabel)} at ${escapeHtml(venueName)}.
          Open your vendor workspace to message the venue and the couple, and see event details.
        </p>
        <a href="${ctaUrl}"
          style="display:inline-block;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none">
          ${ctaLabel}
        </a>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.5">
          You'll see separate Venue and Couple threads in Messages for this event.
          <br>
          <a href="${ctaUrl}" style="color:#9ca3af;word-break:break-all">${ctaUrl}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-top:20px;text-align:center">
        <p style="font-size:12px;color:#9ca3af;margin:0">Powered by Hello to Cheers</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildVendorAssignmentText({
  vendorName,
  venueName,
  eventLabel,
  deepLinkUrl,
  isUnclaimed,
  claimUrl,
}: {
  vendorName: string;
  venueName: string;
  eventLabel: string;
  deepLinkUrl: string;
  isUnclaimed?: boolean;
  claimUrl?: string | null;
}): string {
  const ctaUrl = isUnclaimed && claimUrl ? claimUrl : deepLinkUrl;
  return [
    `You've been selected for ${eventLabel}`,
    "",
    `${vendorName} has been assigned to ${eventLabel} at ${venueName}.`,
    "Open your vendor workspace to message the venue and the couple, and see event details.",
    "",
    `View: ${ctaUrl}`,
    "",
    "You'll see separate Venue and Couple threads in Messages for this event.",
  ].join("\n");
}
