/**
 * Side effects that run only after a tour appointment actually exists.
 *
 * Coordinator email for a successful booking is owned solely by the
 * preference-gated `tour_scheduled` venue_notifications queue (DB trigger →
 * processVenueNotificationEmails). Do not send a parallel immediate email here.
 */
import { sendEmail } from "@/lib/email/send";
import { htcEmailCtaAnchorHtml } from "@/lib/email/htc-cta";
import { createAdminClient } from "@/integrations/supabase/admin";
import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";
import type { BookingResult } from "@/lib/tours/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Paid/unbooked tour protection alert — HTC staff shell with Tours + lead CTAs.
 * Essential fields match across HTML and plain text (D4).
 */
export function buildTourProtectionAlertEmail(opts: {
  venueName: string;
  contactName: string;
  contactEmail: string;
  slotStart: string;
  leadId: string;
  appOrigin: string;
}): { subject: string; text: string; html: string } {
  const origin = opts.appOrigin.replace(/\/$/, "");
  const scheduledDate = new Date(opts.slotStart).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const subject = "Tour protection completed — time no longer available";
  const body = [
    `Payment or card-on-file succeeded for a tour at ${opts.venueName}, but that time is no longer available.`,
    "",
    `Requested time: ${scheduledDate}`,
    `Contact: ${opts.contactName} (${opts.contactEmail})`,
    "",
    "No tour appointment was created. Open Tours to resolve this.",
  ].join("\n");

  const email = buildVenueNotificationEmail({
    title: subject,
    body,
    link: "/tours",
    appOrigin: origin,
  });

  const leadHref = `${origin}/leads/${opts.leadId}`;
  const leadLabel = "View this lead";
  const secondButton = htcEmailCtaAnchorHtml(escapeHtml(leadHref), escapeHtml(leadLabel));
  const html = email.html.replace(
    /(<\/a>)(\s*<\/td>)/,
    `$1<p style="margin:12px 0 0">${secondButton}</p>$2`,
  );
  const text = `${email.text}\n\n${leadLabel}\n${leadHref}`;

  return { subject, text, html };
}

export async function runTourBookedSideEffects(result: BookingResult): Promise<void> {
  if (!result.ok || !result.appointmentId) return;
  await Promise.all([
    scheduleTourReminders(result).catch(() => {}),
    trackTourBooked(result).catch(() => {}),
  ]);
}

export async function notifyPaidUnbookedTour(opts: {
  venueEmail: string | null;
  venueName: string;
  contactName: string;
  contactEmail: string;
  slotStart: string;
  leadId: string;
}): Promise<void> {
  const coordinatorEmail = opts.venueEmail ?? process.env.COORDINATOR_NOTIFY_EMAIL;
  if (!coordinatorEmail) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const email = buildTourProtectionAlertEmail({
    venueName: opts.venueName,
    contactName: opts.contactName,
    contactEmail: opts.contactEmail,
    slotStart: opts.slotStart,
    leadId: opts.leadId,
    appOrigin: appUrl,
  });
  await sendEmail({
    to: coordinatorEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
}

async function scheduleTourReminders(result: BookingResult): Promise<void> {
  if (!result.appointmentId || !result.scheduledAt || !result.venueId) return;
  const admin = createAdminClient();
  const remindAt = new Date(new Date(result.scheduledAt).getTime() - 24 * 3600 * 1000);
  const reminders: Array<Record<string, unknown>> = [
    {
      venue_id: result.venueId,
      tour_appointment_id: result.appointmentId,
      reminder_type: "upcoming",
      notify_role: "coordinator",
      scheduled_for: remindAt.toISOString(),
      status: "pending",
    },
  ];
  if (result.contactEmail) {
    reminders.push({
      venue_id: result.venueId,
      tour_appointment_id: result.appointmentId,
      reminder_type: "upcoming",
      notify_role: "couple",
      scheduled_for: remindAt.toISOString(),
      status: "pending",
    });
  }
  await admin.from("task_reminders").insert(reminders);
}

async function trackTourBooked(result: BookingResult): Promise<void> {
  if (!result.leadId || !result.venueId) return;
  const admin = createAdminClient();
  await admin.from("lead_signal_events").insert({
    venue_id: result.venueId,
    lead_id: result.leadId,
    signal_type: "tour_booked",
    signal_strength: 3,
    metadata: { appointment_id: result.appointmentId, scheduled_at: result.scheduledAt },
  });
}
