/**
 * Date-based task/payment/contract reminder clock.
 * Tour reminders, Automations, and Scheduled Sends are not this module.
 */
import { addCalendarDays } from "@/lib/message-sequences/schedule-times";
import { utcToVenueLocalParts, venueLocalToUtcIso } from "@/lib/venue/timezone";

/** Venue-local wall clock for date-based Automatic Reminders. */
export const TASK_REMINDER_SEND_TIME = "10:00";

const DISPLAY_ZONE = "America/New_York";

function zone(timezone: string | null | undefined): string {
  return timezone?.trim() || DISPLAY_ZONE;
}

/** Due calendar date + signed day offset at 10:00 venue-local, stored as UTC. */
export function scheduledReminderAt(
  dueDate: string,
  offsetDays: number,
  timezone: string | null,
): string {
  return venueLocalToUtcIso(addCalendarDays(dueDate, offsetDays), TASK_REMINDER_SEND_TIME, timezone);
}

/**
 * Next overdue chase: venue-local date of the row just sent's scheduled_for,
 * plus interval calendar days, at 10:00 venue-local.
 */
export function nextRecurringReminderAt(
  previousScheduledForIso: string,
  intervalDays: number,
  timezone: string | null,
): string {
  const { date } = utcToVenueLocalParts(previousScheduledForIso, timezone);
  return venueLocalToUtcIso(addCalendarDays(date, intervalDays), TASK_REMINDER_SEND_TIME, timezone);
}

export function formatNextScheduledReminder(
  iso: string,
  timezone: string | null,
): string {
  const timeZone = zone(timezone);
  const instant = new Date(iso);
  const datePart = instant.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
  const timePart = instant.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
  return `${datePart} at ${timePart}`;
}

export function formatLastReminderSent(
  iso: string,
  timezone: string | null,
): string {
  const timeZone = zone(timezone);
  const instant = new Date(iso);
  const datePart = instant.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  });
  const timePart = instant.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
  return `${datePart} at ${timePart}`;
}
