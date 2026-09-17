/**
 * Side effects that run only after a tour appointment actually exists.
 */
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/integrations/supabase/admin";
import { recordNotificationStatus } from "@/lib/lead-intake/attempt-log";
import type { BookingResult } from "@/lib/tours/types";

export async function runTourBookedSideEffects(result: BookingResult): Promise<void> {
  if (!result.ok || !result.appointmentId) return;
  await Promise.all([
    sendCoordinatorNotification(result).catch(() => {}),
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
  const scheduledDate = new Date(opts.slotStart).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  await sendEmail({
    to: coordinatorEmail,
    subject: `Tour protection completed — time no longer available`,
    text: [
      `Payment or card-on-file succeeded for a tour at ${opts.venueName}, but that time is no longer available.`,
      "",
      `Requested time: ${scheduledDate}`,
      `Contact: ${opts.contactName} (${opts.contactEmail})`,
      "",
      "No tour appointment was created. Open Tours to resolve this.",
      `${appUrl}/tours`,
      `${appUrl}/leads/${opts.leadId}`,
    ].join("\n"),
  });
}

async function sendCoordinatorNotification(result: BookingResult): Promise<void> {
  const coordinatorEmail = result.venueEmail ?? process.env.COORDINATOR_NOTIFY_EMAIL;
  if (!coordinatorEmail || !result.scheduledAt) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const scheduledDate = new Date(result.scheduledAt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  const emailResult = await sendEmail({
    to: coordinatorEmail,
    subject: `New tour booked — ${scheduledDate}`,
    text: [
      `A new tour has been scheduled at ${result.venueName}.`,
      "",
      `Date: ${scheduledDate}`,
      `Duration: ${result.duration ?? 60} minutes`,
      result.contactName ? `Contact: ${result.contactName}` : null,
      "",
      "A new lead has been created in Hello to Cheers.",
      `${appUrl}/leads`,
    ].filter(Boolean).join("\n"),
  });
  if (result.intakeAttemptId) {
    await recordNotificationStatus(createAdminClient(), result.intakeAttemptId, emailResult.ok ? "sent" : "failed");
  }
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
