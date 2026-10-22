/**
 * Shared white-label wrapper for customer-facing transactional emails.
 * Venue Brand Experience — "a couple should remember the venue, not the software."
 *
 * Intentional palette ceiling: email branding accepts Primary only
 * (`primaryColor`). Secondary / Accent / Neutral are not used here — HTML
 * email is a constrained medium.
 */

import { formatPhoneDisplay } from "@/lib/sms/phone";

/** Columns needed to build EmailVenueBrand from a venues row (or embed). */
export const VENUE_EMAIL_BRAND_SELECT =
  "name, logo_url, primary_color, email_signature, email, phone, email_footer_show_signature, email_footer_show_email, email_footer_show_phone";

export type EmailVenueBrand = {
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  /** Plain-text signature/footer; rendered under the message body when set. */
  emailSignature?: string | null;
  /** Optional contact line shown with the signature (venue email / phone). */
  replyContact?: string | null;
};

export type EmailFooterContactPrefs = {
  showSignature: boolean;
  showEmail: boolean;
  showPhone: boolean;
};

export type VenueBrandSource = {
  name?: string | null;
  logoUrl?: string | null;
  logo_url?: string | null;
  primaryColor?: string | null;
  primary_color?: string | null;
  emailSignature?: string | null;
  email_signature?: string | null;
  email?: string | null;
  phone?: string | null;
  emailFooterShowSignature?: boolean | null;
  email_footer_show_signature?: boolean | null;
  emailFooterShowEmail?: boolean | null;
  email_footer_show_email?: boolean | null;
  emailFooterShowPhone?: boolean | null;
  email_footer_show_phone?: boolean | null;
} | null | undefined;

/**
 * Resolve venue-level footer visibility.
 * Defaults: signature on, email on, phone off (opt-in).
 * Missing columns (partial selects) use the same defaults.
 */
export function resolveEmailFooterContactPrefs(
  venue: VenueBrandSource,
): EmailFooterContactPrefs {
  return {
    showSignature: venue?.emailFooterShowSignature ?? venue?.email_footer_show_signature ?? true,
    showEmail: venue?.emailFooterShowEmail ?? venue?.email_footer_show_email ?? true,
    showPhone: venue?.emailFooterShowPhone ?? venue?.email_footer_show_phone ?? false,
  };
}

/** Build the contact line from venue fields + display prefs. Omits empty pieces. */
export function buildEmailFooterReplyContact(
  venue: VenueBrandSource,
  prefs: EmailFooterContactPrefs = resolveEmailFooterContactPrefs(venue),
): string | null {
  const parts: string[] = [];
  if (prefs.showEmail) {
    const email = venue?.email?.trim();
    if (email) parts.push(email);
  }
  if (prefs.showPhone) {
    const raw = venue?.phone?.trim();
    if (raw) {
      const display = formatPhoneDisplay(raw);
      if (display) parts.push(display);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Build brand from a venue row / domain object for outbound email. */
export function emailBrandFromVenue(venue: VenueBrandSource): EmailVenueBrand {
  const prefs = resolveEmailFooterContactPrefs(venue);
  const rawSignature = venue?.emailSignature ?? venue?.email_signature ?? null;
  const emailSignature =
    prefs.showSignature && rawSignature?.trim() ? rawSignature : null;
  return {
    name: venue?.name ?? "Your venue",
    logoUrl: venue?.logoUrl ?? venue?.logo_url ?? null,
    primaryColor: venue?.primaryColor ?? venue?.primary_color ?? "#5D6F5D",
    emailSignature,
    replyContact: buildEmailFooterReplyContact(venue, prefs),
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A primary-color CTA button, matching the venue's brand. */
export function brandButtonHtml(brand: EmailVenueBrand, href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="background:${brand.primaryColor};color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">${escapeHtml(label)}</a>`;
}

function signatureBlockHtml(brand: EmailVenueBrand): string {
  const sig = brand.emailSignature?.trim();
  const contact = brand.replyContact?.trim();
  // When the venue hides signature and contact, leave a clean footer — do not
  // invent a grey venue-name row (header already shows the venue).
  if (!sig && !contact) return "";
  const parts: string[] = [];
  if (sig) {
    parts.push(
      `<p style="font-size:13px;color:#6b7280;margin:0;white-space:pre-line;line-height:1.45">${escapeHtml(sig)}</p>`,
    );
  }
  if (contact) {
    parts.push(
      `<p style="font-size:12px;color:#9ca3af;margin:${sig ? "8px" : "0"} 0 0">${escapeHtml(contact)}</p>`,
    );
  }
  return parts.join("");
}

/** Append signature to plain-text email bodies. */
export function appendEmailSignatureText(
  body: string,
  brand: Pick<EmailVenueBrand, "name" | "emailSignature" | "replyContact">,
): string {
  const sig = brand.emailSignature?.trim();
  const contact = brand.replyContact?.trim();
  if (!sig && !contact) return body;
  const footer = [sig, contact].filter(Boolean).join("\n");
  return `${body.trimEnd()}\n\n—\n${footer}`;
}

/**
 * Wraps a body of HTML in the standard branded email shell: venue logo/name
 * header, optional venue signature/footer, no software attribution.
 */
export function renderBrandedEmailHtml(brand: EmailVenueBrand, bodyHtml: string): string {
  const headerHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" style="height:36px;width:36px;border-radius:999px;object-fit:cover;margin-bottom:10px;">`
    : "";
  const footer = signatureBlockHtml(brand);
  const footerRow = footer
    ? `<tr>
      <td style="padding-top:12px;text-align:center">
        ${footer}
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:28px 32px;border:1px solid #e5e7eb;border-top:4px solid ${brand.primaryColor}">
        ${headerHtml}
        <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#6b7280">${escapeHtml(brand.name)}</p>
        ${bodyHtml}
      </td>
    </tr>
    ${footerRow}
  </table>
</body>
</html>`;
}

/** Lightweight HTML preview for Settings (same shell clients receive). */
export function renderEmailBrandPreviewHtml(
  brand: EmailVenueBrand,
  sampleBody = "Hi — this is a sample message from your venue.",
): string {
  const bodyHtml = `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.5">${escapeHtml(sampleBody)}</p>`;
  return renderBrandedEmailHtml(brand, bodyHtml);
}
