/**
 * Venue-staff notification email (new inquiry, new tour, and the other
 * preference-gated alerts). Same destination as the in-app notification.
 * Hello to Cheers owns this mail; the venue name is the subject of the alert.
 */
import { htcEmailLogoHeaderHtml } from "@/shared/brand/logo";

export type VenueNotificationEmailInput = {
  title: string;
  body: string | null;
  link: string | null;
  appOrigin: string;
};

export type VenueNotificationEmail = {
  subject: string;
  text: string;
  html: string;
  ctaLabel: string | null;
  href: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function personFirstName(title: string): string | null {
  const dash = title.split("—")[1]?.trim() || title.split(" - ")[1]?.trim();
  const from = title.match(/\bfrom\s+(.+)$/i)?.[1]?.trim();
  const name = dash || from;
  if (!name) return null;
  const first = name.split(/\s+/).filter(Boolean)[0];
  return first || null;
}

export function venueNotificationCta(title: string, link: string | null): { label: string; hrefPath: string } | null {
  const path = link?.trim() ?? "";
  if (!path.startsWith("/")) return null;
  if (path.startsWith("/leads/")) {
    const first = personFirstName(title);
    return { label: first ? `View ${first}'s lead` : "View this lead", hrefPath: path };
  }
  if (path === "/tours" || path.startsWith("/tours/") || path.startsWith("/tours?")) {
    return { label: "View tours", hrefPath: path };
  }
  return { label: "Open in Hello to Cheers", hrefPath: path };
}

export function buildVenueNotificationEmail(input: VenueNotificationEmailInput): VenueNotificationEmail {
  const origin = input.appOrigin.replace(/\/$/, "");
  const cta = venueNotificationCta(input.title, input.link);
  const href = cta ? `${origin}${cta.hrefPath}` : null;
  const detail = input.body?.trim() ?? "";
  const textParts = [input.title];
  if (detail) textParts.push("", detail);
  if (cta && href) textParts.push("", cta.label, href);
  const text = textParts.join("\n");

  const detailHtml = detail
    ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">${escapeHtml(detail)}</p>`
    : "";
  const buttonHtml = cta && href
    ? `<a href="${escapeHtml(href)}" style="display:inline-block;background:#1a1a1a;color:#fff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none">${escapeHtml(cta.label)}</a>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb">
        ${htcEmailLogoHeaderHtml()}
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;line-height:1.3">${escapeHtml(input.title)}</h1>
        ${detailHtml}
        ${buttonHtml}
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: input.title,
    text,
    html,
    ctaLabel: cta?.label ?? null,
    href,
  };
}
