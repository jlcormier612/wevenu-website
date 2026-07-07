/**
 * Daily digest email template.
 */

export type DigestItem = {
  label: string;
  detail: string | null;
  href: string;
};

export type DigestContext = {
  venueName: string;
  todayFormatted: string;
  subjectLine: string;
  urgentItems: DigestItem[];
  dueTodayItems: DigestItem[];
  recentWins: DigestItem[];
  luvObservation: { message: string; link: string } | null;
  appUrl: string;
  unsubscribeUrl: string;
};

export function buildDigestSubject(ctx: DigestContext): string {
  return ctx.subjectLine;
}

export function buildDigestHtml(ctx: DigestContext): string {
  const settingsUrl = `${ctx.appUrl}${ctx.unsubscribeUrl}`;

  const itemHtml = (items: DigestItem[], label: string, color: string) => {
    if (!items.length) return "";
    return `
      <tr><td style="padding:20px 0 8px">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${color}">${label}</p>
      </td></tr>
      ${items.map(i => `
      <tr><td style="padding:4px 0">
        <a href="${escapeHtml(i.href)}" style="display:block;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;background:#f9fafb">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827">${escapeHtml(i.label)}</p>
          ${i.detail ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280">${escapeHtml(i.detail)}</p>` : ""}
        </a>
      </td></tr>`).join("")}`;
  };

  const winsHtml = ctx.recentWins.length > 0 ? `
    <tr><td style="padding:20px 0 8px">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#059669">Recent Wins</p>
    </td></tr>
    ${ctx.recentWins.map(i => `
    <tr><td style="padding:4px 0">
      <p style="margin:0;padding:8px 0;font-size:14px;color:#374151">✓ <a href="${escapeHtml(i.href)}" style="color:#374151;text-decoration:none">${escapeHtml(i.label)}</a></p>
    </td></tr>`).join("")}` : "";

  const luvHtml = ctx.luvObservation ? `
    <tr><td style="padding:20px 0 0">
      <div style="background:#fdf2f8;border:1px solid #f9a8d4;border-radius:8px;padding:12px 16px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#be185d">Luv noticed</p>
        <p style="margin:0;font-size:13px;color:#374151">${escapeHtml(ctx.luvObservation.message)} <a href="${escapeHtml(ctx.luvObservation.link)}" style="color:#be185d;font-weight:600">View →</a></p>
      </div>
    </td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af">${escapeHtml(ctx.todayFormatted)}</p>
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827">${escapeHtml(ctx.venueName)}</h1>
        <p style="margin:0 0 4px;font-size:15px;color:#374151">${escapeHtml(ctx.subjectLine)}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemHtml(ctx.urgentItems, "Needs Attention", "#dc2626")}
          ${itemHtml(ctx.dueTodayItems, "Due Today", "#d97706")}
          ${winsHtml}
          ${luvHtml}
        </table>
        <p style="margin:32px 0 0;font-size:12px;color:#9ca3af;line-height:1.6">
          You're getting this because daily digests are on by default.<br>
          <a href="${settingsUrl}" style="color:#9ca3af">Turn them off in Notification Preferences →</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding-top:20px;text-align:center">
        <p style="font-size:12px;color:#9ca3af;margin:0">Powered by Wevenu</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildDigestText(ctx: DigestContext): string {
  const lines: string[] = [
    ctx.todayFormatted,
    ctx.venueName,
    ctx.subjectLine,
    "",
  ];

  if (ctx.urgentItems.length > 0) {
    lines.push("NEEDS ATTENTION");
    ctx.urgentItems.forEach(i => lines.push(`• ${i.label}${i.detail ? ` — ${i.detail}` : ""}`));
    lines.push("");
  }

  if (ctx.dueTodayItems.length > 0) {
    lines.push("DUE TODAY");
    ctx.dueTodayItems.forEach(i => lines.push(`• ${i.label}${i.detail ? ` — ${i.detail}` : ""}`));
    lines.push("");
  }

  if (ctx.recentWins.length > 0) {
    lines.push("RECENT WINS");
    ctx.recentWins.forEach(i => lines.push(`✓ ${i.label}`));
    lines.push("");
  }

  if (ctx.luvObservation) {
    lines.push(`Luv noticed: ${ctx.luvObservation.message}`);
    lines.push("");
  }

  lines.push(`You're getting this because daily digests are on by default.`);
  lines.push(`Turn them off: ${ctx.appUrl}${ctx.unsubscribeUrl}`);

  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
