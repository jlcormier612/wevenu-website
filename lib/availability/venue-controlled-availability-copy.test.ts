/**
 * Locks venue-facing availability education copy. Does not exercise booking
 * behavior — only the customer-facing guidance placements.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { FINAL_HELP_ARTICLES } from "@/lib/help-guides/final-articles";

const settings = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
const calendar = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const bookedDialog = readFileSync(resolve("components/leads/pipeline-booked-confirm-dialog.tsx"), "utf8");
const holdSection = readFileSync(resolve("components/availability/date-holds-section.tsx"), "utf8");

describe("Venue-controlled availability education copy", () => {
  it("Availability settings use the locked heading, model, Holds, and Tours guidance", () => {
    assert.match(settings, /How date availability works/);
    assert.match(settings, /You control when a date is protected\./);
    assert.match(
      settings,
      /A preferred date from an inquiry does not reserve the date\. A date is protected only when you place a Hold or move a relationship to Booked\. HTC does not decide that a contract, payment, or other milestone means a booking/,
    );
    assert.match(
      settings,
      /Choose whether venue-created Holds prevent other bookings\. This setting applies wherever HTC checks availability\./,
    );
    assert.match(
      settings,
      /Choose whether tours can be scheduled when an event is occupying the date\. This setting applies wherever HTC checks availability\./,
    );
    assert.doesNotMatch(settings, /checks tour availability/);
  });

  it("Calendar uses the locked venue-controlled guidance and Help link", () => {
    assert.match(calendar, /Availability is venue-controlled\./);
    assert.match(
      calendar,
      /Only Holds, Booked Events and Blocked Time protect dates\. Inquiry dates and preferred dates do not reserve a date\./,
    );
    assert.match(calendar, /Learn how availability works/);
    assert.match(calendar, /href="\/help\/how-does-date-availability-work"/);
  });

  it("Booked confirmation uses the locked heading and date-protection copy", () => {
    assert.match(bookedDialog, /You&apos;re booking this date\./);
    assert.match(
      bookedDialog,
      /Moving this relationship to Booked will protect the event date from conflicting bookings\./,
    );
    assert.doesNotMatch(bookedDialog, /Mark this client as booked/);
    assert.doesNotMatch(bookedDialog, /advisory lock|booked_at|database transaction/i);
  });

  it("Hold confirmation uses the locked heading and settings copy", () => {
    assert.match(holdSection, /You&apos;re placing a Hold on this date\./);
    assert.match(
      holdSection,
      /Whether this Hold prevents booking is controlled by your availability settings\./,
    );
    assert.match(calendarView, /You&apos;re placing a Hold on this date\./);
    assert.match(
      calendarView,
      /Whether this Hold prevents booking is controlled by your availability settings\./,
    );
    assert.doesNotMatch(calendarView, /Date booked\./);
    assert.doesNotMatch(calendarView, /enough to say/);
    assert.doesNotMatch(calendarView, /This reserves the date/);
  });

  it("Help article explains the locked venue-controlled model without implementation terms", () => {
    const article = FINAL_HELP_ARTICLES.find((a) => a.slug === "how-does-date-availability-work");
    assert.ok(article);
    assert.equal(article.title, "How Does Date Availability Work?");
    assert.match(article.body, /You decide when a date is protected\./);
    assert.match(
      article.body,
      /HTC does not automatically reserve a date because a couple submits an inquiry, names a preferred date, signs a contract, or makes a payment\./,
    );
    assert.match(article.body, /• Hold: You deliberately place a Hold on the date\./);
    assert.match(
      article.body,
      /• Booked: You move the relationship to Booked, either yourself or through an automation you've configured\./,
    );
    assert.match(
      article.body,
      /HTC records and enforces the booking decision you make; it does not impose its own definition of when a couple is booked\./,
    );
    assert.match(
      article.body,
      /A preferred date is not a reservation\. A couple can tell you they want June 14, but June 14 remains available until you deliberately protect it\./,
    );
    assert.doesNotMatch(article.body, /booked_at|advisory lock|RPC|database (?:transaction|constraint)/i);
  });
});
