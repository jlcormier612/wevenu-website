/**
 * Shared Hello to Cheers CTA button styling for HTC-owned transactional emails.
 * Uses Heritage Sage (platform primary) — not per-venue brand colors.
 */
import { DEFAULT_PRIMARY_COLOR } from "@/lib/venue/constants";

/** Established muted green used across HTC product + email chrome. */
export const HTC_EMAIL_CTA_BACKGROUND = DEFAULT_PRIMARY_COLOR;

/**
 * Inline-styled CTA anchor for email clients (table-safe, no external CSS).
 * `href` and `label` must already be HTML-attribute / text escaped by the caller.
 */
export function htcEmailCtaAnchorHtml(escapedHref: string, escapedLabel: string): string {
  return (
    `<a href="${escapedHref}" style="display:inline-block;background:${HTC_EMAIL_CTA_BACKGROUND};` +
    `color:#fff;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none">` +
    `${escapedLabel}</a>`
  );
}
