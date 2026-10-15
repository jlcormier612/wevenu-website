/**
 * Tour reminder emails.
 *
 * Couple-facing: shared venue-branded shell (logo when venues.logo_url exists,
 * venue name, primary-color top border, signature/reply contact).
 *
 * Coordinator/staff: shared Hello to Cheers staff notification shell + Sage CTA
 * via buildVenueNotificationEmail (same path as inquiry / tour-scheduled alerts).
 */
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import {
  appendEmailSignatureText,
  type EmailVenueBrand,
} from "@/lib/email/venue-brand";
import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";

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

export function buildTourReminderCoordinatorEmail(input: {
  contactName: string | null;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  venueName: string;
  /** Existing lead deep-link when the tour is attached to a lead; otherwise /tours. */
  leadId: string | null;
  appOrigin: string;
}): { subject: string; text: string; html: string } {
  const contact = input.contactName?.trim() || "Upcoming tour";
  const withWhom = input.contactName?.trim() || "a prospective client";
  const subject = `Tour reminder: ${contact} — ${input.dateLabel} at ${input.timeLabel}`;
  const detail = [
    `You have a venue tour tomorrow at ${input.timeLabel} with ${withWhom}.`,
    `Duration: ${input.durationMinutes} minutes.`,
    input.venueName,
  ].join("\n");
  const link = input.leadId ? `/leads/${input.leadId}` : "/tours";
  const email = buildVenueNotificationEmail({
    title: subject,
    body: detail,
    link,
    appOrigin: input.appOrigin,
  });
  return { subject: email.subject, text: email.text, html: email.html };
}
