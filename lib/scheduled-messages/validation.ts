/**
 * Scheduled Sends validation. Pure functions.
 */
import type { ScheduledMessageErrors, ScheduledMessageInput } from "@/lib/scheduled-messages/types";

export function validateScheduledMessageInput(input: ScheduledMessageInput): ScheduledMessageErrors {
  const errors: ScheduledMessageErrors = {};
  if (!input.body.trim()) errors.body = "Write a message before scheduling it.";
  if (input.channel === "email" && !input.emailSubject.trim()) errors.emailSubject = "An email needs a subject line.";
  if (!input.scheduledFor) {
    errors.scheduledFor = "Choose when to send this.";
  } else if (new Date(input.scheduledFor).getTime() <= Date.now()) {
    errors.scheduledFor = "Pick a time in the future.";
  }
  return errors;
}
