/**
 * Conversations / Scheduled Sends HTML branding — wraps already-resolved
 * message body text in the shared venue-brand email shell. Merge resolution
 * must happen before this is called (never re-introduce {{tokens}}).
 */
import { escapeHtml, renderBrandedEmailHtml, type EmailVenueBrand } from "@/lib/email/venue-brand";

/** Convert plain text (newlines) into simple HTML paragraphs for the branded shell. */
export function plainTextToEmailHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.5">${withBreaks}</p>`;
    });
  return paragraphs.join("") || `<p style="margin:0;font-size:15px;color:#374151"></p>`;
}

export function wrapConversationMessageHtml(brand: EmailVenueBrand, resolvedBody: string): string {
  return renderBrandedEmailHtml(brand, plainTextToEmailHtml(resolvedBody));
}
