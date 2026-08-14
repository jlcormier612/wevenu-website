import type { EmailTemplateVars } from "../types";
import { greetingFirstName } from "../../relationships/normalize";

/** Shared helpers for rendering Hello to Cheers product emails. */

export function str(vars: EmailTemplateVars, key: string, fallback = ""): string {
  const value = vars[key];
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function firstName(vars: EmailTemplateVars): string {
  return greetingFirstName({
    firstName: str(vars, "firstName") || str(vars, "ownerFirstName") || null,
    fullName: str(vars, "fullName") || str(vars, "ownerFullName") || null,
    email: str(vars, "email") || str(vars, "ownerEmail") || null,
    fallback: "there",
  });
}

export function venueName(vars: EmailTemplateVars): string {
  return str(vars, "venueName") || "your venue";
}

export function planName(vars: EmailTemplateVars): string {
  return str(vars, "planName") || "your plan";
}

export function marketingUrl(path = ""): string {
  const base =
    process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
    process.env.MARKETING_URL?.trim() ||
    "https://hellotocheers.com";
  const normalized = base.replace(/\/$/, "");
  if (!path) return normalized;
  return `${normalized}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Base URL for `/activate/{token}` links (matches lifecycle send paths). */
export function activationBaseUrl(): string {
  return (
    process.env.WORKSPACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WORKSPACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3002"
  ).replace(/\/$/, "");
}

/** Magic-link style activation URL — no plaintext password. */
export function activationUrlFromToken(token: string): string {
  const clean = token.trim();
  return `${activationBaseUrl()}/activate/${encodeURIComponent(clean)}`;
}

export function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2937">${escapeHtml(p)}</p>`,
    )
    .join("\n");
}

/** Primary CTA button for HTML emails (plain URL still included in text part). */
export function ctaButtonHtml(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<p style="margin:8px 0 24px">
  <a href="${safeHref}" style="display:inline-block;background:#2f3d2f;color:#fffdf9;text-decoration:none;padding:12px 22px;border-radius:4px;font-size:16px;font-family:Georgia,'Times New Roman',serif">${safeLabel}</a>
</p>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#6b7a6b">Or open this link: <a href="${safeHref}" style="color:#2f3d2f">${safeHref}</a></p>`;
}

export function wrapHelloHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,'Times New Roman',serif;background:#f7f4ef;margin:0;padding:32px 16px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr>
      <td style="background:#fffdf9;border-radius:4px;padding:40px 36px;border:1px solid #e5ddd0">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#6b7a6b">Hello to Cheers</p>
        <h1 style="margin:0 0 24px;font-size:24px;line-height:1.3;color:#2f3d2f;font-weight:normal">${escapeHtml(title)}</h1>
        ${bodyHtml}
        <p style="margin:28px 0 0;font-size:14px;line-height:1.5;color:#6b7a6b">With care,<br/>Jennifer &amp; the Hello to Cheers team</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function previewFromText(text: string, max = 180): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
