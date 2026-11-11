/**
 * Public intake confirmation + venue-notify email bodies.
 *
 * Prospect thank-you uses the venue-branded client shell.
 * Venue alerts use buildVenueNotificationEmail (HTC staff shell) at the call site.
 */
import { eventTypeLabel } from "@/lib/event-types/canonical";
import {
  appendEmailSignatureText,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type VenueBrandSource,
} from "@/lib/email/venue-brand";

export type PublicIntakeThankYouKind = "inquiry" | "submission";

export type PublicIntakeVenueDetailInput = {
  /** Opening sentence (no trailing blank line required). */
  intro: string;
  inquirerName: string;
  inquirerEmail: string;
  phone?: string | null;
  partnerLine?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  guestCount?: string | number | null;
  estimatedBudget?: string | number | null;
  inquiryMessage?: string | null;
};

/** Presentation-only event type line; does not change stored values. */
export function formatPublicIntakeEventTypeLine(
  eventType: string | null | undefined,
): string | null {
  if (eventType == null || !String(eventType).trim()) return null;
  const label = eventTypeLabel(String(eventType));
  if (!label) return null;
  return `Event type: ${label}`;
}

/**
 * Plain-text detail body for venue staff notifications from public intake.
 * Omits missing optional fields; never invents placeholders.
 */
export function buildPublicIntakeVenueDetailBody(
  input: PublicIntakeVenueDetailInput,
): string {
  const guest =
    input.guestCount != null && String(input.guestCount).trim() !== ""
      ? String(input.guestCount)
      : null;
  const budgetRaw = input.estimatedBudget;
  const budget =
    budgetRaw != null && budgetRaw !== "" && Number.isFinite(Number(budgetRaw))
      ? `Budget: $${Number(budgetRaw).toLocaleString()}`
      : null;
  const message = input.inquiryMessage?.trim()
    ? `\nMessage:\n${input.inquiryMessage.trim()}`
    : null;

  return [
    input.intro,
    "",
    `Name: ${input.inquirerName}`,
    `Email: ${input.inquirerEmail}`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.partnerLine?.trim() || null,
    formatPublicIntakeEventTypeLine(input.eventType),
    input.eventDate ? `Preferred event date: ${input.eventDate}` : null,
    guest ? `Guests: ${guest}` : null,
    budget,
    message,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPublicIntakeThankYouEmail(opts: {
  kind: PublicIntakeThankYouKind;
  venueName: string;
  firstName?: string | null;
  /** Venue brand fields (name/logo/color). Defaults to venueName only. */
  brandSource?: VenueBrandSource | null;
}): { subject: string; text: string; html: string } {
  const venueName = opts.venueName.trim() || "the venue";
  const first = opts.firstName?.trim() || "";
  const greeting = first ? `Thank you, ${first}!` : "Thank you!";
  const receivedLine =
    opts.kind === "inquiry"
      ? `We've received your inquiry for ${venueName}.`
      : `We've received your submission for ${venueName}.`;
  const subject =
    opts.kind === "inquiry"
      ? `We received your inquiry — ${venueName}`
      : `We received your message — ${venueName}`;

  const textCore = [greeting, "", receivedLine, "", "We'll be in touch soon."].join("\n");
  const brand = emailBrandFromVenue(opts.brandSource ?? { name: venueName });
  const text = appendEmailSignatureText(textCore, brand);

  const inner = [
    `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.5">${escapeHtml(greeting)}</p>`,
    `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.5">${escapeHtml(receivedLine)}</p>`,
    `<p style="margin:0;font-size:15px;color:#374151;line-height:1.5">We'll be in touch soon.</p>`,
  ].join("");

  return {
    subject,
    text,
    html: renderBrandedEmailHtml(brand, inner),
  };
}
