/**
 * Email when a venue removes a vendor from an event assignment.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildVendorRemovedHtml({
  vendorName,
  venueName,
  eventLabel,
}: {
  vendorName: string;
  venueName: string;
  eventLabel: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280">
          Update from ${escapeHtml(venueName)}
        </p>
        <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#111827;line-height:1.3">
          You've been removed from ${escapeHtml(eventLabel)}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">
          ${escapeHtml(venueName)} has removed ${escapeHtml(vendorName)} from ${escapeHtml(eventLabel)}.
          This event will no longer appear in your vendor workspace.
        </p>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.5">
          If this was unexpected, message the venue from another shared event or contact them directly.
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

export function buildVendorRemovedText({
  vendorName,
  venueName,
  eventLabel,
}: {
  vendorName: string;
  venueName: string;
  eventLabel: string;
}): string {
  return [
    `Update from ${venueName}`,
    "",
    `You've been removed from ${eventLabel}.`,
    "",
    `${venueName} has removed ${vendorName} from this event. It will no longer appear in your vendor workspace.`,
    "",
    "If this was unexpected, contact the venue directly.",
  ].join("\n");
}
