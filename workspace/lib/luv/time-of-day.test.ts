import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  WORKSPACE_BUSINESS_TIMEZONE,
  formatLuvGreeting,
  hourInWorkspaceTimezone,
  timeOfDayGreetingPhrase,
} from "./time-of-day";

/** Build an Instant that is the given wall-clock hour:minute in America/New_York. */
function nyWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  // Binary-search UTC so that NY hour/minute match (handles EST/EDT).
  let lo = Date.UTC(year, month - 1, day - 1, 0, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 1, 23, 59, 59);
  for (let i = 0; i < 40; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const d = new Date(mid);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: WORKSPACE_BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");
    const y = get("year");
    const m = get("month");
    const da = get("day");
    const h = get("hour");
    const mi = get("minute");
    const key = y * 1e8 + m * 1e6 + da * 1e4 + h * 100 + mi;
    const target = year * 1e8 + month * 1e6 + day * 1e4 + hour * 100 + minute;
    if (key === target) return d;
    if (key < target) lo = mid + 1;
    else hi = mid - 1;
  }
  throw new Error(`Could not resolve NY wall clock ${year}-${month}-${day} ${hour}:${minute}`);
}

describe("Luv time-of-day (America/New_York)", () => {
  it("defaults timezone to America/New_York", () => {
    assert.equal(WORKSPACE_BUSINESS_TIMEZONE, "America/New_York");
  });

  it("11:59 AM Eastern → morning (EST)", () => {
    const now = nyWallClock(2026, 1, 15, 11, 59);
    assert.equal(hourInWorkspaceTimezone(now), 11);
    assert.equal(timeOfDayGreetingPhrase(now), "Good morning");
  });

  it("12:00 PM Eastern → afternoon (EST)", () => {
    const now = nyWallClock(2026, 1, 15, 12, 0);
    assert.equal(hourInWorkspaceTimezone(now), 12);
    assert.equal(timeOfDayGreetingPhrase(now), "Good afternoon");
  });

  it("4:59 PM Eastern → afternoon (EST)", () => {
    const now = nyWallClock(2026, 1, 15, 16, 59);
    assert.equal(timeOfDayGreetingPhrase(now), "Good afternoon");
  });

  it("5:00 PM Eastern → evening (EST)", () => {
    const now = nyWallClock(2026, 1, 15, 17, 0);
    assert.equal(timeOfDayGreetingPhrase(now), "Good evening");
  });

  it("midnight and early morning are evening until 5:00", () => {
    assert.equal(timeOfDayGreetingPhrase(nyWallClock(2026, 1, 15, 0, 0)), "Good evening");
    assert.equal(timeOfDayGreetingPhrase(nyWallClock(2026, 1, 15, 4, 59)), "Good evening");
    assert.equal(timeOfDayGreetingPhrase(nyWallClock(2026, 1, 15, 5, 0)), "Good morning");
  });

  it("EDT transition still uses Eastern wall clock", () => {
    // Mid-July is EDT (UTC-4).
    const morning = nyWallClock(2026, 7, 15, 11, 59);
    const afternoon = nyWallClock(2026, 7, 15, 12, 0);
    const evening = nyWallClock(2026, 7, 15, 17, 0);
    assert.equal(timeOfDayGreetingPhrase(morning), "Good morning");
    assert.equal(timeOfDayGreetingPhrase(afternoon), "Good afternoon");
    assert.equal(timeOfDayGreetingPhrase(evening), "Good evening");
    // Prove these Instants are not the same as naive UTC hours.
    assert.notEqual(morning.getUTCHours(), 11);
  });

  it("does not use Date#getHours (UTC trap on ECS)", () => {
    // 12:00 America/New_York in January = 17:00 UTC → getHours() on UTC host = 17.
    const noonEastern = new Date("2026-01-15T17:00:00.000Z");
    assert.equal(noonEastern.getUTCHours(), 17);
    assert.equal(timeOfDayGreetingPhrase(noonEastern), "Good afternoon");
    assert.notEqual(
      timeOfDayGreetingPhrase(noonEastern),
      noonEastern.getUTCHours() >= 17 ? "Good evening" : "x",
    );
  });

  it("formats greeting with first name", () => {
    const now = nyWallClock(2026, 1, 15, 12, 0);
    assert.equal(formatLuvGreeting("Jennifer", now), "Good afternoon, Jennifer.");
  });
});
