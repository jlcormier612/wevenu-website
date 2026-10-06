/**
 * Couple-facing tour reminder email — uses the shared venue-branded shell
 * (logo when venues.logo_url exists, venue name, primary-color top border,
 * signature/reply contact). Coordinator tour alerts stay on the engine's
 * internal path.
 */
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import {
  appendEmailSignatureText,
  type EmailVenueBrand,
} from "@/lib/email/venue-brand";

export function buildTourReminderCoupleEmail(input: {
  brand: EmailVenueBrand;
  dateLabel: string;
  timeLabel: string;
}): { subject: string; text: string; html: string } {
  const venueName = input.brand.name;
  const subject = `Your tour at ${venueName} is tomorrow — ${input.dateLabel} at ${input.timeLabel}`;
  const body =
    `Just a reminder that your tour at ${venueName} is tomorrow at ${input.timeLabel}. We look forward to meeting you!`;
  return {
    subject,
    text: appendEmailSignatureText(body, input.brand),
    html: wrapConversationMessageHtml(input.brand, body),
  };
}
