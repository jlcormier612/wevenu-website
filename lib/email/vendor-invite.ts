/**
 * Vendor invitation email template.
 */

export function buildVendorInviteHtml({
  vendorName,
  venueName,
  acceptUrl,
  message,
}: {
  vendorName: string;
  venueName:  string;
  acceptUrl:  string;
  message?:   string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280">
          Invitation from ${escapeHtml(venueName)}
        </p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;line-height:1.3">
          ${escapeHtml(venueName)} has included you as one of the vendors they make available to couples
        </h1>
        ${message ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${escapeHtml(message)}</p>` : ""}
        <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
          They've added ${escapeHtml(vendorName)} to their approved vendor list on Hello to Cheers and created a starting profile for your business.
        </p>
        <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6">
          Claiming your vendor profile is free and lets you:
        </p>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;color:#374151;line-height:1.7">
          <li>Take ownership of your business information</li>
          <li>Share a richer profile with packages and FAQs</li>
          <li>Receive messages from couples who discover you</li>
          <li>Collaborate on events once you're selected — messaging, timeline, tasks, and documents</li>
        </ul>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
          It only takes a minute to get started.
        </p>
        <a href="${acceptUrl}"
          style="display:inline-block;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none">
          Claim My Vendor Profile →
        </a>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.5">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.<br>
          <a href="${acceptUrl}" style="color:#9ca3af;word-break:break-all">${acceptUrl}</a>
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

export function buildVendorInviteText({
  vendorName,
  venueName,
  acceptUrl,
}: {
  vendorName: string;
  venueName:  string;
  acceptUrl:  string;
}): string {
  return [
    `${venueName} has included you as one of the vendors they make available to couples`,
    "",
    `They've added ${vendorName} to their approved vendor list on Hello to Cheers and created a starting profile for your business.`,
    "",
    "Claiming your vendor profile is free and lets you:",
    "- Take ownership of your business information",
    "- Share a richer profile with packages and FAQs",
    "- Receive messages from couples who discover you",
    "- Collaborate on events once you're selected",
    "",
    "It only takes a minute to get started.",
    "",
    `Claim My Vendor Profile: ${acceptUrl}`,
    "",
    "This invitation expires in 7 days.",
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
