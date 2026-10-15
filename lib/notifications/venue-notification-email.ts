/**
 * Venue-staff notification email (new inquiry, new tour, and the other
 * preference-gated alerts). Same destination as the in-app notification.
 * Hello to Cheers owns this mail; the venue name is the subject of the alert.
 */
import { htcEmailCtaAnchorHtml } from "@/lib/email/htc-cta";
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

const DATE_SUBJECT_TOKEN =
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2})$/i;

function personFirstName(title: string): string | null {
  const dash = title.split("—")[1]?.trim() || title.split(" - ")[1]?.trim();
  const from = title.match(/\bfrom\s+(.+)$/i)?.[1]?.trim();
  const name = dash || from;
  if (!name) return null;
  const first = name.split(/\s+/).filter(Boolean)[0]?.replace(/[^\p{L}\p{N}]+$/u, "") ?? "";
  if (!first || DATE_SUBJECT_TOKEN.test(first)) return null;
  return first;
}

export function venueNotificationCta(title: string, link: string | null): { label: string; hrefPath: string } | null {
  const path = link?.trim() ?? "";
  if (!path.startsWith("/")) return null;
  if (path.startsWith("/leads/")) {
    const first = personFirstName(title);
    // message_received deep links use #messages — label the conversation, not a generic lead page.
    if (path.includes("#messages")) {
      return { label: first ? `View ${first}'s messages` : "View messages", hrefPath: path };
    }
    return { label: first ? `View ${first}'s lead` : "View this lead", hrefPath: path };
  }
  if (path === "/tours" || path.startsWith("/tours/") || path.startsWith("/tours?")) {
    return { label: "View tours", hrefPath: path };
  }
  if (path.startsWith("/contracts/")) {
    return { label: "View contract", hrefPath: path };
  }
  if (path === "/payments" || path.startsWith("/payments/") || path.startsWith("/invoices/")) {
    return { label: "View payments", hrefPath: path };
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
    ? htcEmailCtaAnchorHtml(escapeHtml(href), escapeHtml(cta.label))
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
