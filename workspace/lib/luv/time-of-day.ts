/**
 * Workspace Luv time-of-day greetings.
 *
 * Business default timezone is America/New_York (EST/EDT via Intl).
 * Do not use Date#getHours() — ECS containers run in UTC and would mis-label
 * Eastern daytime as evening.
 */

export const WORKSPACE_BUSINESS_TIMEZONE = "America/New_York";

export type LuvTimeOfDayGreeting =
  | "Good morning"
  | "Good afternoon"
  | "Good evening";

/**
 * Hour-of-day (0–23) in the Workspace business timezone.
 */
export function hourInWorkspaceTimezone(
  now: Date,
  timeZone: string = WORKSPACE_BUSINESS_TIMEZONE,
): number {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour");
  const hour = Number(hourPart?.value ?? "0");
  return Number.isFinite(hour) ? hour : 0;
}

/**
 * Greeting rules (America/New_York):
 * - 05:00–11:59 → Good morning
 * - 12:00–16:59 → Good afternoon
 * - 17:00–04:59 → Good evening
 */
export function timeOfDayGreetingPhrase(
  now: Date = new Date(),
  timeZone: string = WORKSPACE_BUSINESS_TIMEZONE,
): LuvTimeOfDayGreeting {
  const hour = hourInWorkspaceTimezone(now, timeZone);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatLuvGreeting(
  firstName: string,
  now: Date = new Date(),
  timeZone: string = WORKSPACE_BUSINESS_TIMEZONE,
): string {
  const name = firstName.trim() || "there";
  return `${timeOfDayGreetingPhrase(now, timeZone)}, ${name}.`;
}
