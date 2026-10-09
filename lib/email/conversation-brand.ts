/**
 * Conversations / Scheduled Sends HTML branding — wraps already-resolved
 * message body text in the shared venue-brand email shell. Merge resolution
 * must happen before this is called (never re-introduce {{tokens}}).
 *
 * Plain-text bodies are escaped, then http(s) URLs become real <a href>
 * anchors so proposal / offer links are clickable in HTML email clients.
 */
import { escapeHtml, renderBrandedEmailHtml, type EmailVenueBrand } from "@/lib/email/venue-brand";

/** http/https URLs; trailing sentence punctuation is stripped from the href. */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;

function trimTrailingPunctuation(url: string): { href: string; trailing: string } {
  let end = url.length;
  while (end > 0 && /[.,;:!?)]$/.test(url.charAt(end - 1))) {
    end -= 1;
  }
  return { href: url.slice(0, end), trailing: url.slice(end) };
}

/** Couple-facing proposal / offer accept URLs — CTA label, href unchanged. */
export function isProposalOfferUrl(href: string): boolean {
  try {
    const path = new URL(href).pathname;
    return /^\/offer\/[A-Za-z0-9_-]+\/?$/.test(path);
  } catch {
    return false;
  }
}

export const QUESTIONNAIRE_CTA_LABEL = "Complete Your Questionnaire";

/** Public questionnaire form URLs — same access key, CTA label instead of the raw token. */
export function isQuestionnaireFormUrl(href: string): boolean {
  try {
    const path = new URL(href).pathname;
    return /^\/questionnaire\/[A-Za-z0-9_-]+\/?$/.test(path);
  } catch {
    return false;
  }
}

function emailCtaHtml(
  safeHref: string,
  label: string,
  btnColor: string,
  options?: { showRawUrl?: boolean },
): string {
  const button =
    `<a href="${safeHref}" style="background:${btnColor};color:#fff;padding:12px 20px;border-radius:8px;` +
    `text-decoration:none;display:inline-block;font-weight:600;font-size:16px;line-height:1.25;margin:4px 0;">` +
    `${escapeHtml(label)}</a>`;
  if (options?.showRawUrl === false) return button;
  return (
    `${button}` +
    `<br><span style="font-size:12px;color:#6b7280;word-break:break-all">${safeHref}</span>`
  );
}

/**
 * Escape plain text and wrap http(s) URLs in safe <a href> anchors.
 * Proposal offer URLs use a "View your proposal" CTA; the exact URL stays
 * visible underneath for clients that prefer the raw link.
 */
export function linkifyPlainTextForEmailHtml(
  text: string,
  primaryColor = "#5D6F5D",
): string {
  if (!text) return "";
  const re = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let out = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[0]!;
    const start = match.index;
    if (start > lastIndex) {
      out += escapeHtml(text.slice(lastIndex, start));
    }
    const { href, trailing } = trimTrailingPunctuation(raw);
    if (/^https?:\/\//i.test(href)) {
      const safeHref = escapeHtml(href);
      const btnColor = escapeHtml(primaryColor);
      if (isProposalOfferUrl(href)) {
        out += emailCtaHtml(safeHref, "View your proposal", btnColor);
      } else if (isQuestionnaireFormUrl(href)) {
        // Button is the only visible questionnaire CTA in HTML; plain-text
        // email bodies still carry the raw URL for clients without HTML.
        out += emailCtaHtml(safeHref, QUESTIONNAIRE_CTA_LABEL, btnColor, {
          showRawUrl: false,
        });
      } else {
        out +=
          `<a href="${safeHref}" style="color:${btnColor};text-decoration:underline;word-break:break-all">` +
          `${safeHref}</a>`;
      }
      if (trailing) out += escapeHtml(trailing);
    } else {
      out += escapeHtml(raw);
    }
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) {
    out += escapeHtml(text.slice(lastIndex));
  }
  return out;
}

/** Convert plain text (newlines) into simple HTML paragraphs for the branded shell. */
export function plainTextToEmailHtml(text: string, primaryColor = "#5D6F5D"): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = linkifyPlainTextForEmailHtml(block, primaryColor).replace(/\n/g, "<br>");
      return `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.5">${withBreaks}</p>`;
    });
  return paragraphs.join("") || `<p style="margin:0;font-size:15px;color:#374151"></p>`;
}

export function wrapConversationMessageHtml(brand: EmailVenueBrand, resolvedBody: string): string {
  return renderBrandedEmailHtml(brand, plainTextToEmailHtml(resolvedBody, brand.primaryColor));
}
