/**
 * Date-based Automatic Reminder clock: venue-local 10:00, not 08:00 UTC.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { AUTOMATION_DEFAULT_SEND_TIME } from "@/lib/message-sequences/schedule-times";
import {
  TASK_REMINDER_SEND_TIME,
  formatLastReminderSent,
  formatNextScheduledReminder,
  nextRecurringReminderAt,
  scheduledReminderAt,
} from "@/lib/notifications/schedule-times";
import { utcToVenueLocalParts } from "@/lib/venue/timezone";

const read = (p: string) => readFileSync(resolve(p), "utf8");

describe("TASK_REMINDER_SEND_TIME", () => {
  it("is 10:00 and matches Automations without coupling implementations", () => {
    assert.equal(TASK_REMINDER_SEND_TIME, "10:00");
    assert.equal(TASK_REMINDER_SEND_TIME, AUTOMATION_DEFAULT_SEND_TIME);
    const reminderHelper = read("lib/notifications/schedule-times.ts");
    assert.doesNotMatch(reminderHelper, /computeDelayedSendIso/);
    const automation = read("lib/message-sequences/schedule-times.ts");
    assert.doesNotMatch(automation, /TASK_REMINDER_SEND_TIME/);
  });
});

describe("scheduledReminderAt", () => {
  it("Eastern summer: due date at 10:00 America/New_York", () => {
    const iso = scheduledReminderAt("2026-07-15", 0, "America/New_York");
    const parts = utcToVenueLocalParts(iso, "America/New_York");
    assert.equal(parts.date, "2026-07-15");
    assert.equal(parts.time, "10:00");
  });

  it("Pacific summer: due date at 10:00 America/Los_Angeles", () => {
    const iso = scheduledReminderAt("2026-07-15", 0, "America/Los_Angeles");
    const parts = utcToVenueLocalParts(iso, "America/Los_Angeles");
    assert.equal(parts.date, "2026-07-15");
    assert.equal(parts.time, "10:00");
    const eastern = utcToVenueLocalParts(iso, "America/New_York");
    assert.notEqual(eastern.time, "10:00");
  });

  it("preserves signed payment/contract offsets -21/-14/-7/0", () => {
    for (const offset of [-21, -14, -7, 0]) {
      const iso = scheduledReminderAt("2026-10-20", offset, "America/New_York");
      const parts = utcToVenueLocalParts(iso, "America/New_York");
      assert.equal(parts.time, "10:00");
    }
    assert.equal(utcToVenueLocalParts(scheduledReminderAt("2026-10-20", -21, "America/New_York"), "America/New_York").date, "2026-09-29");
    assert.equal(utcToVenueLocalParts(scheduledReminderAt("2026-10-20", -14, "America/New_York"), "America/New_York").date, "2026-10-06");
    assert.equal(utcToVenueLocalParts(scheduledReminderAt("2026-10-20", -7, "America/New_York"), "America/New_York").date, "2026-10-13");
    assert.equal(utcToVenueLocalParts(scheduledReminderAt("2026-10-20", 0, "America/New_York"), "America/New_York").date, "2026-10-20");
  });

  it("task before-due uses negative offsets (7/3/1 days before)", () => {
    const due = "2026-10-20";
    assert.equal(utcToVenueLocalParts(scheduledReminderAt(due, -7, "America/New_York"), "America/New_York").date, "2026-10-13");
    assert.equal(utcToVenueLocalParts(scheduledReminderAt(due, -3, "America/New_York"), "America/New_York").date, "2026-10-17");
    assert.equal(utcToVenueLocalParts(scheduledReminderAt(due, -1, "America/New_York"), "America/New_York").date, "2026-10-19");
  });

  it("spring DST: 10:00 still 10:00 on the venue clock", () => {
    const iso = scheduledReminderAt("2026-03-08", 0, "America/New_York");
    const parts = utcToVenueLocalParts(iso, "America/New_York");
    assert.equal(parts.date, "2026-03-08");
    assert.equal(parts.time, "10:00");
  });

  it("fall DST: 10:00 still 10:00 on the venue clock", () => {
    const iso = scheduledReminderAt("2026-11-01", 0, "America/New_York");
    const parts = utcToVenueLocalParts(iso, "America/New_York");
    assert.equal(parts.date, "2026-11-01");
    assert.equal(parts.time, "10:00");
  });

  it("null timezone uses America/New_York fallback", () => {
    const withNull = scheduledReminderAt("2026-07-15", 0, null);
    const withNy = scheduledReminderAt("2026-07-15", 0, "America/New_York");
    assert.equal(withNull, withNy);
  });
});

describe("nextRecurringReminderAt", () => {
  it("anchors to prior scheduled_for venue date, not worker now", () => {
    const previous = scheduledReminderAt("2026-10-04", 0, "America/New_York");
    const next = nextRecurringReminderAt(previous, 1, "America/New_York");
    const parts = utcToVenueLocalParts(next, "America/New_York");
    assert.equal(parts.date, "2026-10-05");
    assert.equal(parts.time, "10:00");
  });

  it("stays on 10:00 when the row was a 9:00 PM first overdue chase", () => {
    const previous = "2026-10-05T01:00:00.000Z"; // Oct 4 9:00 PM Eastern
    const prevParts = utcToVenueLocalParts(previous, "America/New_York");
    assert.equal(prevParts.date, "2026-10-04");
    assert.equal(prevParts.time, "21:00");
    const next = nextRecurringReminderAt(previous, 1, "America/New_York");
    const parts = utcToVenueLocalParts(next, "America/New_York");
    assert.equal(parts.date, "2026-10-05");
    assert.equal(parts.time, "10:00");
  });

  it("does not drift when actual send is 10:17", () => {
    const scheduled = scheduledReminderAt("2026-10-05", 0, "America/New_York");
    const sentAt = "2026-10-05T14:17:00.000Z";
    assert.notEqual(scheduled, sentAt);
    const next = nextRecurringReminderAt(scheduled, 1, "America/New_York");
    const parts = utcToVenueLocalParts(next, "America/New_York");
    assert.equal(parts.date, "2026-10-06");
    assert.equal(parts.time, "10:00");
    assert.equal(next, scheduledReminderAt("2026-10-06", 0, "America/New_York"));
    assert.notEqual(next, sentAt.replace("2026-10-05T14:17", "2026-10-06T14:17"));
  });
});

describe("scheduled_for is not sent_at or processing time", () => {
  it("a 10:00 reminder processed at 10:30 still reports 10:00 scheduled", () => {
    const scheduledFor = scheduledReminderAt("2026-10-05", 0, "America/New_York");
    const processedAt = "2026-10-05T14:30:00.000Z";
    const sentAt = processedAt;
    const scheduledParts = utcToVenueLocalParts(scheduledFor, "America/New_York");
    const sentParts = utcToVenueLocalParts(sentAt, "America/New_York");
    assert.equal(scheduledParts.time, "10:00");
    assert.equal(sentParts.time, "10:30");
    assert.notEqual(scheduledFor, sentAt);
    assert.equal(formatNextScheduledReminder(scheduledFor, "America/New_York"), "Mon, Oct 5 at 10:00 AM");
    assert.equal(formatLastReminderSent(sentAt, "America/New_York"), "Oct 5 at 10:30 AM");
  });
});

describe("display formatters use venue timezone", () => {
  it("formats next and last in Eastern, not as a silent browser zone", () => {
    const tenAmEastern = scheduledReminderAt("2026-10-05", 0, "America/New_York");
    assert.equal(formatNextScheduledReminder(tenAmEastern, "America/New_York"), "Mon, Oct 5 at 10:00 AM");
    assert.equal(formatLastReminderSent(tenAmEastern, "America/Los_Angeles"), "Oct 5 at 7:00 AM");
  });
});

describe("production reminder paths stay on the locked boundaries", () => {
  it("playbooks and obligations no longer use 08:00 UTC or Date.setDate scheduling", () => {
    const playbooks = read("lib/playbooks/repository.ts");
    assert.match(playbooks, /scheduledReminderAt/);
    assert.doesNotMatch(playbooks, /T08:00:00Z/);
    assert.doesNotMatch(playbooks, /function offsetDatetime/);
    const obligations = read("lib/notifications/obligations.ts");
    assert.match(obligations, /scheduledReminderAt/);
    assert.doesNotMatch(obligations, /T08:00:00Z/);
    assert.doesNotMatch(obligations, /function offsetDatetime/);
  });

  it("task recurrence uses nextRecurringReminderAt; tours skip it", () => {
    const engine = read("lib/notifications/engine.ts");
    assert.match(engine, /nextRecurringReminderAt/);
    assert.match(engine, /!isTourReminder/);
    assert.match(engine, /\.lte\("scheduled_for", now\)/);
    assert.doesNotMatch(engine, /next\.setDate/);
    const tours = read("lib/tours/booked-side-effects.ts");
    assert.match(tours, /24 \* 3600 \* 1000/);
    assert.doesNotMatch(tours, /scheduledReminderAt|TASK_REMINDER_SEND_TIME|nextRecurringReminderAt/);
  });

  it("first payment overdue remains now; later recurrence is 10:00", () => {
    const obligationEngine = read("lib/notifications/obligation-engine.ts");
    assert.match(obligationEngine, /scheduled_for: new Date\(\)\.toISOString\(\)/);
    assert.match(obligationEngine, /nextRecurringReminderAt/);
    assert.doesNotMatch(obligationEngine, /function offsetDatetime/);
  });

  it("worker cadence and scheduled sends stay separate", () => {
    const vercel = read("vercel.json");
    assert.match(vercel, /\/api\/notifications\/process"\s*,\s*"schedule": "\*\/30/);
    assert.match(vercel, /\/api\/communication\/scheduled\/process"\s*,\s*"schedule": "\*\/5/);
    const crontab = read("scheduler/crontab");
    assert.match(crontab, /\*\/30 \* \* \* \*.*\/api\/notifications\/process/);
    const engine = read("lib/notifications/engine.ts");
    assert.doesNotMatch(engine, /scheduled_messages/);
    const obligations = read("lib/notifications/obligations.ts");
    assert.doesNotMatch(obligations, /scheduled_messages/);
    const processRoute = read("app/api/notifications/process/route.ts");
    assert.match(processRoute, /runAllProcessors/);
    assert.match(processRoute, /POST/);
  });

  it("does not hard-code UTC offsets in reminder scheduling", () => {
    const helper = read("lib/notifications/schedule-times.ts");
    assert.doesNotMatch(helper, /-04:00|-05:00|-07:00|-08:00/);
    assert.doesNotMatch(helper, /T14:00:00Z|T15:00:00Z|T17:00:00Z|T18:00:00Z/);
  });
});
