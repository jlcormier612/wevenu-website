/**
 * Shared white-label wrapper for customer-facing transactional emails.
 * Venue Brand Experience Phase 1 — "a couple should remember the venue,
 * not the software." No Hello to Cheers attribution anywhere in the output.
 *
 * Intentional palette ceiling: email branding accepts Primary only
 * (`primaryColor`). Secondary / Accent / Neutral are not used here — HTML
 * email is a constrained medium; expanding the palette is out of scope.
 */

export type EmailVenueBrand = {
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
};

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

/**
 * Wraps a body of HTML in the standard branded email shell: venue logo/name
 * header, no software attribution in the footer — just the venue's own name.
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
        <p style="font-size:12px;color:#9ca3af;margin:0">${escapeHtml(brand.name)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
