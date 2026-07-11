/**
 * Scheduled Sends domain types — Communication Platform Phase 2.
 * See docs/communication-platform-next-phase.md §3.5.
 */

export type ScheduledMessageChannel = "email" | "sms";
export type ScheduledMessageStatus = "scheduled" | "sent" | "failed" | "cancelled";

export type ScheduledMessage = {
  id: string;
  venueId: string;
  relationshipId: string;
  templateId: string | null;
  channel: ScheduledMessageChannel;
  emailSubject: string | null;
  body: string;
  scheduledFor: string; // ISO timestamp
  status: ScheduledMessageStatus;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  sequenceEnrollmentId: string | null; // set when this row was materialized by an Automated Series (Phase 3)
};

export type ScheduledMessageInput = {
  relationshipId: string;
  templateId: string | null;
  channel: ScheduledMessageChannel;
  emailSubject: string;
  body: string;
  scheduledFor: string; // ISO timestamp
};

export type ScheduledMessageErrors = Record<string, string>;

export type ScheduleMessageResult =
  | { ok: true; scheduledMessageId: string }
  | { ok: false; errors?: ScheduledMessageErrors; message?: string };

export type ScheduledMessageActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type ProcessScheduledResult = {
  processed: number;
  sent: number;
  failed: number;
};
