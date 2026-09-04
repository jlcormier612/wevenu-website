/**
 * Shared white-label wrapper for customer-facing transactional emails.
 * Venue Brand Experience — "a couple should remember the venue, not the software."
 *
 * Intentional palette ceiling: email branding accepts Primary only
 * (`primaryColor`). Secondary / Accent / Neutral are not used here — HTML
 * email is a constrained medium.
 */

export type EmailVenueBrand = {
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  /** Plain-text signature/footer; rendered under the message body when set. */
  emailSignature?: string | null;
  /** Optional contact line shown with the signature (venue email / phone). */
  replyContact?: string | null;
};

/** Build brand from a venue row / domain object for outbound email. */
export function emailBrandFromVenue(venue: {
  name?: string | null;
  logoUrl?: string | null;
  logo_url?: string | null;
  primaryColor?: string | null;
  primary_color?: string | null;
  emailSignature?: string | null;
  email_signature?: string | null;
  email?: string | null;
  phone?: string | null;
} | null | undefined): EmailVenueBrand {
  const contact = [venue?.email, venue?.phone].filter(Boolean).join(" · ");
  return {
    name: venue?.name ?? "Your venue",
    logoUrl: venue?.logoUrl ?? venue?.logo_url ?? null,
    primaryColor: venue?.primaryColor ?? venue?.primary_color ?? "#5D6F5D",
    emailSignature: venue?.emailSignature ?? venue?.email_signature ?? null,
    replyContact: contact || null,
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
  if (!sig && !contact) {
    return `<p style="font-size:12px;color:#9ca3af;margin:0">${escapeHtml(brand.name)}</p>`;
  }
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

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fff;border-radius:12px;padding:40px;border:1px solid #e5e7eb;border-top:4px solid ${brand.primaryColor}">
        ${headerHtml}
        <p style="margin:0 0 20px;font-size:13px;font-weight:600;color:#6b7280">${escapeHtml(brand.name)}</p>
        ${bodyHtml}
      </td>
    </tr>
    <tr>
      <td style="padding-top:20px;text-align:center">
        ${signatureBlockHtml(brand)}
      </td>
    </tr>
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
