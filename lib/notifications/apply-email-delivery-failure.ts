/**
 * Shared apply helpers for notification email delivery failures.
 * Keeps task_reminders + venue_notifications engines consistent.
 */

import {
  deliveryFailureFromUnknown,
  reminderFailureUpdate,
  resolveDeliveryDisposition,
  venueNotificationFailureUpdate,
  type DeliveryDisposition,
} from "@/lib/notifications/email-delivery-retry";

type ServiceClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export function dispositionFromSendError(
  err: unknown,
  attemptCountBefore: number,
  opts?: { jitterRatio?: number; nowMs?: number },
): DeliveryDisposition {
  const failure = deliveryFailureFromUnknown(err);
  return resolveDeliveryDisposition({
    code: failure.code,
    message: failure.message,
    attemptCountBefore,
    retryAfterSeconds: failure.retryAfterSeconds,
    jitterRatio: opts?.jitterRatio,
    nowMs: opts?.nowMs,
  });
}

export async function applyReminderDeliveryFailure(
  supabase: ServiceClient,
  opts: {
    reminderId: string;
    venueId: string;
    notifyRole: string;
    channel: string;
    attemptCountBefore: number;
    err: unknown;
    recipientEmail?: string | null;
    jitterRatio?: number;
  },
): Promise<DeliveryDisposition> {
  const disposition = dispositionFromSendError(opts.err, opts.attemptCountBefore, {
    jitterRatio: opts.jitterRatio,
  });

  await supabase
    .from("task_reminders")
    .update(reminderFailureUpdate(disposition))
    .eq("id", opts.reminderId);

  await supabase.from("notification_log").insert({
    venue_id: opts.venueId,
    source_type: "task_reminder",
    source_id: opts.reminderId,
    recipient_role: opts.notifyRole,
    recipient_email: opts.recipientEmail ?? null,
    channel: opts.channel,
    status: "failed",
    error_message: disposition.message.slice(0, 500),
    sent_at: new Date().toISOString(),
  });

  return disposition;
}

export async function applyVenueNotificationDeliveryFailure(
  supabase: ServiceClient,
  opts: {
    notificationId: string;
    venueId: string;
    attemptCountBefore: number;
    err: unknown;
    recipientEmail?: string | null;
    recipientRole?: string;
    subject?: string | null;
    jitterRatio?: number;
  },
): Promise<DeliveryDisposition> {
  const disposition = dispositionFromSendError(opts.err, opts.attemptCountBefore, {
    jitterRatio: opts.jitterRatio,
  });

  await supabase
    .from("venue_notifications")
    .update(venueNotificationFailureUpdate(disposition))
    .eq("id", opts.notificationId);

  await supabase.from("notification_log").insert({
    venue_id: opts.venueId,
    source_type: "system",
    source_id: opts.notificationId,
    recipient_role: opts.recipientRole ?? "coordinator",
    recipient_email: opts.recipientEmail ?? null,
    channel: "email",
    status: "failed",
    subject: opts.subject ?? null,
    error_message: disposition.message.slice(0, 500),
    sent_at: new Date().toISOString(),
  });

  return disposition;
}
