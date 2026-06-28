export type NotificationChannel = "email" | "sms" | "in_app" | "push";
export type NotificationSourceType = "task_reminder" | "task_overdue" | "task_complete" | "message" | "invoice" | "system";
export type NotificationStatus = "sent" | "delivered" | "failed" | "bounced";
export type NotificationRole = "coordinator" | "couple" | "vendor" | "team";

export type NotificationLogEntry = {
  id: string;
  venueId: string;
  sourceType: NotificationSourceType;
  sourceId: string | null;
  recipientRole: NotificationRole;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string | null;
  bodyPreview: string | null;
  providerMessageId: string | null;
  sentAt: string;
  deliveredAt: string | null;
  errorMessage: string | null;
};

export type ProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

/** Determines the delivery channel for a given role and notification type.
 *  Sprint 44: always email. Future: reads per-role preferences from DB.
 *  Channel-agnostic routing lives here — change routing without touching callers.
 */
export function determineChannel(
  role: NotificationRole,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sourceType: NotificationSourceType,
): NotificationChannel {
  // Sprint 44 implementation: all channels are email.
  // Future:
  //   coordinator → in_app for low-priority, email for high-priority
  //   couple → email; sms for day-of and urgent overdue
  //   vendor → email; sms when SMS built
  //   team → in_app
  void role;
  return "email";
}
