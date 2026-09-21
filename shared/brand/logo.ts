/**
 * Canonical Hello to Cheers communication logo.
 *
 * One source of truth for the official horizontal mark
 * ("hello [heart] to cheers" / "WITH LUV.♥").
 * Do not recreate, substitute with text, or use the HC avatar.
 */

export const HTC_LOGO_PUBLIC_PATH = "/brand/hello-to-cheers-logo-primary-transparent.png";
export const HTC_LOGO_ALT = "Hello to Cheers";
export const HTC_EMAIL_LOGO_WIDTH_PX = 200;

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Public origin used to resolve the logo in delivered email HTML. */
export function htcBrandAssetOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
    process.env.MARKETING_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    "https://hellotocheers.com"
  ).replace(/\/$/, "");
}

export function htcLogoAbsoluteUrl(): string {
  return `${htcBrandAssetOrigin()}${HTC_LOGO_PUBLIC_PATH}`;
}

export function htcEmailLogoHtml(opts?: { href?: string; widthPx?: number }): string {
  const src = escapeAttr(htcLogoAbsoluteUrl());
  const alt = escapeAttr(HTC_LOGO_ALT);
  const width = opts?.widthPx ?? HTC_EMAIL_LOGO_WIDTH_PX;
  const img = `<img src="${src}" alt="${alt}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`;
  if (!opts?.href) return img;
  return `<a href="${escapeAttr(opts.href)}" style="text-decoration:none;border:0">${img}</a>`;
}

/** Header block for HTC-owned emails — logo only, no Jennifer sign-off. */
export function htcEmailLogoHeaderHtml(opts?: { href?: string; widthPx?: number }): string {
  return `<div style="margin:0 0 22px">${htcEmailLogoHtml(opts)}</div>`;
}
